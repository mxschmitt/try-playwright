import { CodeLanguage } from "../constants"
import javaScriptExamples from './javascript'
import playwrightTestExamples from './playwright-test'
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

export const Examples: Record<CodeLanguage, Example[]> = {
  [CodeLanguage.DOTNET]: cSharpExamples,
  [CodeLanguage.JAVASCRIPT]: javaScriptExamples,
  [CodeLanguage.PLAYWRIGHT_TEST]: playwrightTestExamples,
  [CodeLanguage.JAVA]: javaExamples,
  [CodeLanguage.PYTHON]: pythonExamples,
}
