import React, { useState, useEffect } from 'react';
import { Row, Col, Grid, IconButton, Icon, Loader, Panel, Dropdown, Notification } from 'rsuite'
import MonacoEditor from 'react-monaco-editor';
import monacoEditor from 'monaco-editor'

import { Examples, Example } from './constants'
import { getDropdownTitle, decodeCode, runCode } from './utils'
import ResponseFile from './components/ResponseFile'
import ShareButton from './components/ShareButton'
import Header from './components/Header'

const App = () => {
  const [code, setCode] = useState<string>("")
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
  const handleEditorDidMount = (editor: monacoEditor.editor.IStandaloneCodeEditor) => {
    editor.getModel()?.updateOptions({
      tabSize: 2
    })
  }
  const ExampleWrapper = ({ example }: {
    example: Example
  }) => {
    const handleSelect = () => {
      setCode(example.code)
    }
    return <Dropdown.Item onSelect={handleSelect}>{example.title}</Dropdown.Item>
  }
  const RunButton = () => (
    <IconButton onClick={handleExection} style={{ float: "right" }} icon={<Icon icon="play" />}>
      Run
    </IconButton>
  );

  return (
    <>
    <Header />
    <Grid fluid={true}>
      <Row>
        <Col xs={24} md={12}>
          {loading && <Loader center content="loading" backdrop style={{ zIndex: 10 }} />}
          <Panel 
            bodyFill={true}
            header={
              <>
                Examples{' '}
                <Dropdown title={getDropdownTitle(code)}>
                  {Examples.map((example, idx) => <ExampleWrapper key={idx} example={example} />)}
                </Dropdown>
                <RunButton />
              </>
            }
          >
            <MonacoEditor
              onChange={handleChangeCode}
              language="typescript"
              value={code}
              height={"calc(100vh - 132px)"}
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
          <Panel
            bodyFill={true}
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
