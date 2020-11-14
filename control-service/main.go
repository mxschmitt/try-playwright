package main

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io/ioutil"
	"log"
	"math/rand"
	"net/http"
	"os"
	"os/signal"
	"strings"
	"sync"
	"syscall"
	"time"

	"github.com/getsentry/sentry-go"
	"github.com/google/uuid"
	"github.com/julienschmidt/httprouter"
	"github.com/streadway/amqp"
	"go.etcd.io/etcd/clientv3"
	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/mongo"
	"go.mongodb.org/mongo-driver/mongo/options"
	"go.mongodb.org/mongo-driver/mongo/readpref"
)

const ID_LENGTH = 7

type server struct {
	server                   *http.Server
	etcdClient               *clientv3.Client
	mongoClient              *mongo.Client
	mongoExecutionCollection *mongo.Collection
	amqpConnection           *amqp.Connection
	amqpChannel              *amqp.Channel
	amqpReplyQueue           amqp.Queue
	amqpErrorChan            chan *amqp.Error
	replies                  map[string]chan []byte
	repliesLock              sync.Mutex
}

func newServer() (*server, error) {
	err := sentry.Init(sentry.ClientOptions{
		Dsn: os.Getenv("CONTORL_SERVICE_SENTRY_DSN"),
	})
	if err != nil {
		return nil, fmt.Errorf("could not init Sentry: %w", err)
	}

	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()
	mongoClient, err := mongo.Connect(ctx, options.Client().ApplyURI(os.Getenv("MONGO_DB_URI")))
	if err != nil {
		return nil, fmt.Errorf("could not connect to MongoDB database: %w", err)
	}
	ctx, cancel = context.WithTimeout(context.Background(), 2*time.Second)
	defer cancel()
	if err = mongoClient.Ping(ctx, readpref.Primary()); err != nil {
		return nil, fmt.Errorf("could not ping MongoDB: %w", err)
	}

	etcdClient, err := clientv3.New(clientv3.Config{
		Endpoints:   []string{os.Getenv("ETCD_ENDPOINT")},
		DialTimeout: 5 * time.Second,
	})
	if err != nil {
		return nil, fmt.Errorf("could not connect to etcd: %w", err)
	}

	amqpConnection, err := amqp.Dial(os.Getenv("AMQP_URL"))
	if err != nil {
		return nil, fmt.Errorf("could not connect to queue: %w", err)
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
		return nil, fmt.Errorf("Failed to declare a queue: %w", err)
	}

	msgs, err := amqpChannel.Consume(
		amqpReplyQueue.Name, // queue
		"",                  // consumer
		true,                // auto-ack
		false,               // exclusive
		false,               // no-local
		false,               // no-wait
		nil,                 // args
	)
	if err != nil {
		return nil, fmt.Errorf("Failed to register a consumer: %w", err)
	}
	s := &server{
		etcdClient:               etcdClient,
		mongoClient:              mongoClient,
		mongoExecutionCollection: mongoClient.Database("try-playwright").Collection("executions"),
		amqpConnection:           amqpConnection,
		amqpChannel:              amqpChannel,
		amqpReplyQueue:           amqpReplyQueue,
		amqpErrorChan:            amqpErrorChan,
		replies:                  make(map[string]chan []byte),
	}

	go func() {
		for d := range msgs {
			s.repliesLock.Lock()
			reply, ok := s.replies[d.CorrelationId]
			s.repliesLock.Unlock()
			if ok {
				reply <- d.Body
			}
		}
	}()

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
	return s, nil
}

type runPayload struct {
	Code string `json:"code"`
}

type workerResponsePayload struct {
	Success  bool   `json:"success"`
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

		if response != nil {
			w.Header().Set("Content-Type", "application/json")
			if response.StatusCode != 0 {
				w.WriteHeader(response.StatusCode)
			}
			if err := json.NewEncoder(w).Encode(response.Body); err != nil {
				http.Error(w, fmt.Sprintf("could encode response: %v", err), http.StatusInternalServerError)
			}
		}
	}
}

func (s *server) handleRun(w http.ResponseWriter, r *http.Request, _ httprouter.Params) (*Response, error) {
	var req *runPayload
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		return nil, fmt.Errorf("could not decode request body: %w", err)
	}
	corrId := uuid.New().String()

	reply := make(chan []byte, 1)
	s.repliesLock.Lock()
	s.replies[corrId] = reply
	s.repliesLock.Unlock()

	msgBody, err := json.Marshal(map[string]string{
		"code": req.Code,
	})
	if err != nil {
		return nil, fmt.Errorf("could not encode msg payload: %w", err)
	}

	start := time.Now()
	if err := s.amqpChannel.Publish(
		"",          // exchange
		"rpc_queue", // routing key
		false,       // mandatory
		false,       // immediate
		amqp.Publishing{
			ContentType:   "text/plain",
			CorrelationId: corrId,
			ReplyTo:       s.amqpReplyQueue.Name,
			Body:          msgBody,
		}); err != nil {
		return nil, fmt.Errorf("could not publish message: %w", err)
	}
	var payload workerResponsePayload
	select {
	case result := <-reply:
		if err := json.NewDecoder(bytes.NewBuffer(result)).Decode(&payload); err != nil {
			return nil, fmt.Errorf("could not decode worker response: %w", err)
		}
		payload.Duration = time.Since(start).Milliseconds()
	case <-time.After(30 * time.Second):
		return &Response{
			StatusCode: http.StatusRequestTimeout,
			Body: map[string]string{
				"error": "Timeout!",
			},
		}, nil
	}

	s.repliesLock.Lock()
	delete(s.replies, corrId)
	s.repliesLock.Unlock()

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()
	if _, err := s.mongoExecutionCollection.InsertOne(ctx, bson.M{
		"userAgent":         r.Header.Get("User-Agent"),
		"ip":                readUserIP(r),
		"code":              req.Code,
		"executionDuration": payload.Duration,
		"language":          "js",
		"createdAt":         time.Now(),
	}); err != nil {
		return nil, fmt.Errorf("could not insert MongoDB record: %w", err)
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
	if err := s.mongoClient.Ping(context.Background(), readpref.Primary()); err != nil {
		http.Error(w, "could not ping MongoDB", http.StatusInternalServerError)
		return
	}
	w.WriteHeader(http.StatusOK)
}

func (s *server) ListenAndServe() error {
	return s.server.ListenAndServe()
}

func (s *server) Stop() error {
	if err := s.mongoClient.Disconnect(context.Background()); err != nil {
		return fmt.Errorf("could not disconnect from MongoDB: %w", err)
	}
	if err := s.server.Shutdown(context.Background()); err != nil {
		return fmt.Errorf("could not shutdown server: %w", err)
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
		if err := s.ListenAndServe(); err != nil {
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
}

func generateRandom(n int) string {
	var letterRunes = []rune("abcdefghijklmnopqrstuvpxyz1234567890")
	b := make([]rune, n)
	for i := range b {
		b[i] = letterRunes[rand.Intn(len(letterRunes))]
	}
	return string(b)
}

func readUserIP(r *http.Request) string {
	forwardedIPAddresses := strings.Split(r.Header.Get("X-Forwarded-For"), ",")
	IPAddress := r.RemoteAddr
	if len(forwardedIPAddresses) > 0 {
		IPAddress = forwardedIPAddresses[0]
	}
	return IPAddress
}
