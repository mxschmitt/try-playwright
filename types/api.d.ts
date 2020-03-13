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
  version: string;
  duration: number;
  files: FileWrapper[];
  logs: LogEntry[];
}