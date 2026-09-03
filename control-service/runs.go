package main

import (
	"encoding/json"
	"fmt"
	"net/http"
	"strings"
	"sync"
	"time"

	"github.com/labstack/echo/v5"
	"github.com/mxschmitt/try-playwright/internal/workertypes"
	log "github.com/sirupsen/logrus"
)

const runSessionTTL = 2 * time.Minute

type runEvent struct {
	Type  string
	Line  string
	Done  *workertypes.WorkerResponsePayload
	Error string
}

type runSession struct {
	id       string
	start    time.Time
	mu       sync.Mutex
	logs     []string
	done     *workertypes.WorkerResponsePayload
	timeout  bool
	fail     string
	subs     []chan runEvent
	finished chan struct{}
	once     sync.Once
}

func newRunSession(id string) *runSession {
	return &runSession{
		id:       id,
		start:    time.Now(),
		finished: make(chan struct{}),
	}
}

func (s *runSession) markFinished() {
	s.once.Do(func() { close(s.finished) })
}

func (s *runSession) AppendLog(line string) {
	ev := runEvent{Type: workertypes.WorkerEventLog, Line: line}
	s.mu.Lock()
	s.logs = append(s.logs, line)
	subs := append([]chan runEvent(nil), s.subs...)
	s.mu.Unlock()
	for _, ch := range subs {
		select {
		case ch <- ev:
		default:
		}
	}
}

func (s *runSession) Complete(payload *workertypes.WorkerResponsePayload) {
	if payload == nil {
		payload = &workertypes.WorkerResponsePayload{}
	}
	payload.Duration = time.Since(s.start).Milliseconds()
	payload.RequestID = s.id
	ev := runEvent{Type: workertypes.WorkerEventDone, Done: payload}
	s.mu.Lock()
	if s.done != nil || s.fail != "" {
		s.mu.Unlock()
		return
	}
	s.done = payload
	subs := s.subs
	s.subs = nil
	s.mu.Unlock()
	for _, ch := range subs {
		ch <- ev
		close(ch)
	}
	s.markFinished()
}

func (s *runSession) Fail(msg string) {
	payload := &workertypes.WorkerResponsePayload{
		Success:   false,
		Error:     msg,
		RequestID: s.id,
		Files:     []workertypes.File{},
	}
	payload.Duration = time.Since(s.start).Milliseconds()
	ev := runEvent{Type: "error", Error: msg, Done: payload}
	s.mu.Lock()
	if s.done != nil || s.fail != "" {
		s.mu.Unlock()
		return
	}
	s.fail = msg
	s.timeout = msg == "Execution timeout!"
	s.done = payload
	subs := s.subs
	s.subs = nil
	s.mu.Unlock()
	for _, ch := range subs {
		ch <- ev
		close(ch)
	}
	s.markFinished()
}

func (s *runSession) Subscribe() (<-chan runEvent, func()) {
	ch := make(chan runEvent, 256)
	s.mu.Lock()
	defer s.mu.Unlock()
	for _, line := range s.logs {
		ch <- runEvent{Type: workertypes.WorkerEventLog, Line: line}
	}
	if s.done != nil {
		if s.fail != "" {
			ch <- runEvent{Type: "error", Error: s.fail, Done: s.done}
		} else {
			ch <- runEvent{Type: workertypes.WorkerEventDone, Done: s.done}
		}
		close(ch)
		return ch, func() {}
	}
	s.subs = append(s.subs, ch)
	return ch, func() {
		s.mu.Lock()
		defer s.mu.Unlock()
		filtered := s.subs[:0]
		for _, existing := range s.subs {
			if existing != ch {
				filtered = append(filtered, existing)
			}
		}
		s.subs = filtered
		select {
		case <-ch:
		default:
		}
	}
}

func (s *runSession) Result() (*workertypes.WorkerResponsePayload, bool) {
	s.mu.Lock()
	defer s.mu.Unlock()
	return s.done, s.timeout
}

type runHub struct {
	mu       sync.Mutex
	sessions map[string]*runSession
}

func newRunHub() *runHub {
	return &runHub{sessions: map[string]*runSession{}}
}

func (h *runHub) Put(id string, s *runSession) {
	h.mu.Lock()
	h.sessions[id] = s
	h.mu.Unlock()
}

func (h *runHub) Get(id string) *runSession {
	h.mu.Lock()
	defer h.mu.Unlock()
	return h.sessions[id]
}

func (h *runHub) Delete(id string) {
	h.mu.Lock()
	delete(h.sessions, id)
	h.mu.Unlock()
}

func wantsJSONWait(accept string) bool {
	return !strings.Contains(accept, "text/event-stream")
}

func writeSSE(w http.ResponseWriter, event string, v any) error {
	body, err := json.Marshal(v)
	if err != nil {
		return err
	}
	if _, err := fmt.Fprintf(w, "event: %s\ndata: %s\n\n", event, body); err != nil {
		return err
	}
	flushSSE(w)
	return nil
}

func flushSSE(w http.ResponseWriter) {
	if f, ok := w.(http.Flusher); ok {
		f.Flush()
	}
}

func (s *server) handleLogWatch(c *echo.Context) error {
	id := c.Param("id")
	session := s.runs.Get(id)
	if session == nil {
		return c.NoContent(http.StatusNotFound)
	}

	resp := c.Response()
	resp.Header().Set("Content-Type", "text/event-stream")
	resp.Header().Set("Cache-Control", "no-cache")
	resp.Header().Set("Connection", "keep-alive")
	resp.Header().Set("X-Accel-Buffering", "no")
	resp.WriteHeader(http.StatusOK)
	if _, err := fmt.Fprintf(resp, ": connected\n\n"); err != nil {
		return err
	}
	flushSSE(resp)

	events, cancel := session.Subscribe()
	defer cancel()

	ticker := time.NewTicker(15 * time.Second)
	defer ticker.Stop()

	ctx := c.Request().Context()
	for {
		select {
		case <-ctx.Done():
			return nil
		case <-ticker.C:
			if _, err := fmt.Fprintf(resp, ": heartbeat\n\n"); err != nil {
				return err
			}
			flushSSE(resp)
		case ev, ok := <-events:
			if !ok {
				return nil
			}
			switch ev.Type {
			case workertypes.WorkerEventLog:
				if err := writeSSE(resp, "log", map[string]string{"line": ev.Line}); err != nil {
					return err
				}
			case workertypes.WorkerEventDone:
				if err := writeSSE(resp, "done", ev.Done); err != nil {
					return err
				}
				return nil
			case "error":
				if err := writeSSE(resp, "done", ev.Done); err != nil {
					return err
				}
				return nil
			}
		}
	}
}

func applyWorkerEvent(session *runSession, body []byte) {
	var evt workertypes.WorkerEvent
	if err := json.Unmarshal(body, &evt); err != nil {
		log.Printf("could not unmarshal worker event: %v", err)
		return
	}
	switch evt.Type {
	case workertypes.WorkerEventLog:
		session.AppendLog(evt.Line)
	case workertypes.WorkerEventDone, "":
		payload := evt.WorkerResponsePayload
		if payload == nil {
			payload = &workertypes.WorkerResponsePayload{}
			if err := json.Unmarshal(body, payload); err != nil {
				log.Printf("could not unmarshal done payload: %v", err)
				return
			}
		}
		session.Complete(payload)
	default:
		log.Printf("unknown worker event type %q", evt.Type)
	}
}
