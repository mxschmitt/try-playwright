import React, { useState, useEffect, useRef } from 'react';
import { Row, Col, Grid, IconButton, Icon, Loader, Panel, Dropdown, Notification, Message } from 'rsuite'
import MonacoEditor from 'react-monaco-editor';
import monacoEditor, { KeyCode } from 'monaco-editor'

import { Examples } from './constants'
import { decodeCode, runCode, trackEvent } from './utils'
import ResponseFile from './components/ResponseFile'
import ShareButton from './components/ShareButton'
import Header from './components/Header'
import ExampleWrapper from './components/ExampleWrapper'

const App: React.FunctionComponent = () => {
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
      if (event.keyCode === KeyCode.Enter && (event.ctrlKey || event.metaKey)) {
        event.preventDefault();
        event.stopPropagation()
        if (handleExecutionContainer.current) {
          handleExecutionContainer.current();
        }
      }
    });
    // const resp = await fetch("https://unpkg.com/electron@8.1.0/electron.d.ts")
    // monaco.languages.typescript.typescriptDefaults.addExtraLib(await resp.text())
    monaco.languages.typescript.typescriptDefaults.addExtraLib(`
declare const playwright: {
  chromium: any
  firefox: any
  webkit: any
}`)
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
        <Row>
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
                value={code}
                height={500}
                options={{
                  minimap: {
                    enabled: false
                  },
                  scrollBeyondLastLine: false
                }}
                editorDidMount={handleEditorDidMount}
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
        </Row>
      </Grid >
    </>
  );
}

export default App;
