import { useState, useEffect, useRef, createContext } from 'react'
import { CodeLanguage } from '../constants'
import { Example, Examples } from '../examples'

import useDebounceCallback from '../hooks/useDebounceCallback'
import { determineCode, determineLanguage, pushNewURL } from '../utils'


interface CodeContextContent {
    code: string;
    getCode: () => string;
    codeLanguage: CodeLanguage
    onLanguageChange: (language: CodeLanguage) => void,
    examples: Example[],
    onChange: (code: string) => void;
    rightPanelMode: boolean;
    onChangeRightPanelMode: (val: boolean) => void;
}

export const CodeContext = createContext<CodeContextContent>({
    code: "",
    getCode: () => "",
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
    const [code, setCode] = useState<string>("")
    // Mailbox for execution: setState does not update `code` in this click or
    // after await (Turnstile). Copying into a ref in useEffect is still stale
    // in that click — write the ref here. Repro: src/repro/staleStateRepro.tsx
    const latestCode = useRef(code)
    const [rightPanelMode, setRightPanelMode] = useState(true)
    const [codeLanguage, setCodeLanguage] = useState<CodeLanguage>(determineLanguage())

    const updateCode = (next: string) => {
        latestCode.current = next
        setCode(next)
    }

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
        determineCode(next => updateCode(next), examples)
    }, [examples])

    const handleSetLanguage = (language: CodeLanguage) => {
        if (language === codeLanguage)
            return
        const params = new URLSearchParams(window.location.search)
        params.set("l", language)
        pushNewURL(params)
        setCodeLanguage(language)
        updateCode("")
        if (window.localStorage) {
            window.localStorage.removeItem("code")
        }
        setRightPanelMode(true)
    }

    return (
        <CodeContext.Provider value={{
            code,
            getCode: () => latestCode.current,
            codeLanguage: codeLanguage,
            onLanguageChange: handleSetLanguage,
            examples,
            onChange: updateCode,
            rightPanelMode,
            onChangeRightPanelMode: setRightPanelMode
        }}>
            {children}
        </CodeContext.Provider>
    )
}

export default CodeContextProvider