package main

import (
	"github.com/mxschmitt/try-playwright/internal/worker"
)

func handler(w *worker.Worker, code string) error {
	return w.ExecCommand("node", "-e", code)
}

func main() {
	worker.NewWorker(handler).Run()
}
