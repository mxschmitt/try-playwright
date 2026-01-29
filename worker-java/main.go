package main

import (
	"fmt"
	"log"
	"os"
	"os/exec"
	"path/filepath"
	"regexp"
	"strings"

	"github.com/mxschmitt/try-playwright/internal/worker"
)

var projectDir = "/home/pwuser/project/"
var findClassRegexp = regexp.MustCompile(`class (\w+) `)
var classPath = ""

func handler(w *worker.Worker, code string) error {
	basePath := filepath.Join(projectDir, "org", "example")
	if err := os.MkdirAll(basePath, 0755); err != nil {
		return fmt.Errorf("could not create execution sub folder: %v", err)
	}
	matches := findClassRegexp.FindStringSubmatch(code)
	if len(matches) < 2 {
		return fmt.Errorf("could not determine class name")
	}
	className := matches[1]
	sourceFile := filepath.Join(basePath, fmt.Sprintf("%s.java", className))
	if err := os.WriteFile(sourceFile, []byte(code), 0644); err != nil {
		return fmt.Errorf("could not write Java source files: %v", err)
	}
	if err := w.ExecCommand("javac", "-proc:none", "--class-path", classPath, sourceFile); err != nil {
		return fmt.Errorf("could not compile: %w", err)
	}
	return w.ExecCommand("java", "--class-path", classPath, filepath.Join("org", "example", className))
}

const NEW_LINE_SEPARATOR = "\n"

func transformOutput(input string) string {
	forbiddenLines := []string{
		"WARNING: An illegal reflective access operation has occurred",
		"WARNING: Illegal reflective access by com.google.gson.internal.reflect.UnsafeReflectionAccessor (file:/home/pwuser/.m2/repository/com/google/code/gson/gson/2.8.6/gson-2.8.6.jar) to field java.util.Optional.value",
		"WARNING: Please consider reporting this to the maintainers of com.google.gson.internal.reflect.UnsafeReflectionAccessor",
		"WARNING: Use --illegal-access=warn to enable warnings of further illegal reflective access operations",
		"WARNING: All illegal access operations will be denied in a future release",
	}
	lines := strings.Split(input, NEW_LINE_SEPARATOR)
	out := []string{}
	for _, line := range lines {
		lineIsOk := true
		for _, forbidenLine := range forbiddenLines {
			if forbidenLine == line {
				lineIsOk = false
				break
			}
		}
		if lineIsOk {
			out = append(out, line)
		}
	}
	return worker.DefaultTransformOutput(strings.Join(out, NEW_LINE_SEPARATOR))
}

func main() {
	mavenClassesOutput, err := exec.Command("bash", "-c", "find ~/.m2 -name *.jar | sed -z 's/\\n/:/g'").Output()
	if err != nil {
		log.Fatalf("could not determine Java class-path: %v", err)
	}
	classPath = fmt.Sprintf("%s./", mavenClassesOutput)

	worker.NewWorker(&worker.WorkerExecutionOptions{
		Handler:            handler,
		ExecutionDirectory: projectDir,
		TransformOutput:    transformOutput,
	}).Run()
}
