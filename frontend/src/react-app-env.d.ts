/// <reference types="react-scripts" />

declare module '*.txt' {
  export default string;
}

interface Window {
  gtag?: (kind: string, event: string, metaData: Record<string, string>) => void
}
