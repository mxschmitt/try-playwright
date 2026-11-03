import { useState } from 'react'
import CodeLanguageSelector from '.'
import { CodeLanguage } from '../../constants'

export const Python = () => {
  const [selected, setSelected] = useState<CodeLanguage | ''>('')
  return (
    <>
      <CodeLanguageSelector
        codeLanguage={CodeLanguage.PYTHON}
        onLanguageChange={language => setSelected(language)}
      />
      <form hidden>
        <input data-testid="selected-language" readOnly value={selected} />
      </form>
    </>
  )
}
