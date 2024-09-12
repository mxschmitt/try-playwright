package main

import (
	"fmt"
	"os"
	"path/filepath"
	"strings"

	"github.com/mxschmitt/try-playwright/internal/worker"
)

const TYPESCRIPT_MAGIC_SUFFIX = "/*use-ts-node*/"

func handler(w *worker.Worker, code string) error {
	w.AddEnv("NODE_OPTIONS", "--unhandled-rejections=strict")
	if strings.Contains(code, "@playwright/test") {
		testPath := filepath.Join(w.TmpDir, "example.spec.ts")
		if err := os.WriteFile(testPath, []byte(code), 0644); err != nil {
			return fmt.Errorf("failed to write test file: %w", err)
		}
		return w.ExecCommand("node", "/usr/lib/node_modules/@playwright/test/cli.js", "test", "--trace=on", testPath)
	}
	if strings.HasSuffix(code, TYPESCRIPT_MAGIC_SUFFIX) {
		return w.ExecCommand("ts-node", `--compilerOptions='{"isolatedModules": false}'`, "-e", strings.TrimSuffix(code, TYPESCRIPT_MAGIC_SUFFIX))
	}
	return w.ExecCommand("node", "-e", code)
}

func main() {
	worker.NewWorker(&worker.WorkerExectionOptions{
		Handler: handler,
		IgnoreFilePatterns: []string{"**/*.last-run.json", "**/.playwright-artifacts-*/**"},
	}).Run()
}
