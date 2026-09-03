package worker

import (
	"bufio"
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
	"sync"
	"time"

	"github.com/mxschmitt/try-playwright/internal/logagg"
	"github.com/mxschmitt/try-playwright/internal/workertypes"
	amqp "github.com/rabbitmq/amqp091-go"
	log "github.com/sirupsen/logrus"
)

type executionHandler func(worker *Worker, code string) error

type Worker struct {
	options   *WorkerExecutionOptions
	channel   *amqp.Channel
	pubMu     sync.Mutex
	replyTo   string
	corrID    string
	TmpDir    string
	requestID string
	testID    string
	logger    *log.Logger
	output    *bytes.Buffer
	files     []string
	env       []string
	onLog     func(line string)
}

var (
	queue_name           = fmt.Sprintf("rpc_queue_%s", os.Getenv("WORKER_ID"))
	errAMQPChannelClosed = errors.New("amqp delivery channel closed")
)

func (w *Worker) Run() {
	w.logger = log.New()
	w.logger.SetFormatter(&log.JSONFormatter{
		TimestampFormat: time.RFC3339Nano,
		FieldMap: log.FieldMap{
			log.FieldKeyMsg: "message",
		},
	})
	w.logger.SetOutput(os.Stdout)
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

	for {
		err := w.consumeOnce()
		if err == nil {
			return
		}
		if errors.Is(err, errAMQPChannelClosed) {
			log.Printf("amqp delivery channel closed, reconnecting")
			time.Sleep(time.Second)
			continue
		}
		log.Printf("%v", err)
		time.Sleep(time.Second)
	}
}

func (w *Worker) consumeOnce() error {
	conn, err := amqp.Dial(os.Getenv("AMQP_URL"))
	if err != nil {
		return fmt.Errorf("could not dial to amqp: %w", err)
	}
	defer conn.Close()

	w.channel, err = conn.Channel()
	if err != nil {
		return fmt.Errorf("could not open a channel: %w", err)
	}
	defer w.channel.Close()

	if _, err := w.channel.QueueDeclare(
		queue_name,
		false, // durable
		true,  // delete when unused
		false, // exclusive
		false, // noWait
		nil,   // args
	); err != nil {
		return fmt.Errorf("could not declare queue: %w", err)
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
		return fmt.Errorf("could not consume channel messages: %w", err)
	}
	err = w.consumeMessage(msgs)
	if err == nil || errors.Is(err, errAMQPChannelClosed) {
		return err
	}
	log.Fatalf("could not consume messages: %v", err)
	return nil
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

	env = append(env, "PYTHONUNBUFFERED=1")

	cmdPath := path
	cmdArgs := append([]string{name}, args...)
	if stdbuf, err := exec.LookPath("stdbuf"); err == nil {
		cmdPath = stdbuf
		cmdArgs = append([]string{"stdbuf", "-oL", "-eL", path}, args...)
	}

	pr, pw := io.Pipe()
	c := exec.Cmd{
		Dir:    w.TmpDir,
		Path:   cmdPath,
		Args:   cmdArgs,
		Stdout: io.MultiWriter(os.Stdout, pw),
		Stderr: io.MultiWriter(os.Stderr, pw),
		Env:    env,
	}

	scanDone := make(chan struct{})
	go func() {
		defer close(scanDone)
		scanner := bufio.NewScanner(pr)
		scanner.Buffer(make([]byte, 0, 64*1024), 1024*1024)
		for scanner.Scan() {
			w.emitLog(scanner.Text())
		}
	}()

	runErr := c.Run()
	_ = pw.Close()
	<-scanDone
	if runErr != nil {
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
	incomingMessage, ok := <-incomingMessages
	if !ok {
		return errAMQPChannelClosed
	}
	var incomingMessageParsed *workertypes.WorkerRequestPayload
	if err := json.Unmarshal(incomingMessage.Body, &incomingMessageParsed); err != nil {
		return fmt.Errorf("could not parse incoming amqp message: %w", err)
	}
	w.requestID = incomingMessageParsed.RequestID
	w.testID = incomingMessageParsed.TestID
	w.replyTo = incomingMessage.ReplyTo
	w.corrID = incomingMessage.CorrelationId
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
	if err := w.publishEvent(workertypes.WorkerEvent{
		Type:                  workertypes.WorkerEventDone,
		WorkerResponsePayload: outgoingMessage,
	}); err != nil {
		return fmt.Errorf("could not publish message: %w", err)
	}

	if err := incomingMessage.Ack(false); err != nil {
		return fmt.Errorf("could not ack message: %w", err)
	}
	return nil
}

func (w *Worker) emitLog(line string) {
	if w.onLog != nil {
		w.onLog(line)
	}
	w.output.WriteString(line)
	w.output.WriteByte('\n')
	if err := w.publishEvent(workertypes.WorkerEvent{
		Type: workertypes.WorkerEventLog,
		Line: line,
	}); err != nil && w.logger != nil {
		w.logger.WithError(err).Warn("could not publish log event")
	}
}

func (w *Worker) publishEvent(evt workertypes.WorkerEvent) error {
	if w.channel == nil || w.replyTo == "" {
		return nil
	}
	body, err := json.Marshal(evt)
	if err != nil {
		return fmt.Errorf("could not marshal event: %w", err)
	}
	w.pubMu.Lock()
	defer w.pubMu.Unlock()
	if err := w.channel.Publish(
		"",
		w.replyTo,
		false,
		false,
		amqp.Publishing{
			ContentType:   "application/json",
			CorrelationId: w.corrID,
			Body:          body,
		}); err != nil {
		return fmt.Errorf("could not publish event: %w", err)
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
		if err := copyFileToMultipart(requestWriter, i, filePath); err != nil {
			return nil, err
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

func copyFileToMultipart(w *multipart.Writer, index int, filePath string) error {
	fw, err := w.CreateFormFile(fmt.Sprintf("file-%d", index), filepath.Base(filePath))
	if err != nil {
		return fmt.Errorf("could not create form file: %w", err)
	}
	f, err := os.Open(filePath)
	if err != nil {
		return fmt.Errorf("could not open file: %w", err)
	}
	defer f.Close()
	if _, err = io.Copy(fw, f); err != nil {
		return fmt.Errorf("could not copy file into form file writer: %w", err)
	}
	return nil
}

type WorkerExecutionOptions struct {
	Handler            executionHandler
	ExecutionDirectory string
	TransformOutput    func(output string) string
	IgnoreFilePatterns []string
}

func NewWorker(options *WorkerExecutionOptions) *Worker {
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
