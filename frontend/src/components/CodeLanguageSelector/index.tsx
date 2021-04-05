import { useContext } from "react";
import { SelectPicker } from "rsuite";
import { CodeLanguage } from "../../constants";
import { CodeContext } from "../CodeContext";


const data = [
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
    "label": "C#",
    "value": CodeLanguage.CSHARP,
  },
]

const CodeLanguageSelector: React.FC = () => {
  const { codeLanguage, onLanguageChange } = useContext(CodeContext)
    return (
        <SelectPicker
            data={data}
            style={{ width: 120 }}
            searchable={false}
            cleanable={false}
            onChange={onLanguageChange}
            value={codeLanguage}
        />
    )
}

export default CodeLanguageSelector