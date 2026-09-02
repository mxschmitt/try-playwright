package main

import (
	"bytes"
	"context"
	"fmt"
	"io"
	"mime/multipart"
	"net/http"
	"net/url"
	"os"
	"os/signal"
	"path/filepath"
	"slices"
	"syscall"
	"time"

	"github.com/h2non/filetype"
	"github.com/mxschmitt/try-playwright/internal/echoutils"
	"github.com/mxschmitt/try-playwright/internal/logagg"
	log "github.com/sirupsen/logrus"

	"github.com/getsentry/sentry-go"

	sentryecho "github.com/getsentry/sentry-go/echo"
	"github.com/google/uuid"
	"github.com/labstack/echo/v5"
	"github.com/minio/minio-go/v7"
	"github.com/minio/minio-go/v7/pkg/credentials"
	"github.com/minio/minio-go/v7/pkg/lifecycle"
)

type server struct {
	echo       *echo.Echo
	httpServer *http.Server
	s3Client   *minio.Client
}

const BUCKET_NAME = "file-uploads"

var allowedMimeTypes = []string{
	"application/pdf",
	"image/png",
	"video/webm",
	"application/zip",
}

func newServer() (*server, error) {
	err := sentry.Init(sentry.ClientOptions{
		Dsn: os.Getenv("FILE_SERVICE_SENTRY_DSN"),
	})
	if err != nil {
		return nil, fmt.Errorf("could not init Sentry: %w", err)
	}
	endpoint := os.Getenv("S3_ENDPOINT")
	accessKey := os.Getenv("S3_ACCESS_KEY")
	secretKey := os.Getenv("S3_SECRET_KEY")
	if endpoint == "" || accessKey == "" || secretKey == "" {
		return nil, fmt.Errorf("S3_ENDPOINT, S3_ACCESS_KEY, and S3_SECRET_KEY must be set")
	}
	s3Client, err := minio.New(endpoint, &minio.Options{
		Creds:        credentials.NewStaticV4(accessKey, secretKey, ""),
		Secure:       false,
		BucketLookup: minio.BucketLookupPath,
	})
	if err != nil {
		return nil, fmt.Errorf("could not init S3 client: %w", err)
	}
	err = s3Client.MakeBucket(context.Background(), BUCKET_NAME, minio.MakeBucketOptions{})
	if err != nil {
		// Check to see if we already own this bucket (which happens if you run this twice)
		exists, errBucketExists := s3Client.BucketExists(context.Background(), BUCKET_NAME)
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
		if err := s3Client.SetBucketLifecycle(context.Background(), BUCKET_NAME, config); err != nil {
			return nil, fmt.Errorf("could not set bucket lifecycle rule: %w", err)
		}
	}
	s := &server{
		s3Client: s3Client,
	}

	s.echo = echo.New()
	s.echo.HTTPErrorHandler = echoutils.HTTPErrorHandler(s.echo)
	s.echo.Use(sentryecho.New(sentryecho.Options{}))
	s.echo.GET("/api/v1/health", s.handleHealth)
	s.echo.HEAD("/api/v1/health", s.handleHealth)
	s.echo.POST("/api/v1/file/upload", s.handleUploadImage)
	return s, nil
}

type publicFile struct {
	FileName  string `json:"fileName"`
	PublicURL string `json:"publicURL"`
	Extension string `json:"extension"`
}

func (s *server) handleUploadImage(c *echo.Context) error {
	requestID := c.Request().Header.Get("X-Request-ID")
	if requestID == "" {
		requestID = uuid.New().String()
	}
	testID := c.Request().Header.Get("X-Test-ID")
	if testID == "" {
		testID = requestID
	}
	requestScopedLogger := log.New()
	requestScopedLogger.SetFormatter(&log.JSONFormatter{
		TimestampFormat: time.RFC3339Nano,
		FieldMap: log.FieldMap{
			log.FieldKeyMsg: "message",
		},
	})
	requestScopedLogger.SetLevel(log.GetLevel())
	requestScopedLogger.SetOutput(os.Stdout)
	logger := requestScopedLogger.WithFields(log.Fields{
		"request-id": requestID,
		"testId":     testID,
		"service":    "file-service",
	})
	logger.Logger.AddHook(logagg.NewHook())

	// Maximum of 10MB
	if err := c.Request().ParseMultipartForm(10 << 20); err != nil {
		return fmt.Errorf("could not parse form: %w", err)
	}
	outFiles := []publicFile{}
	for _, files := range c.Request().MultipartForm.File {
		for i := range files {
			pf, err := s.processUploadedFile(c.Request().Context(), files[i])
			if err != nil {
				return err
			}
			logger.Infof("stored file %s", pf.FileName)
			outFiles = append(outFiles, pf)
		}
	}
	c.Response().Header().Set("X-Request-ID", requestID)
	c.Response().Header().Set("X-Test-ID", testID)
	return c.JSON(http.StatusCreated, outFiles)
}

func (s *server) processUploadedFile(ctx context.Context, fh *multipart.FileHeader) (publicFile, error) {
	file, err := fh.Open()
	if err != nil {
		return publicFile{}, fmt.Errorf("could not open file: %w", err)
	}
	defer file.Close()

	fileContent, err := io.ReadAll(file)
	if err != nil {
		return publicFile{}, fmt.Errorf("could not read file: %w", err)
	}

	mimeType, err := filetype.Match(fileContent)
	if err != nil {
		return publicFile{}, fmt.Errorf("could not detect mime-type: %w", err)
	}
	if !slices.Contains(allowedMimeTypes, mimeType.MIME.Value) {
		return publicFile{}, fmt.Errorf("not allowed mime-type (%s): %s", mimeType.MIME.Value, fh.Filename)
	}

	fileExtension := filepath.Ext(fh.Filename)
	objectName := uuid.New().String() + fileExtension
	if _, err := s.s3Client.PutObject(ctx, BUCKET_NAME, objectName, bytes.NewBuffer(fileContent), fh.Size, minio.PutObjectOptions{
		ContentType: mimeType.MIME.Value,
	}); err != nil {
		return publicFile{}, fmt.Errorf("could not put object: %w", err)
	}

	publicURL, err := s.s3Client.PresignedGetObject(ctx, BUCKET_NAME, objectName, time.Minute*10, url.Values{})
	if err != nil {
		return publicFile{}, fmt.Errorf("could not generate public URL: %w", err)
	}

	return publicFile{
		Extension: fileExtension,
		FileName:  fh.Filename,
		PublicURL: publicURL.EscapedPath() + "?" + publicURL.RawQuery,
	}, nil
}

func (s *server) handleHealth(c *echo.Context) error {
	return c.String(http.StatusOK, "OK")
}

func (s *server) ListenAndServe() error {
	s.httpServer = &http.Server{
		Addr:    fmt.Sprintf(":%s", os.Getenv("FILE_HTTP_PORT")),
		Handler: s.echo,
	}
	return s.httpServer.ListenAndServe()
}

func (s *server) Stop() error {
	return s.httpServer.Shutdown(context.Background())
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
