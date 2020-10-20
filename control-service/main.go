package main

import (
	"context"
	"encoding/json"
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

	"github.com/google/uuid"
	"github.com/julienschmidt/httprouter"
	"github.com/streadway/amqp"
	"go.etcd.io/etcd/clientv3"
)

const ID_LENGTH = 5

type server struct {
	server         *http.Server
	etcdClient     *clientv3.Client
	amqpConnection *amqp.Connection
	amqpChannel    *amqp.Channel
	amqpReplyQueue amqp.Queue
	replies        map[string]chan []byte
	repliesLock    sync.Mutex
}

func newServer() (*server, error) {
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
		etcdClient:     etcdClient,
		amqpConnection: amqpConnection,
		amqpChannel:    amqpChannel,
		amqpReplyQueue: amqpReplyQueue,
		replies:        make(map[string]chan []byte),
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
	router.POST("/service/control/run", s.handleRun)
	router.GET("/service/control/share/get/:id", s.handleShareGet)
	router.POST("/service/control/share/create", s.handleShareCreate)
	s.server = &http.Server{Handler: router, Addr: fmt.Sprintf(":%s", os.Getenv("CONTROL_HTTP_PORT"))}
	return s, nil
}

type runPayload struct {
	Code string `json:"code"`
}

func (s *server) handleRun(w http.ResponseWriter, r *http.Request, _ httprouter.Params) {
	var req *runPayload
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, fmt.Sprintf("could not decode request body: %v", err), http.StatusInternalServerError)
		return
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
		http.Error(w, fmt.Sprintf("could not encode msg payload: %v", err), http.StatusInternalServerError)
		return
	}

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
		http.Error(w, fmt.Sprintf("could not publish message: %v", err), http.StatusInternalServerError)
		return
	}

	result := <-reply

	s.repliesLock.Lock()
	delete(s.replies, corrId)
	s.repliesLock.Unlock()

	if strings.HasPrefix(string(result), `{"error":"`) {
		w.WriteHeader(http.StatusBadRequest)
	}
	if _, err := w.Write(result); err != nil {
		http.Error(w, fmt.Sprintf("could not write response8: %v", err), http.StatusInternalServerError)
		return
	}
}

func (s *server) handleShareGet(w http.ResponseWriter, r *http.Request, params httprouter.Params) {
	id := params.ByName("id")
	resp, err := s.etcdClient.Get(context.Background(), id)
	if err != nil {
		http.Error(w, fmt.Sprintf("could not fetch share: %v", err), http.StatusInternalServerError)
		return
	}
	if resp.Count == 0 {
		http.Error(w, "no share found", http.StatusNotFound)
		return
	}
	if _, err := w.Write(resp.Kvs[0].Value); err != nil {
		http.Error(w, fmt.Sprintf("could not write share: %v", err), http.StatusInternalServerError)
		return
	}
}

func (s *server) handleShareCreate(w http.ResponseWriter, r *http.Request, _ httprouter.Params) {
	code, err := ioutil.ReadAll(http.MaxBytesReader(w, r.Body, 1024))
	if err != nil {
		http.Error(w, fmt.Sprintf("could read request body: %v", err), http.StatusInternalServerError)
		return
	}
	for retryCount := 0; retryCount <= 3; retryCount++ {
		id := generateRandom(ID_LENGTH)
		resp, err := s.etcdClient.Get(context.Background(), id)
		if err != nil {
			http.Error(w, fmt.Sprintf("could not fetch share: %v", err), http.StatusInternalServerError)
			return
		}
		if resp.Count == 0 {
			_, err = s.etcdClient.Put(context.Background(), id, string(code))
			if err != nil {
				http.Error(w, fmt.Sprintf("could not save share: %v", err), http.StatusInternalServerError)
				return
			}
			respBody := map[string]string{
				"key": id,
			}
			w.Header().Set("Content-Type", "application/json")
			if err := json.NewEncoder(w).Encode(respBody); err != nil {
				http.Error(w, fmt.Sprintf("could encode response: %v", err), http.StatusInternalServerError)
				return
			}
			return
		}
	}
}

func (s *server) handleHealth(w http.ResponseWriter, r *http.Request, _ httprouter.Params) {
	w.WriteHeader(http.StatusOK)
}

func (s *server) ListenAndServe() error {
	return s.server.ListenAndServe()
}

func (s *server) Stop() error {
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
	<-stop
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
