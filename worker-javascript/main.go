package main

import (
	"github.com/mxschmitt/try-playwright/internal/worker"
)

func handler(w *worker.Worker, code string) error {
	return w.ExecCommand("node", "--unhandled-rejections=strict", "-e", code)
}

func main() {
	worker.NewWorker(&worker.WorkerExectionOptions{
		Handler: handler,
	}).Run()
}
