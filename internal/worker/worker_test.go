package worker

import (
	"errors"
	"sync"
	"testing"
	"time"

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

func TestExecCommandStreamsLogsBeforeExit(t *testing.T) {
	w := NewWorker(&WorkerExecutionOptions{
		Handler: func(worker *Worker, code string) error { return nil },
	})
	w.TmpDir = t.TempDir()

	early := make(chan struct{})
	var once sync.Once
	w.onLog = func(line string) {
		if line == "early" {
			once.Do(func() { close(early) })
		}
	}

	done := make(chan error, 1)
	go func() {
		done <- w.ExecCommand("sh", "-c", "echo early; sleep 1; echo late")
	}()

	select {
	case <-early:
	case err := <-done:
		t.Fatalf("command finished before early log: %v", err)
	case <-time.After(3 * time.Second):
		t.Fatal("did not receive streamed log before command exit")
	}

	if err := <-done; err != nil {
		t.Fatalf("ExecCommand: %v", err)
	}
	if got := w.options.TransformOutput(w.output.String()); got != "early\nlate" {
		t.Fatalf("output %q", got)
	}
}
