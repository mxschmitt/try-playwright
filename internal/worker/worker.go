package worker

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"mime/multipart"
	"net/http"
	"os"
	"os/exec"
	"path/filepath"
	"strings"

	"github.com/mxschmitt/try-playwright/internal/workertypes"
	"github.com/streadway/amqp"
)

type executionHandler func(worker *Worker, code string) error

type Worker struct {
	options *WorkerExectionOptions
	channel *amqp.Channel
	tmpDir  string
	output  *bytes.Buffer
	files   []string
}

var queue_name = fmt.Sprintf("rpc_queue_%s", os.Getenv("WORKER_ID"))

func (w *Worker) Run() {
	if w.options.ExecutionDirectory != "" {
		w.tmpDir = w.options.ExecutionDirectory
	} else {
		var err error
		w.tmpDir, err = os.MkdirTemp("", "try-pw")
		if err != nil {
			log.Fatalf("could not create tmp dir: %v", err)
		}
	}

	conn, err := amqp.Dial(os.Getenv("AMQP_URL"))
	if err != nil {
		log.Fatalf("could not dial to amqp: %v", err)
	}
	defer conn.Close()

	w.channel, err = conn.Channel()
	if err != nil {
		log.Fatalf("could not open a channel: %v", err)
	}
	msgs, err := w.channel.Consume(
		queue_name,
		"",    // consumer
		false, // auto-ack
		false, // exclusive
		false, // no-local
		false, // no-wait
		nil,   // args
	)
	if err != nil {
		log.Fatalf("could not consume channel messages: %v", err)
	}
	if err := w.consumeMessage(msgs); err != nil {
		log.Fatalf("could not consume messages: %v", err)
	}
	defer w.channel.Close()
}

func (w *Worker) ExecCommand(name string, args ...string) error {
	path, err := exec.LookPath(name)
	if err != nil {
		return fmt.Errorf("could not command lookup path: %w", err)
	}
	collector, err := newFilesCollector(w.tmpDir)
	if err != nil {
		return fmt.Errorf("could not create file collector: %w", err)
	}
	workerProxy := os.Getenv("WORKER_HTTP_PROXY")
	c := exec.Cmd{
		Dir:    w.tmpDir,
		Path:   path,
		Args:   append([]string{name}, args...),
		Stdout: io.MultiWriter(os.Stdout, w.output),
		Stderr: io.MultiWriter(os.Stderr, w.output),
		Env: append(
			os.Environ(),
			fmt.Sprintf("http_proxy=%s", workerProxy),
			fmt.Sprintf("HTTPS_PROXY=%s", workerProxy),
		),
	}
	if err := c.Run(); err != nil {
		return fmt.Errorf("could not run command: %s", w.options.TransformOutput(w.output.String()))
	}
	files, err := collector.Collect()
	if err != nil {
		return fmt.Errorf("could not collect files: %w", err)
	}
	w.files = append(w.files, files...)
	return nil
}

func (w *Worker) consumeMessage(incomingMessages <-chan amqp.Delivery) error {
	incomingMessage := <-incomingMessages
	var incomingMessageParsed *workertypes.WorkerRequestPayload
	if err := json.Unmarshal(incomingMessage.Body, &incomingMessageParsed); err != nil {
		return fmt.Errorf("could not parse incoming amqp message: %w", err)
	}
	outgoingMessage := &workertypes.WorkerResponsePayload{}
	if err := w.options.Handler(w, incomingMessageParsed.Code); err != nil {
		outgoingMessage.Success = false
		outgoingMessage.Error = err.Error()
	} else {
		outgoingMessage.Success = true
		outgoingMessage.Output = w.options.TransformOutput(w.output.String())
		outgoingMessage.Files, err = w.uploadFiles()
		if err != nil {
			return fmt.Errorf("could not upload files: %w", err)
		}
	}
	outgoingMessageBody, err := json.Marshal(outgoingMessage)
	if err != nil {
		return fmt.Errorf("could not marshal outgoing message payload: %w", err)
	}
	err = w.channel.Publish(
		"",                      // exchange
		incomingMessage.ReplyTo, // routing key
		false,                   // mandatory
		false,                   // immediate
		amqp.Publishing{
			ContentType:   "application/json",
			CorrelationId: incomingMessage.CorrelationId,
			Body:          outgoingMessageBody,
		})
	if err != nil {
		return fmt.Errorf("could not publish message: %w", err)
	}

	if err := incomingMessage.Ack(false); err != nil {
		return fmt.Errorf("could not ack message: %w", err)
	}
	return nil
}

var uploadFilesEndpoint = fmt.Sprintf("%s/api/v1/file/upload", os.Getenv("FILE_SERVICE_URL"))

func (w *Worker) uploadFiles() ([]workertypes.File, error) {
	var b bytes.Buffer
	requestWriter := multipart.NewWriter(&b)
	for i, filePath := range w.files {
		fw, err := requestWriter.CreateFormFile(fmt.Sprintf("file-%d", i), filepath.Base(filePath))
		if err != nil {
			return nil, fmt.Errorf("could not create form file: %w", err)
		}
		f, err := os.Open(filePath)
		if err != nil {
			return nil, fmt.Errorf("could not open file: %w", err)
		}
		defer f.Close()
		if _, err = io.Copy(fw, f); err != nil {
			return nil, fmt.Errorf("could not copy file into form file writer %w", err)
		}
	}
	if err := requestWriter.Close(); err != nil {
		return nil, fmt.Errorf("could not close multipart.Writer: %w", err)
	}

	req, err := http.NewRequest("POST", uploadFilesEndpoint, &b)
	if err != nil {
		return nil, fmt.Errorf("could not create new request: %w", err)
	}
	req.Header.Set("Content-Type", requestWriter.FormDataContentType())

	res, err := http.DefaultClient.Do(req)
	if err != nil {
		return nil, fmt.Errorf("could not execute request: %w", err)
	}

	if res.StatusCode != http.StatusCreated {
		return nil, fmt.Errorf("not expected status: %d", res.StatusCode)
	}
	var respBody []workertypes.File
	if err := json.NewDecoder(res.Body).Decode(&respBody); err != nil {
		return nil, fmt.Errorf("could not decode upload file response: %w", err)
	}
	return respBody, nil
}

type WorkerExectionOptions struct {
	Handler            executionHandler
	ExecutionDirectory string
	TransformOutput    func(output string) string
}

func NewWorker(options *WorkerExectionOptions) *Worker {
	if options.TransformOutput == nil {
		options.TransformOutput = DefaultTransformOutput
	}
	return &Worker{
		options: options,
		output:  new(bytes.Buffer),
		files:   make([]string, 0),
	}
}

func DefaultTransformOutput(output string) string {
	return strings.TrimRight(output, "\n")
}
