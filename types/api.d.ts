type BrowserType = "chromium" | "firefox" | "webkit"

type LogMode = "log" | "error"

interface LogEntry {
  mode: LogMode
  args: string[]
}

interface FileWrapper {
  publicURL: string
  filename: string
  mimetype: string
}

interface APIResponse {
  files: FileWrapper[]
  logs: LogEntry[]
}