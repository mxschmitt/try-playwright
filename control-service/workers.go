package main

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"log"
	"sync"
	"time"

	"github.com/davecgh/go-spew/spew"
	"github.com/streadway/amqp"
	v1 "k8s.io/api/core/v1"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/util/wait"
	"k8s.io/client-go/kubernetes"
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
		return nil, fmt.Errorf("could not consume replies: %w", err)
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
		for d := range msgs {
			log.Printf("received rpc callback, corr id: %v", d.CorrelationId)
			w.repliesMu.Lock()
			replyChan, ok := w.replies[d.CorrelationId]
			spew.Dump(w.replies)
			w.repliesMu.Unlock()
			if !ok {
				log.Printf("no reply channel exists for worker %s", d.CorrelationId)
				return
			}
			var reply *workerResponsePayload
			if err := json.Unmarshal(d.Body, &reply); err != nil {
				log.Printf("could not unmarshal reply json: %v", err)
				return
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

func (w *Workers) Get() *Worker {
	log.Println("trying to get a worker")
	worker := <-w.workers
	log.Printf("obtained worker %s", worker.getPodName())
	return worker
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
	workers *Workers
	pod     *v1.Pod
}

func newWorker(workers *Workers) (*Worker, error) {
	w := &Worker{
		workers: workers,
	}
	if err := w.createPod(); err != nil {
		return nil, fmt.Errorf("could not create pod: %w", err)
	}

	w.workers.repliesMu.Lock()
	w.workers.replies[w.getPodName()] = make(chan *workerResponsePayload, 1)
	w.workers.repliesMu.Unlock()
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
			RestartPolicy: v1.RestartPolicy(v1.PullNever),
			Containers: []v1.Container{
				{
					Name:  "worker",
					Image: "ghcr.io/mxschmitt/try-playwright/worker:a1",
					Env: []v1.EnvVar{
						{
							Name:  "AMQP_URL",
							Value: "amqp://rabbitmq:5672?heartbeat=5s",
						},
					},
					LivenessProbe: &v1.Probe{
						Handler: v1.Handler{
							Exec: &v1.ExecAction{
								Command: []string{"bash", "-c", `bash -c "[ -f /tmp/worker-ready ]"`},
							},
						},
					},
				},
			},
		},
	}, metav1.CreateOptions{})
	if err != nil {
		return fmt.Errorf("could not create pod: %w", err)
	}
	if err := waitForPodRunning(w.workers.k8ClientSet, K8_NAMESPACE_NAME, w.pod.Name, 10*time.Second); err != nil {
		return fmt.Errorf("could not wait for pod running: %w", err)
	}
	return nil
}

func (w *Worker) getPodName() string {
	return w.pod.Name
}

func (w *Worker) Publish(code string) error {
	msgBody, err := json.Marshal(map[string]string{
		"code": code,
	})
	if err != nil {
		return fmt.Errorf("could not marshal json: %v", err)
	}
	if err := w.workers.amqpChannel.Publish(
		"", // exchange
		fmt.Sprintf("rpc_queue_%s", w.getPodName()), // routing key
		false, // mandatory
		false, // immediate
		amqp.Publishing{
			ContentType:   "application/json",
			CorrelationId: w.getPodName(),
			ReplyTo:       w.workers.amqpReplyQueueName,
			Body:          msgBody,
		}); err != nil {
		return fmt.Errorf("could not publish message: %w", err)
	}
	return nil
}

func (w *Worker) Cleanup() error {
	if err := w.workers.k8ClientSet.CoreV1().Pods(K8_NAMESPACE_NAME).
		Delete(context.Background(), w.pod.Name, metav1.DeleteOptions{}); err != nil {
		return fmt.Errorf("could not delete pod: %w", err)
	}
	w.workers.repliesMu.Lock()
	delete(w.workers.replies, w.getPodName())
	w.workers.repliesMu.Unlock()
	return nil
}

func (w *Worker) Subscribe() <-chan *workerResponsePayload {
	w.workers.repliesMu.Lock()
	ch := w.workers.replies[w.getPodName()]
	w.workers.repliesMu.Unlock()
	return ch
}

// return a condition function that indicates whether the given pod is
// currently running
func isPodRunning(c kubernetes.Interface, podName, namespace string) wait.ConditionFunc {
	return func() (bool, error) {
		pod, err := c.CoreV1().Pods(namespace).Get(context.Background(), podName, metav1.GetOptions{})
		if err != nil {
			return false, err
		}
		log.Printf("check if pod is already running, status: %s", pod.Status.Phase)
		switch pod.Status.Phase {
		case v1.PodRunning:
			return true, nil
		case v1.PodFailed, v1.PodSucceeded:
			return false, errors.New("pod ran to completion")
		}
		return false, nil
	}
}

// Poll up to timeout seconds for pod to enter running state.
// Returns an error if the pod never enters the running state.
func waitForPodRunning(c kubernetes.Interface, namespace, podName string, timeout time.Duration) error {
	return wait.PollImmediate(time.Second, timeout, isPodRunning(c, podName, namespace))
}
