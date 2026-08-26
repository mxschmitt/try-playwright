package worker

import (
	"errors"
	"strings"
	"testing"

	amqp "github.com/rabbitmq/amqp091-go"
)

func TestReadDeliveryClosedChannel(t *testing.T) {
	incoming := make(chan amqp.Delivery)
	close(incoming)

	_, err := readDelivery(incoming)
	if !errors.Is(err, errAMQPChannelClosed) {
		t.Fatalf("expected errAMQPChannelClosed, got %v", err)
	}
	if strings.Contains(err.Error(), "unexpected end of JSON input") {
		t.Fatalf("closed delivery channel was treated as a JSON payload: %v", err)
	}
}

func TestReadDeliveryReturnsMessage(t *testing.T) {
	incoming := make(chan amqp.Delivery, 1)
	incoming <- amqp.Delivery{Body: []byte(`{"code":"x"}`)}

	msg, err := readDelivery(incoming)
	if err != nil {
		t.Fatal(err)
	}
	if string(msg.Body) != `{"code":"x"}` {
		t.Fatalf("unexpected body %q", msg.Body)
	}
}
