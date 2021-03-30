package main

import (
	"fmt"
	"io/ioutil"
	"os"
	"path/filepath"

	"github.com/mxschmitt/try-playwright/internal/worker"
)

func handler(w *worker.Worker, code string) error {
	basePath := filepath.Join(w.TmpDir, "src", "main", "java", "org", "example")
	if err := os.MkdirAll(basePath, 0755); err != nil {
		return fmt.Errorf("could not create execution sub folder: %v", err)
	}

	if err := copyFile("/home/pwuser/pom.xml", filepath.Join(w.TmpDir, "pom.xml")); err != nil {
		return fmt.Errorf("could not copy pom.xml: %v", err)
	}
	if err := os.WriteFile(filepath.Join(basePath, "Execution.java"), []byte(code), 0644); err != nil {
		return fmt.Errorf("could not write Java source files: %v", err)
	}
	return w.ExecCommand("mvn", "compile", "exec:java", "-q", "-D", "exec.mainClass=org.example.Execution")
}

func copyFile(src, dst string) error {
	input, err := ioutil.ReadFile(src)
	if err != nil {
		return fmt.Errorf("could not read file: %w", err)
	}

	err = ioutil.WriteFile(dst, input, 0644)
	if err != nil {
		return fmt.Errorf("could not write file: %w", err)
	}
	return nil
}

func main() {
	worker.NewWorker(handler).Run()
}
