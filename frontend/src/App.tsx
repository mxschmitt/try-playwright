import React, { useState, useEffect, useRef, useContext } from 'react';
import { Col, Grid, IconButton, Icon, Loader, Panel, Notification } from 'rsuite'

import { runCode, trackEvent } from './utils'
import RightPanel from './components/RightPanel'
import Header from './components/Header'
import Editor from './components/Editor'
import { CodeContext } from './components/CodeContext'

const App: React.FunctionComponent = () => {
  const { code, onChangeRightPanelMode } = useContext(CodeContext)
  const [loading, setLoading] = useState<boolean>(false)
  const [resp, setResponse] = useState<APIResponse | null>(null)
  const handleExecutionContainer = useRef<() => void>()

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
    onChangeRightPanelMode(false)
  }
  handleExecutionContainer.current = handleExecution

  const RunButton: React.FunctionComponent = () => (
    <IconButton onClick={handleExecution} style={{ float: "right" }} icon={<Icon icon="play" />}>
      Run
    </IconButton>
  );

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
                Editor
                <RunButton />
              </>
            }
          >
            <Editor onExecutionRef={handleExecutionContainer} />
          </Panel>
        </Col>
        <Col xs={24} md={12}>
          <RightPanel resp={resp} />
        </Col>
      </Grid >
    </>
  );
}

export default App;
