package main

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"time"
)

type TurnstileResponse struct {
    Success    bool     `json:"success"`
    ErrorCodes []string `json:"error-codes,omitempty"`
}

var turnStileHttpClient = &http.Client{Timeout: 15 * time.Second}

func ValidateTurnstile(ctx context.Context, token string, remoteIP string, secretKey string) error {
	if secretKey == "" {
		log.Printf("warning: Turnstile secretKey is empty, skipping validation")
		return nil
	}
	if remoteIP == "" {
		log.Printf("warning: Turnstile remoteIP is empty, skipping validation")
		return nil
	}
    if token == "" {
        return fmt.Errorf("no token provided")
    }
    requestBody, err := json.Marshal(map[string]string{
        "secret":   secretKey,
        "response": token,
        "remoteip": remoteIP,
    })
    if err != nil {
        return fmt.Errorf("failed to marshal request body: %w", err)
    }

    req, err := http.NewRequestWithContext(ctx, "POST", "https://challenges.cloudflare.com/turnstile/v0/siteverify", bytes.NewBuffer(requestBody))
    if err != nil {
        return fmt.Errorf("failed to create request: %w", err)
    }
    req.Header.Set("Content-Type", "application/json")

    resp, err := turnStileHttpClient.Do(req)
    if err != nil {
        return fmt.Errorf("failed to send request: %w", err)
    }
    defer resp.Body.Close()

    if resp.StatusCode != http.StatusOK {
        return fmt.Errorf("unexpected status code: %v", resp.StatusCode)
    }

    var result TurnstileResponse
    if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
        return fmt.Errorf("failed to parse response: %w", err)
    }

    if !result.Success {
        return fmt.Errorf("turnstile validation failed: %v", result.ErrorCodes)
    }

    return nil
}