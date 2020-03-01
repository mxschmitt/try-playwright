import React, { useState } from 'react';
import { Row, Col, Grid, Button, Loader, Panel, Dropdown, Footer } from 'rsuite'
import MonacoEditor from 'react-monaco-editor';

import { Examples } from './constants'
import { getDropdownTitle } from './utils'
import ResponseFile from './components/ResponseFile'

const App = () => {
  const [code, setCode] = useState<string>(Examples[0].code)
  const [loading, setLoading] = useState<boolean>(false)
  const [resp, setResponse] = useState<APIResponse | null>()
  const handleChangeCode = (newValue: string) => setCode(newValue)
  const handleExection = () => {
    setLoading(true)
    fetch("/api/v1/run", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        code
      })
    }).then(resp => resp.ok ? resp.json() : Promise.reject(resp.text()))
      .then(resp => {
        setResponse(resp)
        setLoading(false)
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
              {Examples.map(({ title }, index) => <Dropdown.Item key={index} onSelect={() => setCode(Examples[index].code)}>{title}</Dropdown.Item>)}
            </Dropdown>
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
            />
            <Button onClick={handleExection} style={{ position: "absolute", top: 20, right: 20 }}>
              Run
          </Button>
          </Panel>
        </Col>
        <Col xs={24} md={12}>
          <Panel header="Output" bordered>
            {resp && <>
              {resp.logs.length > 0 && <h4>Logs</h4>}
              <code>{resp.logs.map((entry, i) => <>
                {entry.args.join()}
                <br />
              </>)}</code>
              <h4>Files</h4>
              {resp.files.map((file, idx) => <ResponseFile file={file} key={idx} />)}
            </>}
          </Panel>
        </Col>
        <Col sm={24}>
          <Footer style={{ textAlign: "center", marginTop: 4 }}>
            Open Source on <a href="https://github.com/mxschmitt/try-playwright">GitHub</a>.
          </Footer>
        </Col>
      </Row>
    </Grid >
  );
}

export default App;
