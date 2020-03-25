

import React, { useEffect } from 'react'
import MonacoEditor from 'react-monaco-editor';
import * as monacoEditor from 'monaco-editor/esm/vs/editor/editor.api';

import useDarkMode from "../../hooks/useDarkMode"

// eslint-disable-next-line import/no-webpack-loader-syntax
import staticTypes from '!!raw-loader!./types.txt';

const MONACO_OPTIONS: monacoEditor.editor.IEditorConstructionOptions = {
    minimap: {
        enabled: false
    },
    scrollBeyondLastLine: false,
    hideCursorInOverviewRuler: true,
    overviewRulerLanes: 0,
    scrollbar: {
        vertical: "hidden"
    },
}

interface EditorProps {
    onChange: (code: string) => void;
    value: string;
    onExecutionRef: React.MutableRefObject<(() => void) | undefined>;
}

const Editor: React.FunctionComponent<EditorProps> = ({ value, onChange, onExecutionRef }) => {
    const [darkMode] = useDarkMode()
    useEffect(() => {
        monacoEditor.editor.defineTheme('custom-dark', {
            base: 'vs-dark',
            inherit: true,
            colors: {
                'editor.background': '#0f131a',
            },
            rules: []
        });
    })
    const handleEditorDidMount = async (editor: monacoEditor.editor.IStandaloneCodeEditor, monaco: typeof monacoEditor): Promise<void> => {
        editor.getModel()?.updateOptions({
            tabSize: 2
        })
        editor.onKeyDown((event: monacoEditor.IKeyboardEvent) => {
            if (event.keyCode === monacoEditor.KeyCode.Enter && (event.ctrlKey || event.metaKey)) {
                event.preventDefault();
                event.stopPropagation()
                if (onExecutionRef.current) {
                    onExecutionRef.current()
                }
            }
        });
        monaco.languages.typescript.typescriptDefaults.addExtraLib(staticTypes)
        monaco.languages.typescript.typescriptDefaults.setDiagnosticsOptions({
            diagnosticCodesToIgnore: [80005]
        })
    }
    return (
        <MonacoEditor
            onChange={onChange}
            language="typescript"
            theme={darkMode ? "custom-dark" : "vs"}
            value={value}
            options={MONACO_OPTIONS}
            editorDidMount={handleEditorDidMount}
            height={600}
        />
    )
}

export default Editor