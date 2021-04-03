package main

import (
	"fmt"
	"os"
	"path/filepath"

	"github.com/mxschmitt/try-playwright/internal/worker"
)

var projectDir = "/home/pwuser/project/"

func handler(w *worker.Worker, code string) error {
	if err := os.WriteFile(filepath.Join(projectDir, "Program.cs"), []byte(code), 0644); err != nil {
		return fmt.Errorf("could not write source files: %v", err)
	}
	return w.ExecCommand("dotnet", "run", "--no-restore")
}

func main() {
	worker.NewWorker(handler, projectDir).Run()
}
