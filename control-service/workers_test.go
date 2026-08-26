package main

import (
	"errors"
	"testing"
	"time"

	"github.com/mxschmitt/try-playwright/internal/workertypes"
	v1 "k8s.io/api/core/v1"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/client-go/kubernetes/fake"
)

func TestIsWorkerPodUsable(t *testing.T) {
	if !isWorkerPodUsable(v1.PodPending) || !isWorkerPodUsable(v1.PodRunning) {
		t.Fatal("pending and running pods should still be usable")
	}
	if isWorkerPodUsable(v1.PodFailed) || isWorkerPodUsable(v1.PodSucceeded) {
		t.Fatal("terminal worker pods should not be handed out")
	}
}

func TestTakeSkipsFailedWorker(t *testing.T) {
	failedPod := &v1.Pod{
		ObjectMeta: metav1.ObjectMeta{Name: "worker-failed", Namespace: K8_NAMESPACE_NAME},
		Status:     v1.PodStatus{Phase: v1.PodFailed},
	}
	runningPod := &v1.Pod{
		ObjectMeta: metav1.ObjectMeta{Name: "worker-running", Namespace: K8_NAMESPACE_NAME},
		Status:     v1.PodStatus{Phase: v1.PodRunning},
	}
	client := fake.NewSimpleClientset(failedPod, runningPod)

	pool := &Workers{
		language:    workertypes.WorkerLanguageJavaScript,
		k8ClientSet: client,
		workers:     make(chan *Worker, 2),
		desired:     1,
		stop:        make(chan struct{}),
		live:        2,
	}
	failed := &Worker{id: "failed", workers: pool, pod: failedPod}
	running := &Worker{id: "running", workers: pool, pod: runningPod}
	pool.workers <- failed
	pool.workers <- running

	got, err := pool.Take(2 * time.Second)
	if err != nil {
		t.Fatalf("Take returned error: %v", err)
	}
	if got.id != "running" {
		t.Fatalf("expected running worker, got %s", got.id)
	}
}

func TestTakeTimesOutWhenPoolEmpty(t *testing.T) {
	pool := &Workers{
		language: workertypes.WorkerLanguageJavaScript,
		workers:  make(chan *Worker),
		stop:     make(chan struct{}),
	}
	_, err := pool.Take(50 * time.Millisecond)
	if !errors.Is(err, errWorkerTimeout) {
		t.Fatalf("expected errWorkerTimeout, got %v", err)
	}
}
