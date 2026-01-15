package logagg

import (
	"context"
	"strings"

	log "github.com/sirupsen/logrus"
)

// hook sends each logrus entry to the log-aggregator best-effort.
type hook struct{}

func NewHook() log.Hook {
	return &hook{}
}

func (h *hook) Levels() []log.Level {
	return log.AllLevels
}

func (h *hook) Fire(entry *log.Entry) error {
	if entry == nil {
		return nil
	}
	testID := getString(entry.Data, "testId")
	requestID := getString(entry.Data, "request-id")
	service := getString(entry.Data, "service")
	message := entry.Message
	if message == "" || testID == "" {
		return nil
	}
	Post(context.Background(), service, testID, requestID, message)
	return nil
}

func getString(m log.Fields, key string) string {
	if v, ok := m[key]; ok {
		if s, ok := v.(string); ok {
			return strings.TrimSpace(s)
		}
	}
	return ""
}
