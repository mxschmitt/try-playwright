package main

import (
	"io"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"github.com/mxschmitt/try-playwright/internal/workertypes"
)

func TestApplyWorkerEventLogAndDone(t *testing.T) {
	s := newRunSession("run-1")
	applyWorkerEvent(s, []byte(`{"type":"log","line":"hello"}`))
	applyWorkerEvent(s, []byte(`{"type":"done","success":true,"output":"hello","version":"1.2.3","files":[]}`))
	<-s.finished
	payload, timedOut := s.Result()
	if timedOut {
		t.Fatal("timed out")
	}
	if payload.Output != "hello" || !payload.Success || payload.Version != "1.2.3" {
		t.Fatalf("payload %+v", payload)
	}
}

func TestHandleLogWatchSSE(t *testing.T) {
	srv := &server{runs: newRunHub()}
	srv.initializeHttpServer()
	ts := httptest.NewServer(srv.echo)
	t.Cleanup(ts.Close)

	session := newRunSession("abc")
	srv.runs.Put("abc", session)

	go func() {
		time.Sleep(20 * time.Millisecond)
		session.AppendLog("early")
		session.Complete(&workertypes.WorkerResponsePayload{
			Success: true,
			Output:  "early",
			Version: "1.0.0",
			Files:   []workertypes.File{},
		})
	}()

	resp, err := http.Get(ts.URL + "/service/control/run/abc/log-watch")
	if err != nil {
		t.Fatal(err)
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		t.Fatalf("status %d", resp.StatusCode)
	}
	if ct := resp.Header.Get("Content-Type"); !strings.Contains(ct, "text/event-stream") {
		t.Fatalf("content-type %q", ct)
	}

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		t.Fatal(err)
	}
	text := string(body)
	if !strings.Contains(text, ": connected") {
		t.Fatalf("missing connected comment: %s", text)
	}
	if !strings.Contains(text, "event: log") || !strings.Contains(text, `"line":"early"`) {
		t.Fatalf("missing log event: %s", text)
	}
	if !strings.Contains(text, "event: done") {
		t.Fatalf("missing done event: %s", text)
	}
}

func TestHandleRunAcceptedWithoutJSONWait(t *testing.T) {
	workers := &Workers{workers: make(chan *Worker, 1)}
	s := &server{
		workers: map[workertypes.WorkerLanguage]*Workers{
			workertypes.WorkerLanguageJavaScript: workers,
		},
		runs: newRunHub(),
	}
	s.initializeHttpServer()
	ts := httptest.NewServer(s.echo)
	t.Cleanup(ts.Close)

	req, err := http.NewRequest(http.MethodPost, ts.URL+"/service/control/run", strings.NewReader(`{"code":"console.log(1)","language":"javascript"}`))
	if err != nil {
		t.Fatal(err)
	}
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Accept", "text/event-stream")
	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		t.Fatal(err)
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusServiceUnavailable {
		body, _ := io.ReadAll(resp.Body)
		t.Fatalf("status %d want 503 (no worker), body %s", resp.StatusCode, body)
	}
}

func TestWantsJSONWait(t *testing.T) {
	if !wantsJSONWait("") || !wantsJSONWait("*/*") || !wantsJSONWait("application/json") {
		t.Fatal("expected JSON wait")
	}
	if wantsJSONWait("text/event-stream") {
		t.Fatal("event-stream should not wait")
	}
}

func TestLogWatchUnknownRun(t *testing.T) {
	srv := &server{runs: newRunHub()}
	srv.initializeHttpServer()
	ts := httptest.NewServer(srv.echo)
	t.Cleanup(ts.Close)
	resp, err := http.Get(ts.URL + "/service/control/run/missing/log-watch")
	if err != nil {
		t.Fatal(err)
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusNotFound {
		t.Fatalf("status %d", resp.StatusCode)
	}
}

func TestApplyWorkerEventLegacyPayload(t *testing.T) {
	s := newRunSession("legacy")
	applyWorkerEvent(s, []byte(`{"success":true,"output":"2","version":"1.2.3","files":[]}`))
	select {
	case <-s.finished:
	case <-time.After(time.Second):
		t.Fatal("legacy payload did not complete session")
	}
	payload, _ := s.Result()
	if payload.Output != "2" {
		t.Fatalf("payload %+v", payload)
	}
}
