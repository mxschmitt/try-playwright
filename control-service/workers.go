package main

import (
	"context"
	"encoding/json"
	"fmt"
	"sync"

	log "github.com/sirupsen/logrus"

	"github.com/google/uuid"
	"github.com/streadway/amqp"
	v1 "k8s.io/api/core/v1"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/client-go/kubernetes"
	"k8s.io/utils/pointer"
)

type Workers struct {
	workers            chan *Worker
	amqpReplyQueueName string
	amqpChannel        *amqp.Channel
	k8ClientSet        kubernetes.Interface
	repliesMu          sync.Mutex
	replies            map[string]chan *workerResponsePayload
}

func newWorkers(workerCount int, k8ClientSet kubernetes.Interface, amqpReplyQueueName string, amqpChannel *amqp.Channel) (*Workers, error) {
	w := &Workers{
		replies:            make(map[string]chan *workerResponsePayload),
		k8ClientSet:        k8ClientSet,
		amqpReplyQueueName: amqpReplyQueueName,
		amqpChannel:        amqpChannel,
		workers:            make(chan *Worker, workerCount),
	}
	if err := w.consumeReplies(); err != nil {
		return nil, fmt.Errorf("could not consume replies: %w", err)
	}

	if err := w.AddWorkers(workerCount); err != nil {
		return nil, fmt.Errorf("could not add initial workers: %w", err)
	}
	return w, nil
}

func (w *Workers) consumeReplies() error {
	msgs, err := w.amqpChannel.Consume(
		w.amqpReplyQueueName, // queue
		"",                   // consumer
		true,                 // auto-ack
		false,                // exclusive
		false,                // no-local
		false,                // no-wait
		nil,                  // args
	)
	if err != nil {
		return fmt.Errorf("Failed to register a consumer: %w", err)
	}
	go func() {
		for msg := range msgs {
			log.Printf("received rpc callback, corr id: %v", msg.CorrelationId)
			w.repliesMu.Lock()
			replyChan, ok := w.replies[msg.CorrelationId]
			w.repliesMu.Unlock()
			if !ok {
				log.Printf("no reply channel exists for worker %s", msg.CorrelationId)
				continue
			}
			var reply *workerResponsePayload
			if err := json.Unmarshal(msg.Body, &reply); err != nil {
				log.Printf("could not unmarshal reply json: %v", err)
				continue
			}
			replyChan <- reply
		}
	}()
	return nil
}

func (w *Workers) AddWorkers(amount int) error {
	for i := 0; i < amount; i++ {
		worker, err := newWorker(w)
		if err != nil {
			return fmt.Errorf("could not create new worker: %w", err)
		}
		w.workers <- worker
	}
	return nil
}

func (w *Workers) GetCh() <-chan *Worker {
	return w.workers
}

func (w *Workers) Cleanup() error {
	close(w.workers)
	for worker := range w.workers {
		if err := worker.Cleanup(); err != nil {
			return fmt.Errorf("could not cleanup worker: %w", err)
		}
	}
	return nil
}

type Worker struct {
	id      string
	workers *Workers
	pod     *v1.Pod
}

func newWorker(workers *Workers) (*Worker, error) {
	w := &Worker{
		id:      uuid.New().String(),
		workers: workers,
	}

	w.workers.repliesMu.Lock()
	w.workers.replies[w.id] = make(chan *workerResponsePayload, 1)
	w.workers.repliesMu.Unlock()

	_, err := w.workers.amqpChannel.QueueDeclare(
		fmt.Sprintf("rpc_queue_%s", w.id), // name
		false,                             // durable
		true,                              // delete when unused
		false,                             // exclusive
		false,                             // noWait
		nil,                               // arguments
	)
	if err != nil {
		return nil, fmt.Errorf("could not declare worker queue: %w", err)
	}

	if err := w.createPod(); err != nil {
		return nil, fmt.Errorf("could not create pod: %w", err)
	}

	return w, nil
}

func (w *Worker) createPod() error {
	var err error
	w.pod, err = w.workers.k8ClientSet.CoreV1().Pods(K8_NAMESPACE_NAME).Create(context.Background(), &v1.Pod{
		ObjectMeta: metav1.ObjectMeta{
			GenerateName: "worker-",
			Labels: map[string]string{
				"pod-name": "nginx",
			},
		},
		Spec: v1.PodSpec{
			RestartPolicy: v1.RestartPolicy(v1.RestartPolicyNever),
			Containers: []v1.Container{
				{
					Name:  "worker",
					Image: "ghcr.io/mxschmitt/try-playwright/worker:a1",
					Env: []v1.EnvVar{
						{
							Name:  "WORKER_ID",
							Value: w.id,
						},
						{
							Name:  "AMQP_URL",
							Value: "amqp://rabbitmq:5672?heartbeat=5s",
						},
					},
				},
			},
		},
	}, metav1.CreateOptions{})
	if err != nil {
		return fmt.Errorf("could not create pod: %w", err)
	}
	return nil
}

func (w *Worker) Publish(code string) error {
	msgBody, err := json.Marshal(map[string]string{
		"code": code,
	})
	if err != nil {
		return fmt.Errorf("could not marshal json: %v", err)
	}
	if err := w.workers.amqpChannel.Publish(
		"",                                // exchange
		fmt.Sprintf("rpc_queue_%s", w.id), // routing key
		false,                             // mandatory
		false,                             // immediate
		amqp.Publishing{
			ContentType:   "application/json",
			CorrelationId: w.id,
			ReplyTo:       w.workers.amqpReplyQueueName,
			Body:          msgBody,
		}); err != nil {
		return fmt.Errorf("could not publish message: %w", err)
	}
	return nil
}

func (w *Worker) Cleanup() error {
	if err := w.workers.k8ClientSet.CoreV1().Pods(K8_NAMESPACE_NAME).
		Delete(context.Background(), w.pod.Name, metav1.DeleteOptions{
			GracePeriodSeconds: pointer.Int64Ptr(0),
		}); err != nil {
		return fmt.Errorf("could not delete pod: %w", err)
	}
	w.workers.repliesMu.Lock()
	delete(w.workers.replies, w.id)
	w.workers.repliesMu.Unlock()

	return nil
}

func (w *Worker) Subscribe() <-chan *workerResponsePayload {
	w.workers.repliesMu.Lock()
	ch := w.workers.replies[w.id]
	w.workers.repliesMu.Unlock()
	return ch
}
