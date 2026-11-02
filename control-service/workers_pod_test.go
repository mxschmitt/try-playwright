package main

import (
	"testing"

	"github.com/mxschmitt/try-playwright/internal/workertypes"
	v1 "k8s.io/api/core/v1"
)

func TestNewWorkerPodRestrictedSecurityContext(t *testing.T) {
	t.Setenv("WORKER_IMAGE_TAG", "test-tag")
	pod := newWorkerPod("worker-id", workertypes.WorkerLanguageJavaScript)

	if pod.GenerateName != "worker-javascript-" {
		t.Fatalf("generateName = %q", pod.GenerateName)
	}
	assertPodSecurityContext(t, pod.Spec.SecurityContext)

	if len(pod.Spec.Containers) != 1 {
		t.Fatalf("containers = %d, want 1", len(pod.Spec.Containers))
	}
	container := pod.Spec.Containers[0]
	if container.Image != "ghcr.io/mxschmitt/try-playwright/worker-javascript:test-tag" {
		t.Fatalf("image = %q", container.Image)
	}
	var workerID string
	for _, env := range container.Env {
		if env.Name == "WORKER_ID" {
			workerID = env.Value
		}
	}
	if workerID != "worker-id" {
		t.Fatalf("WORKER_ID = %q", workerID)
	}
	assertContainerSecurityContext(t, container.SecurityContext)
}

func assertPodSecurityContext(t *testing.T, sc *v1.PodSecurityContext) {
	t.Helper()
	if sc == nil {
		t.Fatal("pod securityContext is nil")
	}
	if sc.RunAsNonRoot == nil || !*sc.RunAsNonRoot {
		t.Fatal("pod runAsNonRoot is not true")
	}
	if sc.RunAsUser == nil || *sc.RunAsUser != pwuserUID {
		t.Fatalf("pod runAsUser = %v, want %d", sc.RunAsUser, pwuserUID)
	}
	if sc.RunAsGroup == nil || *sc.RunAsGroup != pwuserGID {
		t.Fatalf("pod runAsGroup = %v, want %d", sc.RunAsGroup, pwuserGID)
	}
	if sc.SeccompProfile == nil || sc.SeccompProfile.Type != v1.SeccompProfileTypeRuntimeDefault {
		t.Fatalf("pod seccompProfile = %#v", sc.SeccompProfile)
	}
}

func assertContainerSecurityContext(t *testing.T, sc *v1.SecurityContext) {
	t.Helper()
	if sc == nil {
		t.Fatal("container securityContext is nil")
	}
	if sc.RunAsNonRoot == nil || !*sc.RunAsNonRoot {
		t.Fatal("container runAsNonRoot is not true")
	}
	if sc.RunAsUser == nil || *sc.RunAsUser != pwuserUID {
		t.Fatalf("container runAsUser = %v, want %d", sc.RunAsUser, pwuserUID)
	}
	if sc.RunAsGroup == nil || *sc.RunAsGroup != pwuserGID {
		t.Fatalf("container runAsGroup = %v, want %d", sc.RunAsGroup, pwuserGID)
	}
	if sc.AllowPrivilegeEscalation == nil || *sc.AllowPrivilegeEscalation {
		t.Fatal("allowPrivilegeEscalation is not false")
	}
	if sc.Capabilities == nil || len(sc.Capabilities.Drop) != 1 || sc.Capabilities.Drop[0] != "ALL" {
		t.Fatalf("capabilities = %#v, want drop ALL", sc.Capabilities)
	}
	if len(sc.Capabilities.Add) != 0 {
		t.Fatalf("capabilities.add = %#v, want none", sc.Capabilities.Add)
	}
	if sc.SeccompProfile == nil || sc.SeccompProfile.Type != v1.SeccompProfileTypeRuntimeDefault {
		t.Fatalf("container seccompProfile = %#v", sc.SeccompProfile)
	}
}
