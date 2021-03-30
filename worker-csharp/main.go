package main

import (
	"fmt"
	"os"
	"path/filepath"

	"github.com/mxschmitt/try-playwright/internal/worker"
)

var projectDir = "/home/pwuser/project/"

func handler(w *worker.Worker, code string) error {
	w.TmpDir = projectDir
	if err := os.WriteFile(filepath.Join(projectDir, "Program.cs"), []byte(code), 0644); err != nil {
		return fmt.Errorf("could not write source files: %v", err)
	}
	return w.ExecCommand("dotnet", "run")
}

func main() {
	worker.NewWorker(handler).Run()
}
