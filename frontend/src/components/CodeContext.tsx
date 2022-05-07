import { useState, useEffect, createContext } from 'react'
import { CodeLanguage } from '../constants'
import { Example, Examples } from '../examples'

import useDebounceCallback from '../hooks/useDebounceCallback'
import { determineCode, determineLanguage, pushNewURL } from '../utils'


interface CodeContextContent {
    code: string;
    codeLanguage: CodeLanguage
    onLanguageChange: (language: CodeLanguage) => void,
    examples: Example[],
    onChange: (code: string) => void;
    rightPanelMode: boolean;
    onChangeRightPanelMode: (val: boolean) => void;
}

export const CodeContext = createContext<CodeContextContent>({
    code: "",
    codeLanguage: CodeLanguage.JAVASCRIPT,
    onLanguageChange: () => {},
    examples: [],
    onChange: () => null,
    rightPanelMode: true,
    onChangeRightPanelMode: () => null,
})

type CodeContextProviderProps = {
    children: React.ReactNode;
}

const CodeContextProvider: React.FC<CodeContextProviderProps> = ({ children }) => {
    // keep some value in there due a bug with react-monaco-editor
    const [code, setCode] = useState<string>(" ")
    const [rightPanelMode, setRightPanelMode] = useState(true)
    const [codeLanguage, setCodeLanguage] = useState<CodeLanguage>(determineLanguage())

    // Store the code in localstorage with a 500ms debounce on change
    const handleLazyStore = ()=>{
        if (window.localStorage) {
            window.localStorage.setItem("code", code)
            window.localStorage.setItem("language", codeLanguage)
        }
    }
    const [debouncedCallback] = useDebounceCallback(handleLazyStore, 500)
    useEffect(()=>{
        debouncedCallback()
    }, [code, debouncedCallback])

    const examples = Examples[codeLanguage]

    // determine the code which should be loaded on the application start
    useEffect(() => {
        determineCode(code => setCode(code), examples)
    }, [examples])

    const handleSetLanguage = (language: CodeLanguage) => {
        if (language === codeLanguage)
            return
        const params = new URLSearchParams(window.location.search)
        params.set("l", language)
        pushNewURL(params)
        setCodeLanguage(language)
        setCode("")
        if (window.localStorage) {
            window.localStorage.removeItem("code")
        }
        setRightPanelMode(true)
    }

    return (
        <CodeContext.Provider value={{
            code,
            codeLanguage: codeLanguage,
            onLanguageChange: handleSetLanguage,
            examples,
            onChange: setCode,
            rightPanelMode,
            onChangeRightPanelMode: setRightPanelMode
        }}>
            {children}
        </CodeContext.Provider>
    )
}

export default CodeContextProvider