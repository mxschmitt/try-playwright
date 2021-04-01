package main

import (
	"fmt"
	"os"
	"path/filepath"
	"regexp"

	"github.com/mxschmitt/try-playwright/internal/worker"
)

var projectDir = "/home/pwuser/project/"
var findClassRegexp = regexp.MustCompile(`class (\w+) `)

func handler(w *worker.Worker, code string) error {
	w.TmpDir = projectDir
	basePath := filepath.Join(projectDir, "src", "main", "java", "org", "example")
	if err := os.MkdirAll(basePath, 0755); err != nil {
		return fmt.Errorf("could not create execution sub folder: %v", err)
	}
	matches := findClassRegexp.FindStringSubmatch(code)
	if len(matches) < 2 {
		return fmt.Errorf("could not determine class name")
	}
	className := matches[1]
	fmt.Println("got class name", matches)
	if err := os.WriteFile(filepath.Join(basePath, fmt.Sprintf("%s.java", className)), []byte(code), 0644); err != nil {
		return fmt.Errorf("could not write Java source files: %v", err)
	}
	return w.ExecCommand("mvn", "compile", "exec:java", "-q", "-D", "jdk.module.illegalAccess=deny", "-D", fmt.Sprintf("exec.mainClass=org.example.%s", className))
}

func main() {
	worker.NewWorker(handler).Run()
}
