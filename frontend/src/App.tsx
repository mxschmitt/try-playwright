import React, { useState, useEffect, useRef } from 'react';
import { Col, Grid, IconButton, Icon, Loader, Panel, Dropdown, Notification, Message } from 'rsuite'

import { Examples } from './constants'
import { runCode, trackEvent, determineCode } from './utils'
import RightPanel from './components/RightPanel'
import Header from './components/Header'
import ExampleWrapper from './components/ExampleWrapper'
import Editor from './components/Editor'

const App: React.FunctionComponent = () => {
  const [code, setCode] = useState<string>("")
  const [loading, setLoading] = useState<boolean>(false)
  const [resp, setResponse] = useState<APIResponse | null>(null)
  const handleExecutionContainer = useRef<() => void>()

  useEffect(() => {
    determineCode(code => setCode(code))
  }, [])

  // store the code which was entered if the user is leaving the page
  useEffect((): (() => void) => {
    const handler = (): void => {
      window.localStorage.setItem("code", code)
    }
    window.addEventListener("unload", handler)
    return (): void => window.removeEventListener("unload", handler)
  })

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
            <Editor value={code} onChange={setCode} onExecutionRef={handleExecutionContainer} />
          </Panel>
        </Col>
        <Col xs={24} md={12}>
          <RightPanel resp={resp} code={code} />
        </Col>
      </Grid >
    </>
  );
}

export default App;
