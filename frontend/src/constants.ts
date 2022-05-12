export enum CodeLanguage {
  JAVA = "java",
  JAVASCRIPT = "javascript",
  PLAYWRIGHT_TEST = "playwright-test",
  PYTHON = "python",
  DOTNET = "csharp",
}

export const CODE_LANG_2_MONACO_LANG: Record<CodeLanguage, string> = {
  [CodeLanguage.JAVA]: "java",
  [CodeLanguage.JAVASCRIPT]: "javascript",
  [CodeLanguage.PLAYWRIGHT_TEST]: "javascript",
  [CodeLanguage.PYTHON]: "python",
  [CodeLanguage.DOTNET]: "csharp",
}

export const LANGUAGES = Object.values(CodeLanguage)
