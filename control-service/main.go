package main

import (
	"context"
	"encoding/json"
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

	log "github.com/sirupsen/logrus"

	"github.com/getsentry/sentry-go"
	"github.com/julienschmidt/httprouter"
	"github.com/streadway/amqp"
	"go.etcd.io/etcd/clientv3"
	"k8s.io/client-go/kubernetes"
	"k8s.io/client-go/rest"
)

const ID_LENGTH = 7
const K8_NAMESPACE_NAME = "default"
const WORKER_TIMEOUT = 10
const EXECUTION_TIMEOUT = 30

func init() {
	rand.Seed(time.Now().UTC().UnixNano())
}

type server struct {
	server *http.Server

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
	router := httprouter.New()
	router.GET("/service/control/health", s.handleHealth)
	router.HEAD("/service/control/health", s.handleHealth)
	router.POST("/service/control/run", handleRequestError(s.handleRun))
	router.GET("/service/control/share/get/:id", handleRequestError(s.handleShareGet))
	router.POST("/service/control/share/create", handleRequestError(s.handleShareCreate))
	router.PanicHandler = func(w http.ResponseWriter, r *http.Request, err interface{}) {
		if exception, ok := err.(string); ok {
			sentry.CaptureException(errors.New(exception))
		}
		if exception, ok := err.(error); ok {
			sentry.CaptureException(exception)
		}
		w.WriteHeader(http.StatusInternalServerError)
	}
	s.server = &http.Server{Handler: router, Addr: fmt.Sprintf(":%s", os.Getenv("CONTROL_HTTP_PORT"))}
}

type runPayload struct {
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

type Response struct {
	Body       interface{}
	StatusCode int
}

func handleRequestError(cb func(http.ResponseWriter, *http.Request, httprouter.Params) (*Response, error)) func(w http.ResponseWriter, r *http.Request, _ httprouter.Params) {
	return func(w http.ResponseWriter, r *http.Request, params httprouter.Params) {
		response, err := cb(w, r, params)
		if err != nil {
			http.Error(w, err.Error(), http.StatusInternalServerError)
			return
		}

		if response == nil {
			return
		}
		w.Header().Set("Content-Type", "application/json")
		if response.StatusCode != 0 {
			w.WriteHeader(response.StatusCode)
		}
		if err := json.NewEncoder(w).Encode(response.Body); err != nil {
			http.Error(w, fmt.Sprintf("could encode response: %v", err), http.StatusInternalServerError)
		}
	}
}

func (s *server) handleRun(w http.ResponseWriter, r *http.Request, _ httprouter.Params) (*Response, error) {
	var req *runPayload
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		return nil, fmt.Errorf("could not decode request body: %w", err)
	}

	log.Printf("Obtaining worker")
	var worker *Worker
	select {
	case worker = <-s.workers.GetCh():
	case <-time.After(WORKER_TIMEOUT * time.Second):
		log.Println("Got Worker timeout, was not able to get a worker!")
		return &Response{
			StatusCode: http.StatusServiceUnavailable,
			Body: map[string]string{
				"error": "Timeout in getting a worker!",
			},
		}, nil
	}

	logger := log.WithFields(log.Fields{
		"worker-id": worker.id,
	})
	logger.Info("Obtained worker successfully")
	logger.Info("Publishing job")
	if err := worker.Publish(req.Code); err != nil {
		return nil, fmt.Errorf("could not create new worker job: %w", err)
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
		return &Response{
			StatusCode: http.StatusServiceUnavailable,
			Body: map[string]string{
				"error": "Execution timeout!",
			},
		}, nil
	}

	if !payload.Success {
		return &Response{
			StatusCode: http.StatusBadRequest,
			Body:       payload,
		}, nil
	}
	return &Response{
		Body: payload,
	}, nil
}

func (s *server) handleShareGet(w http.ResponseWriter, r *http.Request, params httprouter.Params) (*Response, error) {
	id := params.ByName("id")
	resp, err := s.etcdClient.Get(context.Background(), id)
	if err != nil {
		return nil, fmt.Errorf("could not fetch share: %w", err)
	}
	if resp.Count == 0 {
		return nil, fmt.Errorf("no share found")
	}
	if _, err := w.Write(resp.Kvs[0].Value); err != nil {
		return nil, fmt.Errorf("could not write share: %w", err)
	}
	return nil, nil
}

func (s *server) handleShareCreate(w http.ResponseWriter, r *http.Request, _ httprouter.Params) (*Response, error) {
	code, err := ioutil.ReadAll(http.MaxBytesReader(w, r.Body, 1024))
	if err != nil {
		return nil, fmt.Errorf("could read request body: %w", err)
	}
	for retryCount := 0; retryCount <= 3; retryCount++ {
		id := generateRandom(ID_LENGTH)
		resp, err := s.etcdClient.Get(context.Background(), id)
		if err != nil {
			return nil, fmt.Errorf("could not fetch share: %w", err)
		}
		if resp.Count == 0 {
			_, err = s.etcdClient.Put(context.Background(), id, string(code))
			if err != nil {
				return nil, fmt.Errorf("could not save share: %w", err)
			}
			return &Response{
				Body: map[string]string{
					"key": id,
				},
			}, nil
		}
	}
	return nil, errors.New("could not generate a key")
}

func (s *server) handleHealth(w http.ResponseWriter, r *http.Request, _ httprouter.Params) {
	for _, endpoint := range s.etcdClient.Endpoints() {
		if _, err := s.etcdClient.Status(context.Background(), endpoint); err != nil {
			http.Error(w, "could not check etcd status", http.StatusInternalServerError)
			return
		}
	}
	w.WriteHeader(http.StatusOK)
}

func (s *server) ListenAndServe() error {
	return s.server.ListenAndServe()
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

func generateRandom(n int) string {
	var letterRunes = []rune("abcdefghijklmnopqrstuvpxyz1234567890")
	b := make([]rune, n)
	for i := range b {
		b[i] = letterRunes[rand.Intn(len(letterRunes))]
	}
	return string(b)
}
