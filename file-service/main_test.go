package main

import (
	"bytes"
	"encoding/json"
	"mime/multipart"
	"net/http"
	"net/http/httptest"
	"os"
	"strings"
	"testing"
)

// 1x1 transparent PNG.
var png1x1 = []byte{
	0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d,
	0x49, 0x48, 0x44, 0x52, 0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01,
	0x08, 0x06, 0x00, 0x00, 0x00, 0x1f, 0x15, 0xc4, 0x89, 0x00, 0x00, 0x00,
	0x0a, 0x49, 0x44, 0x41, 0x54, 0x78, 0x9c, 0x63, 0x00, 0x01, 0x00, 0x00,
	0x05, 0x00, 0x01, 0x0d, 0x0a, 0x2d, 0xb4, 0x00, 0x00, 0x00, 0x00, 0x49,
	0x45, 0x4e, 0x44, 0xae, 0x42, 0x60, 0x82,
}

func TestNewServerRequiresS3Env(t *testing.T) {
	t.Setenv("S3_ENDPOINT", "")
	t.Setenv("S3_ACCESS_KEY", "")
	t.Setenv("S3_SECRET_KEY", "")
	t.Setenv("FILE_SERVICE_SENTRY_DSN", "")

	_, err := newServer()
	if err == nil {
		t.Fatal("expected error when S3 env vars are missing")
	}
	if !strings.Contains(err.Error(), "S3_ENDPOINT") {
		t.Fatalf("unexpected error: %v", err)
	}
}

func TestUploadPNGAgainstRustFS(t *testing.T) {
	if os.Getenv("S3_ENDPOINT") == "" {
		t.Skip("S3_ENDPOINT is not set")
	}

	s, err := newServer()
	if err != nil {
		t.Fatalf("could not init server: %v", err)
	}

	healthReq := httptest.NewRequest(http.MethodGet, "/api/v1/health", nil)
	healthRec := httptest.NewRecorder()
	s.echo.ServeHTTP(healthRec, healthReq)
	if healthRec.Code != http.StatusOK {
		t.Fatalf("health status = %d, body = %s", healthRec.Code, healthRec.Body.String())
	}

	var body bytes.Buffer
	writer := multipart.NewWriter(&body)
	part, err := writer.CreateFormFile("file", "example.png")
	if err != nil {
		t.Fatal(err)
	}
	if _, err := part.Write(png1x1); err != nil {
		t.Fatal(err)
	}
	if err := writer.Close(); err != nil {
		t.Fatal(err)
	}

	req := httptest.NewRequest(http.MethodPost, "/api/v1/file/upload", &body)
	req.Header.Set("Content-Type", writer.FormDataContentType())
	rec := httptest.NewRecorder()
	s.echo.ServeHTTP(rec, req)
	if rec.Code != http.StatusCreated {
		t.Fatalf("upload status = %d, body = %s", rec.Code, rec.Body.String())
	}

	var files []publicFile
	if err := json.Unmarshal(rec.Body.Bytes(), &files); err != nil {
		t.Fatalf("could not decode upload response: %v", err)
	}
	if len(files) != 1 {
		t.Fatalf("expected 1 file, got %d", len(files))
	}
	if files[0].Extension != ".png" {
		t.Fatalf("extension = %q", files[0].Extension)
	}
	if !strings.HasPrefix(files[0].PublicURL, "/file-uploads/") {
		t.Fatalf("public URL is not path-style: %s", files[0].PublicURL)
	}
	if strings.Contains(files[0].PublicURL, "?") {
		t.Fatalf("public URL should not be presigned: %s", files[0].PublicURL)
	}

	getReq := httptest.NewRequest(http.MethodGet, files[0].PublicURL, nil)
	getRec := httptest.NewRecorder()
	s.echo.ServeHTTP(getRec, getReq)
	if getRec.Code != http.StatusOK {
		t.Fatalf("download status = %d, body = %s", getRec.Code, getRec.Body.String())
	}
	if ct := getRec.Header().Get("Content-Type"); ct != "image/png" {
		t.Fatalf("content-type = %q", ct)
	}
	if !bytes.Equal(getRec.Body.Bytes(), png1x1) {
		t.Fatalf("downloaded object did not round-trip, got %d bytes", getRec.Body.Len())
	}
}

func TestRejectsDisallowedMimeType(t *testing.T) {
	if os.Getenv("S3_ENDPOINT") == "" {
		t.Skip("S3_ENDPOINT is not set")
	}

	s, err := newServer()
	if err != nil {
		t.Fatalf("could not init server: %v", err)
	}

	var body bytes.Buffer
	writer := multipart.NewWriter(&body)
	part, err := writer.CreateFormFile("file", "notes.txt")
	if err != nil {
		t.Fatal(err)
	}
	if _, err := part.Write([]byte("hello")); err != nil {
		t.Fatal(err)
	}
	if err := writer.Close(); err != nil {
		t.Fatal(err)
	}

	req := httptest.NewRequest(http.MethodPost, "/api/v1/file/upload", &body)
	req.Header.Set("Content-Type", writer.FormDataContentType())
	rec := httptest.NewRecorder()
	s.echo.ServeHTTP(rec, req)
	if rec.Code == http.StatusCreated {
		t.Fatalf("expected rejected upload, got %d", rec.Code)
	}
}

func TestObjectNameRe(t *testing.T) {
	if !objectNameRe.MatchString("8cc1c45b-9f14-4d92-894d-4f4a62fc6691.png") {
		t.Fatal("expected uuid png to match")
	}
	for _, name := range []string{"../etc/passwd", "foo.png", "8cc1c45b-9f14-4d92-894d-4f4a62fc6691.txt", "8cc1c45b-9f14-4d92-894d-4f4a62fc6691.png/../x"} {
		if objectNameRe.MatchString(name) {
			t.Fatalf("did not expect %q to match", name)
		}
	}
}

func TestDownloadRejectsInvalidObjectName(t *testing.T) {
	if os.Getenv("S3_ENDPOINT") == "" {
		t.Skip("S3_ENDPOINT is not set")
	}

	s, err := newServer()
	if err != nil {
		t.Fatalf("could not init server: %v", err)
	}

	req := httptest.NewRequest(http.MethodGet, "/file-uploads/not-a-uuid.png", nil)
	rec := httptest.NewRecorder()
	s.echo.ServeHTTP(rec, req)
	if rec.Code != http.StatusBadRequest {
		t.Fatalf("status = %d, body = %s", rec.Code, rec.Body.String())
	}
}
