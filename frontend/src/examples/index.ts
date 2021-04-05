import { CodeLanguage } from "../constants"
import javaScriptExamples from './javascript'

interface MetaExample {
  id: string;
  title: string;
  description?: string;
}

export interface Example extends MetaExample {
  code: string;
}

const injectCode = (language: CodeLanguage) => (example: MetaExample): Example => {
  const code = require(`!!raw-loader!./${language}/${example.id}.js`)
  return {
    ...example,
    code: code.default
  }
}

export const Examples: Record<CodeLanguage, Example[]> = {
  [CodeLanguage.CSHARP]: [].map(injectCode(CodeLanguage.CSHARP)),
  [CodeLanguage.JAVASCRIPT]: javaScriptExamples.map(injectCode(CodeLanguage.JAVASCRIPT)),
  [CodeLanguage.JAVA]: [].map(injectCode(CodeLanguage.JAVA)),
  [CodeLanguage.PYTHON]: [].map(injectCode(CodeLanguage.PYTHON)),
}
