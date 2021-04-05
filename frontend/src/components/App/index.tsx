import { useState, useContext, useRef } from 'react';
import { Col, Grid, IconButton, Icon, Loader, Panel } from 'rsuite'

import { runCode, trackEvent } from '../../utils'
import RightPanel from '../RightPanel'
import Header from '../Header'
import Editor from '../Editor'
import { CodeContext } from '../CodeContext'

import styles from './index.module.css'
import CodeLanguageSelector from '../CodeLanguageSelector';

const App: React.FunctionComponent = () => {
  const { code, onChangeRightPanelMode } = useContext(CodeContext)
  const [loading, setLoading] = useState<boolean>(false)
  const [resp, setResponse] = useState<SuccessExecutionResponse | null>(null)
  const [error, setError] = useState<string | null>(null)
  const handleExecutionRef = useRef<() => Promise<void>>()

  const handleExecution = async (): Promise<void> => {
    setLoading(true)
    setResponse(null)
    setError(null)

    trackEvent()
    try {
      const resp = await runCode(code)
      setResponse(resp)
    } catch (err) {
      setError(err.toString())
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
                <div className={styles.codeHeaderButtons}>
                  <CodeLanguageSelector />
                  <IconButton onClick={handleExecution} icon={<Icon icon="play" />}>
                      Run
                  </IconButton>
                </div>
              </>
            }
          >
            <Editor onExecution={handleExecutionRef} />
          </Panel>
        </Col>
        <Col xs={24} md={12}>
          <RightPanel resp={resp} error={error}/>
        </Col>
      </Grid >
    </>
  );
}

export default App;
