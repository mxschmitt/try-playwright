package main

import (
	"fmt"
	"os"
	"path/filepath"
	"regexp"
	"strings"

	"github.com/mxschmitt/try-playwright/internal/worker"
)

var projectDir = "/home/pwuser/project/"
var findClassRegexp = regexp.MustCompile(`class (\w+) `)

func handler(w *worker.Worker, code string) error {
	basePath := filepath.Join(projectDir, "src", "main", "java", "org", "example")
	if err := os.MkdirAll(basePath, 0755); err != nil {
		return fmt.Errorf("could not create execution sub folder: %v", err)
	}
	matches := findClassRegexp.FindStringSubmatch(code)
	if len(matches) < 2 {
		return fmt.Errorf("could not determine class name")
	}
	className := matches[1]
	if err := os.WriteFile(filepath.Join(basePath, fmt.Sprintf("%s.java", className)), []byte(code), 0644); err != nil {
		return fmt.Errorf("could not write Java source files: %v", err)
	}
	return w.ExecCommand("mvn", "compile", "exec:java", "-q", "--offline", "-D", fmt.Sprintf("exec.mainClass=org.example.%s", className))
}

const NEW_LINE_SEPARATOR = "\n"

func transformOutput(input string) string {
	forbiddenLines := []string{
		"WARNING: An illegal reflective access operation has occurred",
		"WARNING: Illegal reflective access by com.google.inject.internal.cglib.core.$ReflectUtils$1 (file:/usr/share/maven/lib/guice.jar) to method java.lang.ClassLoader.defineClass(java.lang.String,byte[],int,int,java.security.ProtectionDomain)",
		"WARNING: Please consider reporting this to the maintainers of com.google.inject.internal.cglib.core.$ReflectUtils$1",
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
	worker.NewWorker(&worker.WorkerExectionOptions{
		Handler:            handler,
		ExecutionDirectory: projectDir,
		TransformOutput:    transformOutput,
		IgnoreFilePatterns: []string{filepath.Join(projectDir, "target", "**")},
	}).Run()
}
