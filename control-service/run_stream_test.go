package main

import (
	"encoding/json"
	"testing"
)

func TestRunHeartbeatJSONAllowsLeadingNewlines(t *testing.T) {
	var payload map[string]any
	if err := json.Unmarshal([]byte("\n\n{\"success\":true}\n"), &payload); err != nil {
		t.Fatalf("JSON.parse-equivalent decode failed after heartbeat newlines: %v", err)
	}
	if payload["success"] != true {
		t.Fatalf("unexpected payload: %#v", payload)
	}
}
