import { useState, useEffect, createContext } from 'react'

import useDebounceCallback from '../hooks/useDebounceCallback'
import { determineCode } from '../utils'


interface CodeContextContent {
    code: string;
    onChange: (code: string) => void;
    rightPanelMode: boolean;
    onChangeRightPanelMode: (val: boolean) => void;
}

export const CodeContext = createContext<CodeContextContent>({
    code: "",
    onChange: () => null,
    rightPanelMode: true,
    onChangeRightPanelMode: () => null,
})

const CodeContextWrapper: React.FunctionComponent = ({ children }) => {
    // keep some value in there due a bug with react-monaco-editor
    const [code, setCode] = useState<string>(" ")
    const [rightPanelMode, setRightPanelMode] = useState(true)

    // Store the code in localstorage with a 500ms debounce on change
    const handleLazyStore = ()=>{
        if (window.localStorage) {
            window.localStorage.setItem("code", code)
        }
    }
    const [debouncedCallback] = useDebounceCallback(handleLazyStore, 500)
    useEffect(()=>{
        debouncedCallback()
    }, [code, debouncedCallback])

    // determine the code which should be loaded on the application start
    useEffect(() => {
        determineCode(code => setCode(code))
    }, [])

    return (
        <CodeContext.Provider value={{
            code,
            onChange: setCode,
            rightPanelMode,
            onChangeRightPanelMode: setRightPanelMode
        }}>
            {children}
        </CodeContext.Provider>
    )
}

export default CodeContextWrapper