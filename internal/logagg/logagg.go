package logagg

import (
	"bytes"
	"context"
	"encoding/json"
	"net"
	"net/http"
	"os"
	"strings"
	"time"
)

var httpClient = &http.Client{
	Timeout: 3 * time.Second,
	Transport: &http.Transport{
		DialContext: (&net.Dialer{
			Timeout: 1 * time.Second,
		}).DialContext,
		TLSHandshakeTimeout:   1 * time.Second,
		ResponseHeaderTimeout: 2 * time.Second,
		IdleConnTimeout:       10 * time.Second,
		MaxIdleConns:          10,
		MaxIdleConnsPerHost:   2,
	},
}

type payload struct {
	TestID    string `json:"testId"`
	RequestID string `json:"requestId,omitempty"`
	Service   string `json:"service"`
	Message   string `json:"message"`
}

// Post sends logs to the log-aggregator if LOG_AGGREGATOR_URL is set.
// Best-effort: ignores errors and returns quickly.
func Post(ctx context.Context, service, testID, requestID, message string) {
	if os.Getenv("LOG_AGGREGATOR_ENABLED") != "true" {
		return
	}
	baseURL := strings.TrimSuffix(os.Getenv("LOG_AGGREGATOR_URL"), "/")
	if baseURL == "" || testID == "" || message == "" {
		return
	}
	ctx, cancel := context.WithTimeout(ctx, 2*time.Second)
	defer cancel()

	body, err := json.Marshal(payload{
		TestID:    testID,
		RequestID: requestID,
		Service:   service,
		Message:   message,
	})
	if err != nil {
		return
	}
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, baseURL+"/logs", bytes.NewReader(body))
	if err != nil {
		return
	}
	req.Header.Set("Content-Type", "application/json")

	resp, err := httpClient.Do(req)
	if err != nil {
		return
	}
	resp.Body.Close()
}

// DeferPost returns a function intended to be deferred so logs are sent at the end of a request.
// testID/requestID may be nil; the buffer is read at call-time.
func DeferPost(service string, testID, requestID *string, buf *bytes.Buffer) func() {
	return func() {
		if buf == nil {
			return
		}
		tid := ""
		rid := ""
		if testID != nil {
			tid = *testID
		}
		if requestID != nil {
			rid = *requestID
		}
		Post(context.Background(), service, tid, rid, buf.String())
	}
}
