import { CodeLanguage } from "../constants"
import javaScriptExamples from './javascript'
import javaExamples from './java'
import cSharpExamples from './csharp'
import pythonExamples from './python'

interface MetaExample {
  id: string;
  title: string;
  description?: string;
}

export interface Example extends MetaExample {
  code: string;
}

const injectCode = (language: CodeLanguage, extension: string) => (example: MetaExample): Example => {
  const code = require(`./${language}/${example.id}.${extension}`)
  return {
    ...example,
    code,
  }
}

export const Examples: Record<CodeLanguage, Example[]> = {
  [CodeLanguage.DOTNET]: cSharpExamples.map(injectCode(CodeLanguage.DOTNET, "cs")),
  [CodeLanguage.JAVASCRIPT]: javaScriptExamples.map(injectCode(CodeLanguage.JAVASCRIPT, "js")),
  [CodeLanguage.JAVA]: javaExamples.map(injectCode(CodeLanguage.JAVA, "java")),
  [CodeLanguage.PYTHON]: pythonExamples.map(injectCode(CodeLanguage.PYTHON, "py")),
}
