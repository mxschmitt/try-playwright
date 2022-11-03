import { SelectPicker } from "rsuite";
import { CodeLanguage } from "../../constants";


const data = [
  {
    "label": "Playwright Test",
    "value": CodeLanguage.PLAYWRIGHT_TEST,
  },
  {
    "label": "JavaScript",
    "value": CodeLanguage.JAVASCRIPT,
  },
  {
    "label": "Python",
    "value": CodeLanguage.PYTHON,
  },
  {
    "label": "Java",
    "value": CodeLanguage.JAVA,
  },
  {
    "label": ".NET",
    "value": CodeLanguage.DOTNET,
  },
]

type CodeLanguageSelectorProps = {
  onLanguageChange: (newLanguage: CodeLanguage) => void;
  codeLanguage: CodeLanguage;
}

const CodeLanguageSelector: React.FC<CodeLanguageSelectorProps> = ({ onLanguageChange, codeLanguage }) => {
  return (
    <SelectPicker<CodeLanguage>
      data={data}
      style={{ width: 140 }}
      searchable={false}
      cleanable={false}
      onChange={value => {
        if (value)
          onLanguageChange(value)
      }}
      value={codeLanguage}
    />
  )
}

export default CodeLanguageSelector