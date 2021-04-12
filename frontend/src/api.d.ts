interface FileWrapper {
  publicURL: string;
  fileName?: string;
  extension: string;
}

type ExecutionResponse = Partial<{
  success: boolean
  error: string
  version: string;
  duration?: number;
  files: FileWrapper[];
  output: string;
}>
