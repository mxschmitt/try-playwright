import React, { useState, useEffect, useContext, useRef } from 'react';
import { Col, Grid, IconButton, Icon, Loader, Panel, Notification } from 'rsuite'

import { runCode, trackEvent } from '../../utils'
import RightPanel from '../RightPanel'
import Header from '../Header'
import Editor from '../Editor'
import { CodeContext } from '../CodeContext'

import styles from './index.module.css'

const App: React.FunctionComponent = () => {
  const { code, onChangeRightPanelMode } = useContext(CodeContext)
  const [loading, setLoading] = useState<boolean>(false)
  const [resp, setResponse] = useState<APIResponse | null>(null)
  const handleExecutionRef = useRef<() => Promise<void>>()

  // Store the code which was entered if the user is leaving the page
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
  handleExecutionRef.current = handleExecution

  return (
    <>
      <Header />
      <Grid fluid className={styles.grid}>
        <Col xs={24} md={12}>
          {loading && <Loader center content="loading" backdrop className={styles.loader} />}
          <Panel
            bodyFill
            className={styles.editorPanel}
            header={
              <>
                Editor
               <IconButton onClick={handleExecution} className={styles.runButton} icon={<Icon icon="play" />}>
                  Run
              </IconButton>
              </>
            }
          >
            <Editor onExecution={handleExecutionRef} />
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
