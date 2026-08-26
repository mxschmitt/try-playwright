package worker

import (
	"encoding/json"
	"errors"
	"fmt"
	"strings"
	"testing"

	"github.com/mxschmitt/try-playwright/internal/workertypes"
	amqp "github.com/rabbitmq/amqp091-go"
)

func TestConsumeMessageClosedDeliveryChannel(t *testing.T) {
	w := NewWorker(&WorkerExecutionOptions{
		Handler: func(worker *Worker, code string) error {
			t.Fatal("handler should not run when the delivery channel is closed")
			return nil
		},
	})

	incoming := make(chan amqp.Delivery)
	close(incoming)

	err := w.consumeMessage(incoming)
	if err == nil {
		t.Fatal("expected an error when the AMQP delivery channel is closed")
	}
	if !errors.Is(err, errAMQPChannelClosed) {
		t.Fatalf("expected errAMQPChannelClosed, got %v", err)
	}
	if strings.Contains(err.Error(), "unexpected end of JSON input") {
		t.Fatalf("closed delivery channel was treated as a JSON payload: %v", err)
	}
}

func TestIsRetryableAMQPError(t *testing.T) {
	if !isRetryableAMQPError(errAMQPChannelClosed) {
		t.Fatal("closed delivery channel should be retryable")
	}
	if !isRetryableAMQPError(fmt.Errorf("could not dial to amqp: connection refused")) {
		t.Fatal("dial failures should be retryable")
	}
	if isRetryableAMQPError(fmt.Errorf("could not parse incoming amqp message: unexpected end of JSON input")) {
		t.Fatal("JSON parse failures for a real delivery must not reconnect and re-execute")
	}
	if isRetryableAMQPError(fmt.Errorf("could not publish message: channel closed")) {
		t.Fatal("publish failures after execution must not reconnect and duplicate work")
	}
}

func TestConsumeMessageParsesValidRequestBeforePublish(t *testing.T) {
	var gotCode string
	w := NewWorker(&WorkerExecutionOptions{
		Handler: func(worker *Worker, code string) error {
			gotCode = code
			return nil
		},
	})

	body, err := json.Marshal(&workertypes.WorkerRequestPayload{
		Code:      "console.log(1)",
		RequestID: "req-1",
		TestID:    "test-1",
	})
	if err != nil {
		t.Fatal(err)
	}

	incoming := make(chan amqp.Delivery, 1)
	incoming <- amqp.Delivery{
		Body:          body,
		ReplyTo:       "reply",
		CorrelationId: "corr",
		Acknowledger:  nopAcknowledger{},
	}

	err = w.consumeMessage(incoming)
	if gotCode != "console.log(1)" {
		t.Fatalf("handler was not invoked with the request code, got %q (err=%v)", gotCode, err)
	}
	if w.requestID != "req-1" || w.testID != "test-1" {
		t.Fatalf("request metadata not applied: requestID=%q testID=%q", w.requestID, w.testID)
	}
}

type nopAcknowledger struct{}

func (nopAcknowledger) Ack(tag uint64, multiple bool) error { return nil }
func (nopAcknowledger) Nack(tag uint64, multiple bool, requeue bool) error {
	return nil
}
func (nopAcknowledger) Reject(tag uint64, requeue bool) error { return nil }
