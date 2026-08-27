package worker

import (
	"errors"
	"testing"

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
	if !errors.Is(err, errAMQPChannelClosed) {
		t.Fatalf("expected errAMQPChannelClosed, got %v", err)
	}
}
