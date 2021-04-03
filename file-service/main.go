package main

import (
	"bytes"
	"context"
	"fmt"
	"io/ioutil"
	"net/http"
	"net/url"
	"os"
	"os/signal"
	"path/filepath"
	"syscall"
	"time"

	"github.com/h2non/filetype"
	"github.com/mxschmitt/try-playwright/internal/echoutils"
	log "github.com/sirupsen/logrus"

	"github.com/getsentry/sentry-go"

	sentryecho "github.com/getsentry/sentry-go/echo"
	"github.com/google/uuid"
	"github.com/labstack/echo/v4"
	"github.com/minio/minio-go/v7"
	"github.com/minio/minio-go/v7/pkg/credentials"
	"github.com/minio/minio-go/v7/pkg/lifecycle"
)

type server struct {
	server      *echo.Echo
	minioClient *minio.Client
}

const BUCKET_NAME = "file-uploads"

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
	err = minioClient.MakeBucket(context.Background(), BUCKET_NAME, minio.MakeBucketOptions{})
	if err != nil {
		// Check to see if we already own this bucket (which happens if you run this twice)
		exists, errBucketExists := minioClient.BucketExists(context.Background(), BUCKET_NAME)
		if errBucketExists == nil && exists {
			log.Printf("We already own %s\n", BUCKET_NAME)
		} else {
			return nil, fmt.Errorf("could not check if bucket exists: %w", err)
		}
	} else {
		log.Printf("Successfully created bucket %s\n", BUCKET_NAME)
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
		if err := minioClient.SetBucketLifecycle(context.Background(), BUCKET_NAME, config); err != nil {
			return nil, fmt.Errorf("could not set bucket lifecycle rule: %w", err)
		}
	}
	s := &server{
		minioClient: minioClient,
	}

	s.server = echo.New()
	s.server.HTTPErrorHandler = echoutils.HTTPErrorHandler(s.server)
	s.server.Use(sentryecho.New(sentryecho.Options{}))
	s.server.GET("/api/v1/health", s.handleHealth)
	s.server.HEAD("/api/v1/health", s.handleHealth)
	s.server.POST("/api/v1/file/upload", s.handleUploadImage)
	return s, nil
}

type publicFile struct {
	FileName  string `json:"fileName"`
	PublicURL string `json:"publicURL"`
	Extension string `json:"extension"`
}

func (s *server) handleUploadImage(c echo.Context) error {
	// Maximum of 10MB
	if err := c.Request().ParseMultipartForm(10 << 20); err != nil {
		return fmt.Errorf("could not parse form: %w", err)
	}
	outFiles := []publicFile{}
	for _, files := range c.Request().MultipartForm.File {
		for i := range files {
			file, err := files[i].Open()
			if err != nil {
				return fmt.Errorf("could not open file: %w", err)
			}
			fileContent, err := ioutil.ReadAll(file)
			if err != nil {
				return fmt.Errorf("could not read file: %w", err)
			}
			defer file.Close()
			mimeType, err := filetype.Match(fileContent)
			if err != nil {
				return fmt.Errorf("could not detect mime-type: %w", err)
			}
			if mimeType.MIME.Value != "application/pdf" && mimeType.MIME.Value != "image/png" && mimeType.MIME.Value != "video/webm" {
				return fmt.Errorf("not allowed mime-type: %s", files[i].Filename)
			}
			fileExtension := filepath.Ext(files[i].Filename)
			objectName := uuid.New().String() + fileExtension
			if _, err := s.minioClient.PutObject(context.Background(), BUCKET_NAME, objectName, bytes.NewBuffer(fileContent), files[i].Size, minio.PutObjectOptions{
				ContentType: mimeType.MIME.Value,
			}); err != nil {
				return fmt.Errorf("could not put object: %w", err)
			}
			publicURL, err := s.minioClient.PresignedGetObject(context.Background(), BUCKET_NAME, objectName, time.Minute*10, url.Values{})
			if err != nil {
				return fmt.Errorf("could not generate public URL: %w", err)
			}
			outFiles = append(outFiles, publicFile{
				Extension: fileExtension,
				FileName:  files[i].Filename,
				PublicURL: publicURL.EscapedPath() + "?" + publicURL.RawQuery,
			})
		}
	}
	return c.JSON(http.StatusCreated, outFiles)
}

func (s *server) handleHealth(c echo.Context) error {
	return c.String(http.StatusOK, "OK")
}

func (s *server) ListenAndServe() error {
	return s.server.Start(fmt.Sprintf(":%s", os.Getenv("FILE_HTTP_PORT")))
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
