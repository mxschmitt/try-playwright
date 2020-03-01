import React, { useState, useEffect } from 'react';
import { Row, Col, Grid, IconButton, Icon, Loader, Panel, Dropdown, Footer, Notification } from 'rsuite'
import MonacoEditor from 'react-monaco-editor';
import monacoEditor from 'monaco-editor'

import { Examples } from './constants'
import { getDropdownTitle, decodeCode, runCode } from './utils'
import ResponseFile from './components/ResponseFile'
import ShareButton from './components/ShareButton'

const BROWSERS: BrowserType[] = ["chromium", "firefox", "webkit"]

const App = () => {
  const [code, setCode] = useState<string>("")
  const [browser, setBrowser] = useState<BrowserType>("chromium")
  const [loading, setLoading] = useState<boolean>(false)
  const [resp, setResponse] = useState<APIResponse | null>()

  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.has("code")) {
      const newCode = decodeCode(urlParams.get("code"))
      setCode(newCode)
    } else {
      setCode(Examples[0].code)
    }
  }, [])

  const handleChangeCode = (newValue: string) => setCode(newValue)
  const handleExection = async () => {
    setLoading(true)
    setResponse(null)
    try {
      const resp = await runCode(code, browser)
      setResponse(resp)
    } catch (err) {
      Notification.error({
        title: "Error!",
        description: err.toString()
      })
    }
    setLoading(false)
  }
  const handleEditorDidMount = (editor: monacoEditor.editor.IStandaloneCodeEditor) => {
    editor.getModel()?.updateOptions({
      tabSize: 2
    })
  }
  return (
    <Grid>
      <Row>
        <Col xs={24}>
          <h1>Playwright Playground</h1>
        </Col>
        <Col xs={24} md={12}>
          {loading && <Loader center content="loading" backdrop style={{ zIndex: 10 }} />}
          <Panel header={<>
            Examples{' '}
            <Dropdown title={getDropdownTitle(code)}>
              {Examples.map(({ title }, idx) => <Dropdown.Item key={idx} onSelect={() => setCode(Examples[idx].code)}>{title}</Dropdown.Item>)}
            </Dropdown>
            <Dropdown title={`Browser: ${browser}`}>
              {BROWSERS.map((browserName: BrowserType, idx) => <Dropdown.Item key={idx} onSelect={() => setBrowser(browserName)}>{browserName}</Dropdown.Item>)}
            </Dropdown>
            <IconButton onClick={handleExection} style={{ float: "right" }} icon={<Icon icon="play" />}>
              Run
          </IconButton>
          </>} bordered>
            <MonacoEditor
              onChange={handleChangeCode}
              language="typescript"
              value={code}
              height={500}
              options={{
                minimap: {
                  enabled: false
                },
              }}
              editorDidMount={handleEditorDidMount}
            />

          </Panel>
        </Col>
        <Col xs={24} md={12}>
          <Panel header={<>
            Output
          <ShareButton code={code} style={{ float: "right" }} />
          </>} bordered>
            {resp && <>
              {resp.logs.length > 0 && <h4>Logs</h4>}
              <code>{resp.logs.map((entry, idx) => <React.Fragment key={idx}>
                {entry.args.join()}
                <br />
              </React.Fragment>)}</code>
              <h4>Files</h4>
              {resp.files.map((file, idx) => <ResponseFile file={file} key={idx} />)}
            </>}
          </Panel>
        </Col>
        <Col sm={24}>
          <Footer style={{ textAlign: "center", marginTop: 4 }}>
            Open Source on {' '}
            <a href="https://github.com/mxschmitt/try-playwright" target="_blank" rel="noopener noreferrer">
              GitHub
            </a>.
          </Footer>
        </Col>
      </Row>
    </Grid >
  );
}

export default App;
