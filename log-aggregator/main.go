package main

import (
	"encoding/json"
	"fmt"
	"io"
	"log"
	"net/http"
	"os"
	"strings"
	"sync"
	"time"
)

const (
	storeTTL           = 60 * time.Minute
	cleanupInterval    = 5 * time.Minute
	maxRequestBodySize = 1 << 20 // 1MB
)

type logEntry struct {
	ts        time.Time
	service   string
	requestID string
	message   string
}

type testLog struct {
	entries []logEntry
	expires time.Time
}

type store struct {
	mu    sync.Mutex
	items map[string]*testLog
}

func newStore() *store {
	return &store{
		items: make(map[string]*testLog),
	}
}

func (s *store) add(testID, requestID, service, message string) {
	s.mu.Lock()
	defer s.mu.Unlock()
	now := time.Now()
	tl, ok := s.items[testID]
	if !ok {
		tl = &testLog{}
		s.items[testID] = tl
	}
	lines := splitLines(message)
	for _, line := range lines {
		if strings.TrimSpace(line) == "" {
			continue
		}
		tl.entries = append(tl.entries, logEntry{
			ts:        now,
			service:   service,
			requestID: requestID,
			message:   line,
		})
	}
	tl.expires = now.Add(storeTTL)
}

func (s *store) get(testID string) []logEntry {
	s.mu.Lock()
	defer s.mu.Unlock()
	tl, ok := s.items[testID]
	if !ok {
		return nil
	}
	out := make([]logEntry, len(tl.entries))
	copy(out, tl.entries)
	return out
}

func (s *store) cleanupExpired() {
	for {
		time.Sleep(cleanupInterval)
		now := time.Now()
		s.mu.Lock()
		for k, v := range s.items {
			if v.expires.Before(now) {
				delete(s.items, k)
			}
		}
		s.mu.Unlock()
	}
}

type postPayload struct {
	TestID    string `json:"testId"`
	RequestID string `json:"requestId"`
	Service   string `json:"service"`
	Message   string `json:"message"`
}

func splitLines(s string) []string {
	// Normalize to \n then split.
	s = strings.ReplaceAll(s, "\r\n", "\n")
	return strings.Split(s, "\n")
}

func main() {
	log.SetOutput(os.Stdout)
	log.SetFlags(log.LstdFlags | log.Lmicroseconds)

	mem := newStore()
	go mem.cleanupExpired()

	mux := http.NewServeMux()

	mux.HandleFunc("/healthz", func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
		_, _ = w.Write([]byte("ok"))
	})

	mux.HandleFunc("/logs", func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodPost {
			w.WriteHeader(http.StatusMethodNotAllowed)
			return
		}
		r.Body = http.MaxBytesReader(w, r.Body, maxRequestBodySize)
		defer r.Body.Close()
		body, err := io.ReadAll(r.Body)
		if err != nil {
			http.Error(w, "could not read body", http.StatusBadRequest)
			return
		}
		var p postPayload
		if err := json.Unmarshal(body, &p); err != nil {
			http.Error(w, "could not parse json", http.StatusBadRequest)
			return
		}
		if strings.TrimSpace(p.TestID) == "" || strings.TrimSpace(p.Message) == "" {
			http.Error(w, "missing testId or message", http.StatusBadRequest)
			return
		}
		mem.add(p.TestID, p.RequestID, p.Service, p.Message)
		w.WriteHeader(http.StatusAccepted)
	})

	mux.HandleFunc("/logs/", func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodGet {
			w.WriteHeader(http.StatusMethodNotAllowed)
			return
		}
		testID := strings.TrimPrefix(r.URL.Path, "/logs/")
		if testID == "" {
			http.Error(w, "missing testId", http.StatusBadRequest)
			return
		}
		entries := mem.get(testID)
		w.Header().Set("Content-Type", "text/plain; charset=utf-8")
		for _, e := range entries {
			line := fmt.Sprintf("%s [%s] [request:%s] %s\n", e.ts.UTC().Format(time.RFC3339Nano), e.service, e.requestID, e.message)
			_, _ = w.Write([]byte(line))
		}
	})

	addr := ":8080"
	if fromEnv := os.Getenv("LOG_AGGREGATOR_PORT"); fromEnv != "" {
		addr = ":" + fromEnv
	}
	server := &http.Server{
		Addr:    addr,
		Handler: mux,
	}

	log.Printf("log-aggregator listening on %s", addr)
	if err := server.ListenAndServe(); err != nil && err != http.ErrServerClosed {
		log.Fatalf("could not start server: %v", err)
	}
}
