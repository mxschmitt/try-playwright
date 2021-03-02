

import React, { useEffect, useContext, useRef } from 'react'
import MonacoEditor from 'react-monaco-editor';
import * as monacoEditor from 'monaco-editor/esm/vs/editor/editor.api';

import useDarkMode from "../../hooks/useDarkMode"
import { CodeContext } from '../CodeContext';
import styles from './index.module.css'

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
    wordWrap: "on"
}

interface EditorProps {
    onExecution: React.MutableRefObject<(() => Promise<void>) | undefined>;
}

const Editor: React.FunctionComponent<EditorProps> = ({ onExecution }) => {
    const [darkMode] = useDarkMode()
    const { code, onChange } = useContext(CodeContext)
    const ref = useRef<monacoEditor.editor.IStandaloneCodeEditor>()
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
    useEffect(() => {
        if (ref.current) {
            const resizeListener = () => ref.current?.layout()
            window.addEventListener('resize', resizeListener);
            return () => window.removeEventListener('resize', resizeListener);
        }
    }, [ref])
    const handleEditorDidMount = async (editor: monacoEditor.editor.IStandaloneCodeEditor, monaco: typeof monacoEditor): Promise<void> => {
        ref.current = editor
        editor.getModel()?.updateOptions({
            tabSize: 2
        })
        // @ts-ignore
        window.monacoEditorModel = editor.getModel()
        editor.onKeyDown((event: monacoEditor.IKeyboardEvent) => {
            if (event.keyCode === monacoEditor.KeyCode.Enter && (event.ctrlKey || event.metaKey)) {
                event.preventDefault();
                event.stopPropagation()
                if (onExecution.current) {
                    onExecution.current()
                }
            }
        });

        // @ts-ignore
        editor._standaloneKeybindingService.addDynamicKeybinding("-expandLineSelection",null,() => {});
      
        monaco.languages.typescript.javascriptDefaults.addExtraLib(staticTypes)
        monaco.languages.typescript.javascriptDefaults.setDiagnosticsOptions({
            diagnosticCodesToIgnore: [80001, 7044]
        })
        editor.focus()
    }

    return (
        <div className={styles.monacoEditorWrapper}>
            <MonacoEditor
                onChange={onChange}
                language="javascript"
                theme={darkMode ? "custom-dark" : "vs"}
                value={code}
                options={MONACO_OPTIONS}
                editorDidMount={handleEditorDidMount}
                height="100%"
            />
        </div>
    )
}

export default Editor