interface FileWrapper {
  publicURL: string;
  fileName?: string;
  extension: string;
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
  output: string;
}

type ExecutionResponse = ErroredExecutionResponse | SuccessExecutionResponse