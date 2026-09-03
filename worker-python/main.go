package main

import (
	"github.com/mxschmitt/try-playwright/internal/worker"
)

func handler(w *worker.Worker, code string) error {
	return w.ExecCommand("python", "-u", "-c", code)
}

func main() {
	worker.NewWorker(&worker.WorkerExecutionOptions{
		Handler: handler,
	}).Run()
}
