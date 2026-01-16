package worker

import (
	"bytes"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"mime/multipart"
	"net/http"
	"os"
	"os/exec"
	"path/filepath"
	"strings"
	"time"

	"github.com/mxschmitt/try-playwright/internal/logagg"
	"github.com/mxschmitt/try-playwright/internal/workertypes"
	log "github.com/sirupsen/logrus"
	"github.com/streadway/amqp"
)

type executionHandler func(worker *Worker, code string) error

type Worker struct {
	options   *WorkerExectionOptions
	channel   *amqp.Channel
	TmpDir    string
	requestID string
	testID    string
	logger    *log.Logger
	logBuffer *bytes.Buffer
	output    *bytes.Buffer
	files     []string
	env       []string
}

var queue_name = fmt.Sprintf("rpc_queue_%s", os.Getenv("WORKER_ID"))

func (w *Worker) Run() {
	w.logBuffer = new(bytes.Buffer)
	w.logger = log.New()
	w.logger.SetFormatter(&log.JSONFormatter{
		TimestampFormat: time.RFC3339Nano,
		FieldMap: log.FieldMap{
			log.FieldKeyMsg: "message",
		},
	})
	w.logger.SetOutput(io.MultiWriter(os.Stdout, w.logBuffer))
	w.logger.SetLevel(log.InfoLevel)
	w.logger.AddHook(logagg.NewHook())

	if w.options.ExecutionDirectory != "" {
		w.TmpDir = w.options.ExecutionDirectory
	} else {
		var err error
		w.TmpDir, err = os.MkdirTemp("", "try-pw")
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

func (w *Worker) AddEnv(key, value string) {
	w.env = append(w.env, fmt.Sprintf("%s=%s", key, value))
}
func (w *Worker) ExecCommand(name string, args ...string) error {
	path, err := exec.LookPath(name)
	if err != nil {
		return fmt.Errorf("could not command lookup path: %w", err)
	}
	collector, err := newFilesCollector(w.TmpDir, w.options.IgnoreFilePatterns)
	if err != nil {
		return fmt.Errorf("could not create file collector: %w", err)
	}
	workerProxy := os.Getenv("WORKER_HTTP_PROXY")
	envSlices := [][]string{
		os.Environ(),
		w.env,
		{
			fmt.Sprintf("http_proxy=%s", workerProxy),
			fmt.Sprintf("HTTPS_PROXY=%s", workerProxy),
			// Firefox needs it currently in lower-case. See
			// https://github.com/microsoft/playwright/issues/6094
			fmt.Sprintf("https_proxy=%s", workerProxy),
		},
	}

	var env []string
	for _, e := range envSlices {
		env = append(env, e...)
	}

	c := exec.Cmd{
		Dir:    w.TmpDir,
		Path:   path,
		Args:   append([]string{name}, args...),
		Stdout: io.MultiWriter(os.Stdout, w.output),
		Stderr: io.MultiWriter(os.Stderr, w.output),
		Env:    env,
	}
	if err := c.Run(); err != nil {
		return errors.New("could not run command")
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
	w.requestID = incomingMessageParsed.RequestID
	w.testID = incomingMessageParsed.TestID
	defer logagg.DeferPost("worker", &w.testID, &w.requestID, w.logBuffer)
	if w.requestID != "" {
		w.AddEnv("PLAYWRIGHT_REQUEST_ID", w.requestID)
	}
	if w.testID != "" {
		w.AddEnv("PLAYWRIGHT_TEST_ID", w.testID)
	}
	w.logger.WithFields(log.Fields{
		"request-id": w.requestID,
		"testId":     w.testID,
		"service":    "worker",
	}).Info("received execution message")
	outgoingMessage := &workertypes.WorkerResponsePayload{
		Version: os.Getenv("PLAYWRIGHT_VERSION"),
		Files:   []workertypes.File{},
	}
	if err := w.options.Handler(w, incomingMessageParsed.Code); err != nil {
		outgoingMessage.Success = false
		outgoingMessage.Error = err.Error()
	} else {
		outgoingMessage.Success = true
		files, err := w.uploadFiles()
		if err != nil {
			return fmt.Errorf("could not upload files: %w", err)
		}
		if files != nil {
			outgoingMessage.Files = files
		}
	}
	outgoingMessage.Output = w.options.TransformOutput(w.output.String())
	outgoingMessage.RequestID = w.requestID
	outgoingMessage.TestID = w.testID
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
	if len(w.files) == 0 {
		return nil, nil
	}
	w.logger.WithFields(log.Fields{
		"request-id": w.requestID,
		"testId":     w.testID,
	}).Infof("uploading %d file(s) to file service", len(w.files))
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
	if w.requestID != "" {
		req.Header.Set("X-Request-ID", w.requestID)
	}
	if w.testID != "" {
		req.Header.Set("X-Test-ID", w.testID)
	}

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
	IgnoreFilePatterns []string
}

func NewWorker(options *WorkerExectionOptions) *Worker {
	if options.TransformOutput == nil {
		options.TransformOutput = DefaultTransformOutput
	}
	return &Worker{
		options: options,
		output:  new(bytes.Buffer),
		files:   make([]string, 0),
		env:     make([]string, 0),
	}
}

func DefaultTransformOutput(output string) string {
	return strings.TrimRight(output, "\n")
}
