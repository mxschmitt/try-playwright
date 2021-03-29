package main

import (
	"github.com/mxschmitt/try-playwright/internal/worker"
)

func pythonHandler(w *worker.Worker, code string) error {
	return w.ExecCommand("python", "-c", code)
}

func main() {
	worker.NewWorker(pythonHandler).Run()
}
