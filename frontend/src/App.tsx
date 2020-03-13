import React, { useState, useEffect, useRef } from 'react';
import { Col, Grid, IconButton, Icon, Loader, Panel, Dropdown, Notification, Message } from 'rsuite'
import MonacoEditor from 'react-monaco-editor';
import * as monacoEditor from 'monaco-editor/esm/vs/editor/editor.api';

import { Examples } from './constants'
import { decodeCode, runCode, trackEvent } from './utils'
import ResponseFile from './components/ResponseFile'
import ShareButton from './components/ShareButton'
import Header from './components/Header'
import ExampleWrapper from './components/ExampleWrapper'
import useDarkMode from './hooks/useDarkMode';

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
  }
}

const App: React.FunctionComponent = () => {
  const [darkMode] = useDarkMode()
  const [code, setCode] = useState<string>("")
  const [loading, setLoading] = useState<boolean>(false)
  const [resp, setResponse] = useState<APIResponse | null>()
  const handleExecutionContainer = useRef<() => Promise<void>>()

  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.has("code")) {
      const newCode = decodeCode(urlParams.get("code"))
      setCode(newCode)
    } else {
      setCode(Examples[0].code)
    }
    monacoEditor.editor.defineTheme('custom-dark', {
      base: 'vs-dark',
      inherit: true,
      colors: {
        'editor.background': '#0f131a',
      },
      rules: []
    });
  }, [])

  const handleChangeCode = (newValue: string): void => setCode(newValue)
  const handleExecution = async (): Promise<void> => {
    setLoading(true)
    setResponse(null)

    trackEvent()
    try {
      const resp = await runCode(code)
      setResponse(resp)
    } catch (err) {
      Notification.error({
        title: "Error!",
        description: err.toString()
      })
    }
    setLoading(false)
  }
  handleExecutionContainer.current = handleExecution
  const handleEditorDidMount = async (editor: monacoEditor.editor.IStandaloneCodeEditor, monaco: typeof monacoEditor): Promise<void> => {
    editor.getModel()?.updateOptions({
      tabSize: 2
    })
    editor.onKeyDown((event: monacoEditor.IKeyboardEvent) => {
      if (event.keyCode === monacoEditor.KeyCode.Enter && (event.ctrlKey || event.metaKey)) {
        event.preventDefault();
        event.stopPropagation()
        if (handleExecutionContainer.current) {
          handleExecutionContainer.current();
        }
      }
    });
    monaco.languages.typescript.typescriptDefaults.addExtraLib(staticTypes)
    monaco.languages.typescript.typescriptDefaults.setDiagnosticsOptions({
      diagnosticCodesToIgnore: [80005]
    })
  }
  const RunButton: React.FunctionComponent = () => (
    <IconButton onClick={handleExecution} style={{ float: "right" }} icon={<Icon icon="play" />}>
      Run
    </IconButton>
  );

  const handleSelectExample = (index: number): void => {
    const example = Examples[index]
    setCode(example.code)
  }

  const example = Examples.find(item => item.code === code)

  return (
    <>
      <Header />
      <Grid fluid>
        <Col xs={24} md={12}>
          {loading && <Loader center content="loading" backdrop style={{ zIndex: 10 }} />}
          <Panel
            bodyFill
            header={
              <>
                Examples{' '}
                <Dropdown title={example ? example.title : "Custom"} onSelect={handleSelectExample}>
                  {Examples.map((example, idx) => <ExampleWrapper key={idx} example={example} index={idx} />)}
                </Dropdown>
                <RunButton />
              </>
            }
          >
            {example?.description && <Message description={example.description} style={{ margin: "0 20px 20px 20px", animation: "none" }} />}
            <MonacoEditor
              onChange={handleChangeCode}
              language="typescript"
              theme={darkMode ? "custom-dark" : "vs"}
              value={code}
              options={MONACO_OPTIONS}
              editorDidMount={handleEditorDidMount}
              height={500}
            />
          </Panel>
        </Col>
        <Col xs={24} md={12}>
          <Panel
            bodyFill
            header={
              <>
                Output <ShareButton code={code} style={{ float: "right" }} />
              </>
            }
          >
            {resp && <>
              {resp.logs.length > 0 && <h4>Logs</h4>}
              <code>{resp.logs.map((entry, idx) => <React.Fragment key={idx}>
                {entry.args.join(" ")}
                <br />
              </React.Fragment>)}</code>
              {resp.files.length > 0 && <h4>Files</h4>}
              {resp.files.map((file, idx) => <ResponseFile file={file} key={idx} />)}
            </>}
          </Panel>
        </Col>
      </Grid >
    </>
  );
}

export default App;
