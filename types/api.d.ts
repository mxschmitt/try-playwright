type LogMode = "log" | "error"

interface LogEntry {
  mode: LogMode;
  args: string[];
}

interface FileWrapper {
  publicURL: string;
  fileName?: string;
  extension: string;
}

interface BaseExecutionResponse {
  success: boolean;
}

type ErroredExecutionResponse = {
  success: false
  error: string
}

type SuccessExecutionResponse ={
  success: true
  version: string;
  duration?: number;
  files: FileWrapper[];
  logs: LogEntry[];
}

type ExecutionResponse = ErroredExecutionResponse | SuccessExecutionResponse