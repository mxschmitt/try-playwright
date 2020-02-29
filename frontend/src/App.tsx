import React, { useState } from 'react';
import { Row, Col, Grid, Button, Loader } from 'rsuite'

interface LogEntry {
  mode: "log" | "error"
  args: string[]
}

interface APIResponse {
  "files": string[]
  "logs": LogEntry[]
}

const DEFAULT_CODE = `const browser = await playwright.firefox.launch();
const context = await browser.newContext();
const page = await context.newPage();
await page.goto('http://whatsmyuseragent.org/');
await page.screenshot({ path: "example.png" });
const userAgent = await page.$eval(".user-agent > .intro-text", x => x.innerText)
console.log(userAgent)
await browser.close();
  `

const App = () => {
  const [code, setCode] = useState<string>(DEFAULT_CODE)
  const [loading, setLoading] = useState<boolean>(false)
  const [resp, setResponse] = useState<APIResponse | null>()
  const handleChangeCode = ({ target: { value } }: any) => setCode(value)
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
  if (loading) {
    return <Loader center content="loading" />;
  }
  return (
    <Grid>
      <Row className="show-grid">
        <Col xs={24}>
          <h1>Playwright Playground</h1>
        </Col>
        <Col xs={12}>
          <textarea rows={10} value={code} onChange={handleChangeCode} className="rs-input" />
          <Button onClick={handleExection}>
            Run
          </Button>
        </Col>
        <Col xs={12}>
          {resp && <>
            {resp.files.map((file, i) => <img src={file} key={i} style={{ width: "100%" }} />)}
            <code>{resp.logs.map((entry, i) => entry.args.join())}</code>{resp.logs.map((entry, i) => entry.args.join())}
          </>}
        </Col>
      </Row>
    </Grid >
  );
}

export default App;
