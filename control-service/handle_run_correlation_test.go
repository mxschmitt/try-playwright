package main

import (
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/http/httptest"
	"strings"
	"sync"
	"testing"
	"time"

	"github.com/mxschmitt/try-playwright/internal/workertypes"
)

// fakeAggregator mirrors log-aggregator: POST /logs keyed by testId, GET /logs/{testId}.
func startFakeAggregator(t *testing.T) *httptest.Server {
	t.Helper()
	var mu sync.Mutex
	byID := map[string][]string{}
	mux := http.NewServeMux()
	mux.HandleFunc("/logs", func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodPost {
			w.WriteHeader(http.StatusMethodNotAllowed)
			return
		}
		var p struct {
			TestID  string `json:"testId"`
			Message string `json:"message"`
		}
		if err := json.NewDecoder(r.Body).Decode(&p); err != nil {
			http.Error(w, err.Error(), http.StatusBadRequest)
			return
		}
		mu.Lock()
		byID[p.TestID] = append(byID[p.TestID], p.Message)
		mu.Unlock()
		w.WriteHeader(http.StatusAccepted)
	})
	mux.HandleFunc("/logs/", func(w http.ResponseWriter, r *http.Request) {
		id := strings.TrimPrefix(r.URL.Path, "/logs/")
		mu.Lock()
		msgs := append([]string(nil), byID[id]...)
		mu.Unlock()
		w.Header().Set("Content-Type", "text/plain")
		for _, m := range msgs {
			fmt.Fprintf(w, "%s\n", m)
		}
	})
	return httptest.NewServer(mux)
}

func newRunTestServer(t *testing.T) *httptest.Server {
	t.Helper()
	s := &server{
		workers: map[workertypes.WorkerLanguage]*Workers{
			workertypes.WorkerLanguageJavaScript: {workers: make(chan *Worker)},
		},
	}
	s.initializeHttpServer()
	return httptest.NewServer(s.echo)
}

func postRun(t *testing.T, runURL, headerTestID, body string) *http.Response {
	t.Helper()
	req, err := http.NewRequest(http.MethodPost, runURL+"/service/control/run", strings.NewReader(body))
	if err != nil {
		t.Fatal(err)
	}
	req.Header.Set("Content-Type", "application/json")
	if headerTestID != "" {
		req.Header.Set("X-Test-ID", headerTestID)
	}
	client := &http.Client{Timeout: 30 * time.Second}
	resp, err := client.Do(req)
	if err != nil {
		t.Fatal(err)
	}
	return resp
}

func aggregatorLogs(t *testing.T, aggURL, testID string) string {
	t.Helper()
	resp, err := http.Get(aggURL + "/logs/" + testID)
	if err != nil {
		t.Fatal(err)
	}
	defer resp.Body.Close()
	b, err := io.ReadAll(resp.Body)
	if err != nil {
		t.Fatal(err)
	}
	return string(b)
}

func TestHandleRunPostsAggregatorLogsUnderJSONTestID(t *testing.T) {
	agg := startFakeAggregator(t)
	t.Cleanup(agg.Close)
	t.Setenv("LOG_AGGREGATOR_ENABLED", "true")
	t.Setenv("LOG_AGGREGATOR_URL", agg.URL)
	t.Setenv("TURNSTILE_SECRET_KEY", "")

	run := newRunTestServer(t)
	t.Cleanup(run.Close)

	const playwrightID = "visual-pw-test-id"
	const headerID = "from-x-test-id-header"

	resp := postRun(t, run.URL, headerID, `{"code":"console.log(1)","language":"javascript","testId":"`+playwrightID+`"}`)
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusServiceUnavailable {
		body, _ := io.ReadAll(resp.Body)
		t.Fatalf("status %d want 503 (worker timeout), body %s", resp.StatusCode, body)
	}
	var payload struct {
		TestID string `json:"testId"`
		Error  string `json:"error"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&payload); err != nil {
		t.Fatal(err)
	}
	if payload.TestID != playwrightID {
		t.Fatalf("response testId %q want %q", payload.TestID, playwrightID)
	}

	got := aggregatorLogs(t, agg.URL, playwrightID)
	if !strings.Contains(got, "Obtaining worker") && !strings.Contains(got, "Got Worker timeout") {
		t.Fatalf("no control logs under Playwright test id %q; got %q", playwrightID, got)
	}
	if leaked := aggregatorLogs(t, agg.URL, headerID); strings.TrimSpace(leaked) != "" {
		t.Fatalf("logs were stored under X-Test-ID %q (pre-fix behavior): %q", headerID, leaked)
	}
}
