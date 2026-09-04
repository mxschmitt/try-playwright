package main

import (
	"bytes"
	"context"
	"crypto/rand"
	"errors"
	"fmt"
	"io"
	"math/big"
	"net/http"
	"os"
	"os/signal"
	"strconv"
	"syscall"
	"time"

	"github.com/labstack/echo/v5"
	"github.com/mxschmitt/try-playwright/internal/echoutils"
	"github.com/mxschmitt/try-playwright/internal/logagg"
	"github.com/mxschmitt/try-playwright/internal/workertypes"
	log "github.com/sirupsen/logrus"

	"github.com/getsentry/sentry-go"
	sentryecho "github.com/getsentry/sentry-go/echo"

	"github.com/google/uuid"
	amqp "github.com/rabbitmq/amqp091-go"
	clientv3 "go.etcd.io/etcd/client/v3"
	"k8s.io/client-go/kubernetes"
	"k8s.io/client-go/rest"
)

const (
	SNIPPET_ID_LENGTH = 7
	K8_NAMESPACE_NAME = "default"
	WORKER_TIMEOUT    = 10
	EXECUTION_TIMEOUT = 60
)

func init() {
	log.SetFormatter(&log.JSONFormatter{
		TimestampFormat: time.RFC3339Nano,
		FieldMap: log.FieldMap{
			log.FieldKeyMsg: "message",
		},
	})
}

type server struct {
	echo       *echo.Echo
	httpServer *http.Server

	etcdClient *clientv3.Client

	amqpConnection *amqp.Connection
	amqpErrorChan  chan *amqp.Error

	workers map[workertypes.WorkerLanguage]*Workers
	runs    *runHub
}

func newServer() (*server, error) {
	err := sentry.Init(sentry.ClientOptions{
		Dsn: os.Getenv("CONTROL_SERVICE_SENTRY_DSN"),
	})
	if err != nil {
		return nil, fmt.Errorf("could not init Sentry: %w", err)
	}

	etcdClient, err := clientv3.New(clientv3.Config{
		Endpoints:   []string{os.Getenv("ETCD_ENDPOINT")},
		DialTimeout: 5 * time.Second,
	})
	if err != nil {
		return nil, fmt.Errorf("could not connect to etcd: %w", err)
	}

	config, err := rest.InClusterConfig()
	if err != nil {
		return nil, fmt.Errorf("could not create k8 in cluster config: %w", err)
	}
	k8ClientSet, err := kubernetes.NewForConfig(config)
	if err != nil {
		return nil, fmt.Errorf("could not create k8 clientset: %w", err)
	}

	amqpConnection, err := amqp.Dial(os.Getenv("AMQP_URL"))
	if err != nil {
		return nil, fmt.Errorf("could not connect to amqp: %w", err)
	}
	amqpErrorChan := make(chan *amqp.Error, 1)
	amqpConnection.NotifyClose(amqpErrorChan)
	amqpChannel, err := amqpConnection.Channel()
	if err != nil {
		return nil, fmt.Errorf("could not open channel: %w", err)
	}

	workerCount := 4
	workerCountEnv := os.Getenv("WORKER_COUNT")
	if workerCountEnv != "" {
		workerCount, err = strconv.Atoi(workerCountEnv)
		if err != nil {
			return nil, fmt.Errorf("could not parse worker count from 'WORKER_COUNT' env var: %w", err)
		}
	}

	workerLanguages, err := parseWorkerLanguages(os.Getenv("WORKER_LANGUAGES"))
	if err != nil {
		return nil, err
	}
	workersMap := map[workertypes.WorkerLanguage]*Workers{}
	for _, lang := range workerLanguages {
		workersMap[lang], err = newWorkers(lang, workerCount, k8ClientSet, amqpChannel)
		if err != nil {
			return nil, fmt.Errorf("could not create new %s workers: %w", lang, err)
		}
	}

	s := &server{
		etcdClient:     etcdClient,
		amqpConnection: amqpConnection,
		amqpErrorChan:  amqpErrorChan,
		workers:        workersMap,
		runs:           newRunHub(),
	}

	s.initializeHttpServer()
	return s, nil
}

func (s *server) initializeHttpServer() {
	s.echo = echo.New()
	s.echo.HTTPErrorHandler = echoutils.HTTPErrorHandler(s.echo)
	s.echo.Use(sentryecho.New(sentryecho.Options{}))
	s.echo.GET("/service/control/health", s.handleHealth)
	s.echo.HEAD("/service/control/health", s.handleHealth)
	s.echo.POST("/service/control/run", s.handleRun)
	s.echo.GET("/service/control/run/:id/log-watch", s.handleLogWatch)
	s.echo.GET("/service/control/share/get/:id", s.handleShareGet)
	s.echo.POST("/service/control/share/create", s.handleShareCreate)
}

func getTurnstileIP(c *echo.Context) string {
	cfConnectingIP := c.Request().Header.Get("CF-Connecting-IP")
	if cfConnectingIP != "" {
		return cfConnectingIP
	}
	return c.RealIP()
}

func respondError(c *echo.Context, status int, requestID, testID string, logBuffer *bytes.Buffer, msg string) error {
	return c.JSON(status, map[string]any{
		"error":     msg,
		"requestId": requestID,
		"testId":    testID,
		"logs": map[string]any{
			"control": logBuffer.String(),
		},
	})
}

func (s *server) handleRun(c *echo.Context) error {
	requestID := uuid.New().String()
	testID := c.Request().Header.Get("X-Test-ID")
	if testID == "" {
		testID = requestID
	}
	c.Set("requestId", requestID)
	c.Set("testId", testID)
	c.Response().Header().Set("X-Request-ID", requestID)
	c.Response().Header().Set("X-Test-ID", testID)
	logBuffer := &bytes.Buffer{}
	requestScopedLogger := log.New()
	requestScopedLogger.SetFormatter(log.StandardLogger().Formatter)
	requestScopedLogger.SetLevel(log.GetLevel())
	requestScopedLogger.SetOutput(io.MultiWriter(os.Stdout, logBuffer))
	logger := requestScopedLogger.WithFields(log.Fields{
		"request-id": requestID,
		"testId":     testID,
		"service":    "control",
	})
	logger.Logger.AddHook(logagg.NewHook())

	var req *workertypes.WorkerRequestPayload
	if err := c.Bind(&req); err != nil {
		return respondError(c, http.StatusBadRequest, requestID, testID, logBuffer, "could not decode request body")
	}
	req.RequestID = requestID
	req.TestID = testID
	if !req.Language.IsValid() {
		return respondError(c, http.StatusBadRequest, requestID, testID, logBuffer, "could not recognize language")
	}
	workers, enabled := s.workers[req.Language]
	if !enabled {
		return respondError(c, http.StatusBadRequest, requestID, testID, logBuffer, "language is not enabled")
	}

	logger.Printf("Validating turnstile")
	if err := ValidateTurnstile(c.Request().Context(), req.Token, getTurnstileIP(c), os.Getenv("TURNSTILE_SECRET_KEY")); err != nil {
		logger.Printf("Could not validate turnstile: %v", err)
		return respondError(c, http.StatusUnauthorized, requestID, testID, logBuffer, err.Error())
	}
	logger = logger.WithField("request-id", requestID)
	logger.Printf("Validated turnstile successfully")
	logger.Printf("Obtaining worker")
	var worker *Worker
	select {
	case worker = <-workers.GetCh():
	case <-time.After(WORKER_TIMEOUT * time.Second):
		logger.Println("Got Worker timeout, was not able to get a worker!")
		return respondError(c, http.StatusServiceUnavailable, requestID, testID, logBuffer, "Timeout in getting a worker!")
	}

	logger = logger.WithFields(log.Fields{
		"worker-id": worker.id,
		"testId":    testID,
	})
	logger.Infof("Received code: '%s'", req.Code)
	logger.Info("Obtained worker successfully")
	logger.Info("Publishing job")
	session := newRunSession(requestID)
	s.runs.Put(requestID, session)
	workers.replies.Store(worker.id, session)
	if err := worker.Publish(req.Code, req.RequestID, req.TestID); err != nil {
		logger.Errorf("could not create new worker job: %v", err)
		s.runs.Delete(requestID)
		workers.replies.Delete(worker.id)
		return respondError(c, http.StatusInternalServerError, requestID, testID, logBuffer, "could not create new worker job")
	}
	logger.Println("Published message")

	go func() {
		select {
		case <-session.finished:
			logger.Println("Received response successfully")
		case <-time.After(EXECUTION_TIMEOUT * time.Second):
			logger.Println("Got execution timeout!")
			session.Fail("Execution timeout!")
		}

		logger.Println("Starting worker cleanup")
		if err := worker.Cleanup(); err != nil {
			logger.Printf("could not cleanup worker: %v", err)
		} else {
			logger.Println("Finished worker cleanup")
		}

		logger.Println("Adding new worker")
		if err := workers.AddWorkers(1); err != nil {
			logger.Printf("could not create new worker: %v", err)
		} else {
			logger.Println("Added new worker successfully")
		}

		time.AfterFunc(runSessionTTL, func() {
			s.runs.Delete(requestID)
		})
	}()

	if wantsJSONWait(c.Request().Header.Get("Accept")) {
		<-session.finished
		payload, timedOut := session.Result()
		if timedOut || (payload != nil && payload.Error == "Execution timeout!") {
			return c.JSON(http.StatusServiceUnavailable, map[string]any{
				"error":     "Execution timeout!",
				"requestId": requestID,
				"testId":    testID,
				"logs": map[string]any{
					"control": logBuffer.String(),
				},
			})
		}
		if payload == nil {
			return respondError(c, http.StatusInternalServerError, requestID, testID, logBuffer, "missing worker response")
		}
		payload.RequestID = requestID
		payload.TestID = testID
		if !payload.Success {
			return c.JSON(http.StatusBadRequest, payload)
		}
		return c.JSON(http.StatusOK, payload)
	}

	return c.JSON(http.StatusAccepted, map[string]any{
		"id":        requestID,
		"requestId": requestID,
		"testId":    testID,
	})
}

func (s *server) handleShareGet(c *echo.Context) error {
	ctx := c.Request().Context()
	id := c.Param("id")
	resp, err := s.etcdClient.Get(ctx, id)
	if err != nil {
		return fmt.Errorf("could not fetch share: %w", err)
	}
	if resp.Count == 0 {
		return fmt.Errorf("no share found")
	}
	return c.Blob(http.StatusOK, "application/json", resp.Kvs[0].Value)
}

func (s *server) handleShareCreate(c *echo.Context) error {
	ctx := c.Request().Context()
	code, err := io.ReadAll(http.MaxBytesReader(c.Response(), c.Request().Body, 1<<20))
	if err != nil {
		return fmt.Errorf("could not read request body: %w", err)
	}
	for retryCount := 0; retryCount <= 3; retryCount++ {
		id := generateRandomString(SNIPPET_ID_LENGTH)
		resp, err := s.etcdClient.Get(ctx, id)
		if err != nil {
			return fmt.Errorf("could not fetch share: %w", err)
		}
		if resp.Count == 0 {
			_, err = s.etcdClient.Put(ctx, id, string(code))
			if err != nil {
				return fmt.Errorf("could not save share: %w", err)
			}
			return c.JSON(http.StatusCreated, map[string]any{
				"key": id,
			})
		}
	}
	return errors.New("could not generate a key")
}

func (s *server) handleHealth(c *echo.Context) error {
	ctx := c.Request().Context()
	for _, endpoint := range s.etcdClient.Endpoints() {
		if _, err := s.etcdClient.Status(ctx, endpoint); err != nil {
			return fmt.Errorf("could not check etcd status: %w", err)
		}
	}
	return c.String(http.StatusOK, "OK")
}

func (s *server) ListenAndServe() error {
	s.httpServer = &http.Server{
		Addr:    fmt.Sprintf(":%s", os.Getenv("CONTROL_HTTP_PORT")),
		Handler: s.echo,
	}
	return s.httpServer.ListenAndServe()
}

func (s *server) Stop() error {
	if err := s.httpServer.Shutdown(context.Background()); err != nil {
		return fmt.Errorf("could not shutdown server: %w", err)
	}
	for language := range s.workers {
		if err := s.workers[language].Cleanup(); err != nil {
			return fmt.Errorf("could not cleanup workers: %w", err)
		}
	}
	if err := s.amqpConnection.Close(); err != nil {
		return fmt.Errorf("could not close amqp connection: %w", err)
	}
	return s.etcdClient.Close()
}

func main() {
	s, err := newServer()
	if err != nil {
		log.Fatalf("could not init server: %v", err)
	}
	fmt.Println("Running...")
	stop := make(chan os.Signal, 1)
	signal.Notify(stop, syscall.SIGINT, syscall.SIGTERM)
	go func() {
		if err := s.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			log.Fatalf("could not listen: %v", err)
		}
	}()
	select {
	case signal := <-stop:
		log.Printf("received stop signal: %s", signal)
	case err := <-s.amqpErrorChan:
		log.Printf("received amqp error: %v", err)
	}
	log.Println("shutting down server gracefully")
	if err := s.Stop(); err != nil {
		log.Fatalf("could not stop: %v", err)
	}
	log.Println("successfully shutdown server gracefully")
}

func generateRandomString(n int) string {
	var letterRunes = []rune("abcdefghijklmnopqrstuvwxyz1234567890")
	b := make([]rune, n)
	for i := range b {
		idx, _ := rand.Int(rand.Reader, big.NewInt(int64(len(letterRunes))))
		b[i] = letterRunes[idx.Int64()]
	}
	return string(b)
}
