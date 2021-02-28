package main

import (
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
	"go.etcd.io/etcd/clientv3"
	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/mongo"
	"go.mongodb.org/mongo-driver/mongo/options"
	"go.mongodb.org/mongo-driver/mongo/readpref"
	batchV1 "k8s.io/api/batch/v1"
	v1 "k8s.io/api/core/v1"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/watch"
	"k8s.io/client-go/kubernetes"
	"k8s.io/client-go/rest"
	"k8s.io/utils/pointer"
)

const ID_LENGTH = 7
const K8_NAMESPACE_NAME = "default"
const MAX_TIMEOUT = 30

func init() {
	rand.Seed(time.Now().UTC().UnixNano())
}

type workerPayload struct {
	Code string `json:"code"`
}

type server struct {
	server *http.Server

	etcdClient               *clientv3.Client
	mongoClient              *mongo.Client
	mongoExecutionCollection *mongo.Collection
	k8ClientSet              *kubernetes.Clientset

	repliesMu sync.Mutex
	replies   map[string]chan bool
	payloads  *payloadStorage
	responses *responseStorage
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

	config, err := rest.InClusterConfig()
	if err != nil {
		return nil, fmt.Errorf("could not create k8 in cluster config: %w", err)
	}
	k8ClientSet, err := kubernetes.NewForConfig(config)
	if err != nil {
		return nil, fmt.Errorf("could not create k8 clientset: %w", err)
	}

	watcher, err := k8ClientSet.BatchV1().Jobs(K8_NAMESPACE_NAME).Watch(context.Background(), metav1.ListOptions{
		LabelSelector: "pod-name=worker",
	})
	if err != nil {
		return nil, fmt.Errorf("could not create job watcher: %w", err)
	}

	s := &server{
		etcdClient:               etcdClient,
		mongoClient:              mongoClient,
		mongoExecutionCollection: mongoClient.Database("try-playwright").Collection("executions"),
		replies:                  make(map[string]chan bool),
		payloads:                 newPayloadStorage(etcdClient),
		responses:                newResponseStorage(etcdClient),
		k8ClientSet:              k8ClientSet,
	}

	go func() {
		eventsChan := watcher.ResultChan()
		for {
			event := <-eventsChan
			if event.Type != watch.Modified {
				continue
			}
			job, ok := event.Object.(*batchV1.Job)
			if !ok {
				continue
			}
			if job.Status.Succeeded != 1 {
				continue
			}
			jobId := job.Labels["job-id"]
			s.repliesMu.Lock()
			reply, ok := s.replies[jobId]
			s.repliesMu.Unlock()
			if !ok {
				continue
			}
			reply <- true
			log.Printf("finished job %s", jobId)
		}
	}()

	router := httprouter.New()
	router.GET("/service/control/health", s.handleHealth)
	router.HEAD("/service/control/health", s.handleHealth)
	router.GET("/service/control/worker/payload/:id", handleRequestError(s.handleWorkerGetPayload))
	router.POST("/service/control/worker/payload/:id", handleRequestError(s.handleWorkerStoreResponse))
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

	log.Printf("Creating job")
	job, err := newWorkerJob(s, req.Code)
	if err != nil {
		return nil, fmt.Errorf("could not create new worker job: %w", err)
	}

	log.Printf("Job %s created", job.id)
	start := time.Now()

	var payload *workerResponsePayload
	timeout := false
	select {
	case payload = <-job.reply:
		payload.Duration = time.Since(start).Milliseconds()
	case <-time.After(MAX_TIMEOUT * time.Second):
		timeout = false
	}

	if err := job.cleanup(); err != nil {
		log.Printf("could not cleanup worker: %v", err)
	}

	if timeout {
		return &Response{
			StatusCode: http.StatusRequestTimeout,
			Body: map[string]string{
				"error": "Timeout!",
			},
		}, nil
	}

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

func (s *server) handleWorkerGetPayload(w http.ResponseWriter, r *http.Request, params httprouter.Params) (*Response, error) {
	payloadId := params.ByName("id")
	payload, err := s.payloads.GetPayloadOneShot(payloadId)
	if err != nil {
		return nil, fmt.Errorf("could not get payload: %w", err)
	}
	return &Response{
		Body:       payload,
		StatusCode: http.StatusOK,
	}, nil
}

func (s *server) handleWorkerStoreResponse(w http.ResponseWriter, r *http.Request, params httprouter.Params) (*Response, error) {
	payloadId := params.ByName("id")

	body, err := ioutil.ReadAll(r.Body)
	if err != nil {
		return nil, fmt.Errorf("could not decode request body: %w", err)
	}

	if err := s.responses.SavePayload(payloadId, body); err != nil {
		return nil, fmt.Errorf("could not save etcd value: %w", err)
	}

	return nil, nil
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
	for _, endpoint := range s.etcdClient.Endpoints() {
		if _, err := s.etcdClient.Status(context.Background(), endpoint); err != nil {
			http.Error(w, "could not check etcd status", http.StatusInternalServerError)
			return
		}
	}
	w.WriteHeader(http.StatusOK)
}

type workerJob struct {
	id     string
	job    *batchV1.Job
	server *server
	reply  chan *workerResponsePayload
}

func newWorkerJob(server *server, code string) (*workerJob, error) {
	w := &workerJob{
		server: server,
		id:     uuid.New().String(),
		reply:  make(chan *workerResponsePayload, 1),
	}

	replyWrapper := make(chan bool, 1)
	server.repliesMu.Lock()
	server.replies[w.id] = replyWrapper
	server.repliesMu.Unlock()

	go func() {
		<-replyWrapper
		server.repliesMu.Lock()
		data, err := server.responses.GetPayloadOneShot(w.id)
		if err != nil {
			log.Printf("could not read response from storage: %v", err)
			return
		}
		server.repliesMu.Unlock()
		w.reply <- data
	}()

	if err := server.payloads.SavePayload(w.id, &workerPayload{
		Code: code,
	}); err != nil {
		return nil, fmt.Errorf("could not save payload: %w", err)
	}

	if err := w.createWorkerPod(); err != nil {
		return nil, fmt.Errorf("could not create pod: %w", err)
	}

	return w, nil
}

func (w *workerJob) createWorkerPod() error {
	var err error
	w.job, err = w.server.k8ClientSet.BatchV1().Jobs(K8_NAMESPACE_NAME).Create(context.Background(), &batchV1.Job{
		ObjectMeta: metav1.ObjectMeta{
			GenerateName: "worker-",
			Labels: map[string]string{
				"pod-name": "worker",
				"job-id":   w.id,
			},
		},
		Spec: batchV1.JobSpec{
			ActiveDeadlineSeconds: pointer.Int64Ptr(30),
			BackoffLimit:          pointer.Int32Ptr(0),
			Template: v1.PodTemplateSpec{
				ObjectMeta: metav1.ObjectMeta{
					GenerateName: "worker-",
					Labels: map[string]string{
						"pod-name": "nginx",
					},
				},
				Spec: v1.PodSpec{
					RestartPolicy: v1.RestartPolicy(v1.PullNever),
					Containers: []v1.Container{
						{
							Name:  "worker",
							Image: "ghcr.io/mxschmitt/try-playwright/worker.slim",
							Env: []v1.EnvVar{
								{
									Name:  "JOB_ID",
									Value: w.id,
								},
								{
									Name:  "FILE_SERVICE_URL",
									Value: "http://file:8080",
								},
							},
						},
					},
				},
			},
		},
	}, metav1.CreateOptions{})
	if err != nil {
		return fmt.Errorf("could not create job: %w", err)
	}
	return nil
}

func (w *workerJob) cleanup() error {
	// if err := w.server.k8ClientSet.BatchV1().Jobs(K8_NAMESPACE_NAME).
	// 	Delete(context.Background(), w.job.Name, metav1.DeleteOptions{}); err != nil {
	// 	return fmt.Errorf("could not delete pod: %w", err)
	// }

	w.server.repliesMu.Lock()
	delete(w.server.replies, w.id)
	w.server.repliesMu.Unlock()

	return nil
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
	signal := <-stop
	log.Printf("received stop signal: %s", signal)
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
