package main

import (
	"context"
	"errors"
	"fmt"
	"io/ioutil"
	"math/rand"
	"net/http"
	"os"
	"os/signal"
	"strconv"
	"syscall"
	"time"

	"github.com/labstack/echo/v4"
	log "github.com/sirupsen/logrus"

	"github.com/getsentry/sentry-go"
	sentryecho "github.com/getsentry/sentry-go/echo"

	"github.com/streadway/amqp"
	"go.etcd.io/etcd/clientv3"
	"k8s.io/client-go/kubernetes"
	"k8s.io/client-go/rest"
)

const (
	SNIPPET_ID_LENGTH = 7
	K8_NAMESPACE_NAME = "default"
	WORKER_TIMEOUT    = 10
	EXECUTION_TIMEOUT = 30
)

func init() {
	rand.Seed(time.Now().UTC().UnixNano())
	log.SetFormatter(&log.TextFormatter{
		TimestampFormat: time.StampMilli,
	})
}

type server struct {
	server *echo.Echo

	etcdClient *clientv3.Client

	amqpErrorChan chan *amqp.Error

	workers *Workers
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
	amqpReplyQueue, err := amqpChannel.QueueDeclare(
		"",    // name
		false, // durable
		false, // delete when unused
		true,  // exclusive
		false, // noWait
		nil,   // arguments
	)
	if err != nil {
		return nil, fmt.Errorf("Failed to declare reply queue: %w", err)
	}
	workerCount := 4
	workerCountEnv := os.Getenv("WORKER_COUNT")
	if workerCountEnv != "" {
		workerCount, err = strconv.Atoi(workerCountEnv)
		if err != nil {
			return nil, fmt.Errorf("could not parse worker count from 'WORKER_COUNT' env var: %w", err)
		}
	}

	workers, err := newWorkers(workerCount, k8ClientSet, amqpReplyQueue.Name, amqpChannel)
	if err != nil {
		return nil, fmt.Errorf("could not create new workers: %w", err)
	}

	s := &server{
		etcdClient:    etcdClient,
		amqpErrorChan: amqpErrorChan,
		workers:       workers,
	}

	s.initializeHttpServer()
	return s, nil
}

func (s *server) initializeHttpServer() {
	s.server = echo.New()
	s.server.Use(sentryecho.New(sentryecho.Options{}))
	s.server.GET("/service/control/health", s.handleHealth)
	s.server.HEAD("/service/control/health", s.handleHealth)
	s.server.POST("/service/control/run", s.handleRun)
	s.server.GET("/service/control/share/get/:id", s.handleShareGet)
	s.server.POST("/service/control/share/create", s.handleShareCreate)
}

type runRequestPayload struct {
	Code string `json:"code"`
}

type workerResponsePayload struct {
	Success  bool   `json:"success"`
	Error    string `json:"error"`
	Version  string `json:"version"`
	Duration int64  `json:"duration"`
	Files    []struct {
		PublicURL string `json:"publicURL"`
		FileName  string `json:"fileName"`
		Extension string `json:"extension"`
	} `json:"files"`
	Logs []struct {
		Mode string   `json:"mode"`
		Args []string `json:"args"`
	} `json:"logs"`
}

func (s *server) handleRun(c echo.Context) error {
	var req *runRequestPayload
	if err := c.Bind(&req); err != nil {
		return fmt.Errorf("could not decode request body: %w", err)
	}

	log.Printf("Obtaining worker")
	var worker *Worker
	select {
	case worker = <-s.workers.GetCh():
	case <-time.After(WORKER_TIMEOUT * time.Second):
		log.Println("Got Worker timeout, was not able to get a worker!")
		return c.JSON(http.StatusServiceUnavailable, echo.Map{
			"error": "Timeout in getting a worker!",
		})
	}

	logger := log.WithField("worker-id", worker.id)
	logger.Infof("Received code: '%s'", req.Code)
	logger.Info("Obtained worker successfully")
	logger.Info("Publishing job")
	if err := worker.Publish(req.Code); err != nil {
		return fmt.Errorf("could not create new worker job: %w", err)
	}
	logger.Println("Published message")

	start := time.Now()

	var payload *workerResponsePayload
	timeout := false
	select {
	case payload = <-worker.Subscribe():
		payload.Duration = time.Since(start).Milliseconds()
		logger.Println("Received response successfully")
	case <-time.After(EXECUTION_TIMEOUT * time.Second):
		logger.Println("Got execution timeout!")
		timeout = true
	}

	go func() {
		logger.Println("Starting worker cleanup")
		if err := worker.Cleanup(); err != nil {
			logger.Printf("could not cleanup worker: %v", err)
			return
		}
		logger.Println("Finished worker cleanup")

		logger.Println("Adding new worker")
		if err := s.workers.AddWorkers(1); err != nil {
			logger.Printf("could not create new worker: %v", err)
			return
		}
		logger.Println("Added new worker successfully")
	}()

	if timeout {
		return c.JSON(http.StatusServiceUnavailable, echo.Map{
			"error": "Execution timeout!",
		})
	}

	if !payload.Success {
		return c.JSON(http.StatusBadRequest, payload)
	}
	return c.JSON(http.StatusOK, payload)
}

func (s *server) handleShareGet(c echo.Context) error {
	id := c.Param("id")
	resp, err := s.etcdClient.Get(context.Background(), id)
	if err != nil {
		return fmt.Errorf("could not fetch share: %w", err)
	}
	if resp.Count == 0 {
		return fmt.Errorf("no share found")
	}
	return c.Blob(http.StatusOK, "application/json", resp.Kvs[0].Value)
}

func (s *server) handleShareCreate(c echo.Context) error {
	code, err := ioutil.ReadAll(http.MaxBytesReader(c.Response().Writer, c.Request().Body, 1024))
	if err != nil {
		return fmt.Errorf("could read request body: %w", err)
	}
	for retryCount := 0; retryCount <= 3; retryCount++ {
		id := generateRandomString(SNIPPET_ID_LENGTH)
		resp, err := s.etcdClient.Get(context.Background(), id)
		if err != nil {
			return fmt.Errorf("could not fetch share: %w", err)
		}
		if resp.Count == 0 {
			_, err = s.etcdClient.Put(context.Background(), id, string(code))
			if err != nil {
				return fmt.Errorf("could not save share: %w", err)
			}
			return c.JSON(http.StatusCreated, echo.Map{
				"key": id,
			})
		}
	}
	return errors.New("could not generate a key")
}

func (s *server) handleHealth(c echo.Context) error {
	for _, endpoint := range s.etcdClient.Endpoints() {
		if _, err := s.etcdClient.Status(context.Background(), endpoint); err != nil {
			return fmt.Errorf("could not check etcd status: %w", err)
		}
	}
	return c.String(http.StatusOK, "OK")
}

func (s *server) ListenAndServe() error {
	return s.server.Start(fmt.Sprintf(":%s", os.Getenv("CONTROL_HTTP_PORT")))
}

func (s *server) Stop() error {
	if err := s.server.Shutdown(context.Background()); err != nil {
		return fmt.Errorf("could not shutdown server: %w", err)
	}
	if err := s.workers.Cleanup(); err != nil {
		return fmt.Errorf("could not cleanup workers: %w", err)
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
	var letterRunes = []rune("abcdefghijklmnopqrstuvpxyz1234567890")
	b := make([]rune, n)
	for i := range b {
		b[i] = letterRunes[rand.Intn(len(letterRunes))]
	}
	return string(b)
}
