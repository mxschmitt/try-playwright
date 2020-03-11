type LogMode = "log" | "error"

interface LogEntry {
  mode: LogMode;
  args: string[];
}

interface FileWrapper {
  publicURL: string;
  filename?: string;
  extension: string;
}

interface APIResponse {
  files: FileWrapper[];
  logs: LogEntry[];
}