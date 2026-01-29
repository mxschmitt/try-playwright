package workertypes

import "slices"

type File struct {
	PublicURL string `json:"publicURL"`
	FileName  string `json:"fileName"`
	Extension string `json:"extension"`
}

type WorkerResponsePayload struct {
	Success  bool   `json:"success"`
	Error    string `json:"error"`
	Version  string `json:"version"`
	Duration int64  `json:"duration"`
	Files    []File `json:"files"`
	Output   string `json:"output"`
}

type WorkerRequestPayload struct {
	Token    string         `json:"token"`
	Code     string         `json:"code"`
	Language WorkerLanguage `json:"language"`
}

type WorkerLanguage string

const (
	WorkerLanguageJavaScript WorkerLanguage = "javascript"
	WorkerLanguageJava       WorkerLanguage = "java"
	WorkerLanguagePython     WorkerLanguage = "python"
	WorkerLanguageCSharp     WorkerLanguage = "csharp"
)

var SUPPORTED_LANGUAGES = []WorkerLanguage{
	WorkerLanguageJavaScript,
	WorkerLanguageJava,
	WorkerLanguagePython,
	WorkerLanguageCSharp,
}

func (givenLanguage WorkerLanguage) IsValid() bool {
	return slices.Contains(SUPPORTED_LANGUAGES, givenLanguage)
}
