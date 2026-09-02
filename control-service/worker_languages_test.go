package main

import (
	"reflect"
	"testing"

	"github.com/mxschmitt/try-playwright/internal/workertypes"
)

func TestParseWorkerLanguages(t *testing.T) {
	tests := []struct {
		name    string
		value   string
		want    []workertypes.WorkerLanguage
		wantErr bool
	}{
		{
			name:  "defaults to all supported languages",
			value: "",
			want:  workertypes.SUPPORTED_LANGUAGES,
		},
		{
			name:  "selects one language",
			value: "javascript",
			want:  []workertypes.WorkerLanguage{workertypes.WorkerLanguageJavaScript},
		},
		{
			name:  "trims comma-separated languages",
			value: " python, java ",
			want: []workertypes.WorkerLanguage{
				workertypes.WorkerLanguagePython,
				workertypes.WorkerLanguageJava,
			},
		},
		{
			name:    "rejects an unsupported language",
			value:   "javascript,ruby",
			wantErr: true,
		},
		{
			name:    "rejects a duplicate language",
			value:   "javascript,javascript",
			wantErr: true,
		},
	}

	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			got, err := parseWorkerLanguages(test.value)
			if test.wantErr {
				if err == nil {
					t.Fatal("parseWorkerLanguages() did not return an error")
				}
				return
			}
			if err != nil {
				t.Fatalf("parseWorkerLanguages() returned an error: %v", err)
			}
			if !reflect.DeepEqual(got, test.want) {
				t.Fatalf("parseWorkerLanguages() = %v, want %v", got, test.want)
			}
		})
	}
}
