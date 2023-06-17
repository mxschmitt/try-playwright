

import { useEffect, useContext, useRef } from 'react'
import * as monacoEditor from 'monaco-editor/esm/vs/editor/editor.api';
import tsWorker from 'monaco-editor/esm/vs/language/typescript/ts.worker?worker'
import editorWorker from 'monaco-editor/esm/vs/editor/editor.worker?worker'

import { CodeLanguage, CODE_LANG_2_MONACO_LANG } from '../../constants';
import useDarkMode from "../../hooks/useDarkMode"
import { CodeContext } from '../CodeContext';
import styles from './index.module.css'

import * as monaco from 'monaco-editor';

self.MonacoEnvironment = {
	getWorker: function (workerId, label) {
		switch (label) {
			case 'javascript':
            case 'typescript':
                return new tsWorker()
            default:
				return new editorWorker();
		}
	},
    createTrustedTypesPolicy: () => undefined
};

import staticTypes from './types.txt?raw';

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
    wordWrap: "on",
}

monaco.editor.defineTheme('custom-dark', {
    base: 'vs-dark',
    inherit: true,
    colors: {
        'editor.background': '#0f131a',
    },
    rules: []
});

interface EditorProps {
    onExecution: React.MutableRefObject<(() => Promise<void>) | undefined>;
}

const Editor: React.FunctionComponent<EditorProps> = ({ onExecution }) => {
    const [darkMode] = useDarkMode()
    const rootNode = useRef<HTMLDivElement>(null);
    const { code, onChange, codeLanguage } = useContext(CodeContext)
    const editorRef = useRef<monacoEditor.editor.IStandaloneCodeEditor>()
    useEffect(() => {
        if (!rootNode.current)
            return;
        const editor = monaco.editor.create(rootNode.current, {
            value: code,
            language: codeLanguage,
            ...MONACO_OPTIONS,
        });
        editorRef.current = editor;
        editor.onDidChangeModelContent(() => {
            onChange(editor!.getValue())
        });
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
        editor._standaloneKeybindingService.addDynamicKeybinding("-expandLineSelection", 0, () => {});
        editor.focus()
    }, [rootNode])

    useEffect(() => {
        if (editorRef.current) {
            const resizeListener = () => editorRef.current?.layout()
            window.addEventListener('resize', resizeListener);
            return () => window.removeEventListener('resize', resizeListener);
        }
    }, [editorRef])
    const tsTypesAlreadyLoaded = useRef(false)
    useEffect(()=>{
        if (editorRef.current)
            monaco.editor.setModelLanguage(editorRef.current.getModel()!, CODE_LANG_2_MONACO_LANG[codeLanguage])
        if ([CodeLanguage.PLAYWRIGHT_TEST, CodeLanguage.JAVASCRIPT].includes(codeLanguage) && tsTypesAlreadyLoaded.current === false) {
            tsTypesAlreadyLoaded.current = true
            monaco.languages.typescript.javascriptDefaults.addExtraLib(staticTypes)
            monaco.languages.typescript.javascriptDefaults.setDiagnosticsOptions({
                diagnosticCodesToIgnore: [80001, 7044]
            })
        }
    }, [codeLanguage])

    useEffect(()=>{
        if (code !== editorRef.current?.getValue())
            editorRef.current?.setValue(code || '')
    }, [code, editorRef])

    useEffect(() => {
        monaco.editor.setTheme(darkMode ? 'custom-dark' : 'vs')
    }, [darkMode])

    return (
        <div className={styles.monacoEditorWrapper} ref={rootNode} />
    )
}

export default Editor