/// <reference types="react-scripts" />

declare module '*.txt' {
  const src: string;
  export default src;
}

interface Window {
  gtag?: (kind: string, event: string, metaData: Record<string, string>) => void
}
