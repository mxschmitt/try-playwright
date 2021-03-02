package main

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"net/url"
	"os"
	"os/signal"
	"path/filepath"
	"syscall"
	"time"

	log "github.com/sirupsen/logrus"

	"github.com/getsentry/sentry-go"
	"github.com/google/uuid"
	"github.com/julienschmidt/httprouter"
	"github.com/minio/minio-go/v7"
	"github.com/minio/minio-go/v7/pkg/credentials"
	"github.com/minio/minio-go/v7/pkg/lifecycle"
)

type server struct {
	server      *http.Server
	minioClient *minio.Client
}

const bucketName = "file-uploads"

func newServer() (*server, error) {
	err := sentry.Init(sentry.ClientOptions{
		Dsn: os.Getenv("FILE_SERVICE_SENTRY_DSN"),
	})
	if err != nil {
		return nil, fmt.Errorf("could not init Sentry: %w", err)
	}
	minioClient, err := minio.New(os.Getenv("MINIO_ENDPOINT"), &minio.Options{
		Creds:  credentials.NewStaticV4(os.Getenv("MINIO_ACCESS_KEY"), os.Getenv("MINIO_SECRET_KEY"), ""),
		Secure: false,
	})
	if err != nil {
		return nil, fmt.Errorf("could not init minio client: %w", err)
	}
	err = minioClient.MakeBucket(context.Background(), bucketName, minio.MakeBucketOptions{})
	if err != nil {
		// Check to see if we already own this bucket (which happens if you run this twice)
		exists, errBucketExists := minioClient.BucketExists(context.Background(), bucketName)
		if errBucketExists == nil && exists {
			log.Printf("We already own %s\n", bucketName)
		} else {
			return nil, fmt.Errorf("could not check if bucket exists: %w", err)
		}
	} else {
		log.Printf("Successfully created bucket %s\n", bucketName)
		config := lifecycle.NewConfiguration()
		config.Rules = []lifecycle.Rule{
			{
				ID:     "expire-bucket",
				Status: "Enabled",
				Expiration: lifecycle.Expiration{
					Days: 1,
				},
			},
		}
		if err := minioClient.SetBucketLifecycle(context.Background(), bucketName, config); err != nil {
			return nil, fmt.Errorf("could not set bucket lifecycle rule: %w", err)
		}
	}
	s := &server{
		minioClient: minioClient,
	}

	router := httprouter.New()
	router.GET("/api/v1/health", s.handleHealth)
	router.HEAD("/api/v1/health", s.handleHealth)
	router.POST("/api/v1/file/upload", s.handleUploadImage)
	router.PanicHandler = func(w http.ResponseWriter, r *http.Request, err interface{}) {
		if exception, ok := err.(string); ok {
			sentry.CaptureException(errors.New(exception))
		}
		if exception, ok := err.(error); ok {
			sentry.CaptureException(exception)
		}
		w.WriteHeader(http.StatusInternalServerError)
	}
	s.server = &http.Server{Addr: fmt.Sprintf(":%s", os.Getenv("FILE_HTTP_PORT")), Handler: router}
	return s, nil
}

type publicFile struct {
	FileName  string `json:"fileName"`
	PublicURL string `json:"publicURL"`
	Extension string `json:"extension"`
}

func (s *server) handleUploadImage(w http.ResponseWriter, r *http.Request, _ httprouter.Params) {
	// Maximum of 10MB
	if err := r.ParseMultipartForm(10 << 20); err != nil {
		http.Error(w, fmt.Sprintf("could not parse form: %v", err), http.StatusBadRequest)
		return
	}
	outFiles := []publicFile{}
	for _, files := range r.MultipartForm.File {
		for i := range files {
			file, err := files[i].Open()
			if err != nil {
				http.Error(w, fmt.Sprintf("could not open file: %v", err), http.StatusInternalServerError)
				return
			}
			defer file.Close()
			id := uuid.New().String()
			fileExtension := filepath.Ext(files[i].Filename)
			objectName := id + fileExtension
			if _, err := s.minioClient.PutObject(context.Background(), bucketName, objectName, file, files[i].Size, minio.PutObjectOptions{
				ContentType: files[i].Header.Get("Content-Type"),
			}); err != nil {
				http.Error(w, fmt.Sprintf("could not put object: %v", err), http.StatusInternalServerError)
				return
			}
			publicURL, err := s.minioClient.PresignedGetObject(context.Background(), bucketName, objectName, time.Minute*10, url.Values{})
			if err != nil {
				http.Error(w, fmt.Sprintf("could not generate public URL: %v", err), http.StatusInternalServerError)
				return
			}
			outFiles = append(outFiles, publicFile{
				Extension: fileExtension,
				FileName:  files[i].Filename,
				PublicURL: publicURL.EscapedPath() + "?" + publicURL.RawQuery,
			})
		}
	}
	w.Header().Set("Content-Type", "application/json")
	if err := json.NewEncoder(w).Encode(outFiles); err != nil {
		http.Error(w, fmt.Sprintf("could not decode response json: %v", err), http.StatusInternalServerError)
		return
	}
}

func (s *server) handleHealth(w http.ResponseWriter, r *http.Request, _ httprouter.Params) {
	w.WriteHeader(http.StatusOK)
}

func (s *server) ListenAndServe() error {
	return s.server.ListenAndServe()
}

func (s *server) Stop() error {
	return s.server.Shutdown(context.Background())
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
	signal := <-stop
	log.Printf("received stop signal: %s", signal)
	log.Println("shutting down server gracefully")

	if err := s.Stop(); err != nil {
		log.Fatalf("could not stop: %v", err)
	}
}
