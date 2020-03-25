

import React, { useEffect, useContext } from 'react'
import MonacoEditor from 'react-monaco-editor';
import * as monacoEditor from 'monaco-editor/esm/vs/editor/editor.api';

import useDarkMode from "../../hooks/useDarkMode"
import { CodeContext } from '../CodeContext';

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
    onExecution: () => void;
}

const Editor: React.FunctionComponent<EditorProps> = ({ onExecution }) => {
    const [darkMode] = useDarkMode()
    const { code, onChange } = useContext(CodeContext)
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
                onExecution()
            }
        });
        monaco.languages.typescript.typescriptDefaults.addExtraLib(staticTypes)
        monaco.languages.typescript.typescriptDefaults.setDiagnosticsOptions({
            diagnosticCodesToIgnore: [80005]
        })
    }
    return (
        <div style={{ paddingTop: 5 }}>
            <MonacoEditor
                onChange={onChange}
                language="typescript"
                theme={darkMode ? "custom-dark" : "vs"}
                value={code}
                options={MONACO_OPTIONS}
                editorDidMount={handleEditorDidMount}
                height={600}
            />
        </div>
    )
}

export default Editor