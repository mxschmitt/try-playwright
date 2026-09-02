package main

import (
	"fmt"
	"strings"

	"github.com/mxschmitt/try-playwright/internal/workertypes"
)

func parseWorkerLanguages(value string) ([]workertypes.WorkerLanguage, error) {
	if strings.TrimSpace(value) == "" {
		return append([]workertypes.WorkerLanguage(nil), workertypes.SUPPORTED_LANGUAGES...), nil
	}

	languages := make([]workertypes.WorkerLanguage, 0)
	seen := map[workertypes.WorkerLanguage]bool{}
	for _, item := range strings.Split(value, ",") {
		language := workertypes.WorkerLanguage(strings.TrimSpace(item))
		if !language.IsValid() {
			return nil, fmt.Errorf("invalid language in 'WORKER_LANGUAGES': %q", language)
		}
		if seen[language] {
			return nil, fmt.Errorf("duplicate language in 'WORKER_LANGUAGES': %q", language)
		}
		seen[language] = true
		languages = append(languages, language)
	}
	return languages, nil
}
