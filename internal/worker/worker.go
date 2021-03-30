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
	channel *amqp.Channel
	handler executionHandler
	TmpDir  string
	output  *bytes.Buffer
	files   []string
}

var queue_name = fmt.Sprintf("rpc_queue_%s", os.Getenv("WORKER_ID"))

func (w *Worker) Run() {
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
		return fmt.Errorf("could not lookup path: %w", err)
	}
	collector, err := newFilesCollector(w.TmpDir)
	if err != nil {
		return fmt.Errorf("could not create file collector: %w", err)
	}
	c := exec.Cmd{
		Dir:    collector.tmpDir,
		Path:   path,
		Args:   append([]string{name}, args...),
		Stdout: io.MultiWriter(os.Stdout, w.output),
		Stderr: io.MultiWriter(os.Stderr, w.output),
		Env:    append(os.Environ(), fmt.Sprintf("http_proxy=%s", os.Getenv("WORKER_HTTP_PROXY"))),
	}
	if err := c.Run(); err != nil {
		return fmt.Errorf("could not run command: %s", strings.TrimRight(w.output.String(), "\n"))
	}
	files, err := collector.Collect()
	if err != nil {
		return fmt.Errorf("could not collect file: %w", err)
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
	if err := w.handler(w, incomingMessageParsed.Code); err != nil {
		outgoingMessage.Success = false
		outgoingMessage.Error = err.Error()
	} else {
		outgoingMessage.Success = true
		outgoingMessage.Output = strings.TrimRight(w.output.String(), "\n")
		outgoingMessage.Files, err = w.uploadFiles()
		if err != nil {
			return fmt.Errorf("could not upload file: %w", err)
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
			return nil, fmt.Errorf("could not copy file into fw: %w", err)
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

func NewWorker(handler executionHandler) *Worker {
	tmpDir, err := os.MkdirTemp("", "try-pw")
	if err != nil {
		log.Fatalf("could not create tmp dir: %v", err)
		return nil
	}
	return &Worker{
		handler: handler,
		output:  new(bytes.Buffer),
		files:   make([]string, 0),
		TmpDir:  tmpDir,
	}
}
