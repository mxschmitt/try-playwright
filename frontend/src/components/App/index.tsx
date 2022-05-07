import { useState, useContext, useRef } from 'react';
import { Col, Grid, IconButton, Loader, Panel, CustomProvider } from 'rsuite'
import PlayIcon from '@rsuite/icons/PlayOutline';

import { runCode, trackEvent } from '../../utils'
import RightPanel from '../RightPanel'
import Header from '../Header'
import Editor from '../Editor'
import { CodeContext } from '../CodeContext'

import styles from './index.module.css'
import CodeLanguageSelector from '../CodeLanguageSelector';
import useDarkMode from '../../hooks/useDarkMode';

const App: React.FunctionComponent = () => {
  const { code, onChangeRightPanelMode } = useContext(CodeContext)
  const [loading, setLoading] = useState<boolean>(false)
  const [resp, setResponse] = useState<ExecutionResponse|null>(null)
  const handleExecutionRef = useRef<() => Promise<void>>()
  const [darkMode] = useDarkMode()

  const handleExecution = async (): Promise<void> => {
    setLoading(true)
    setResponse(null)

    trackEvent()
    setResponse(await runCode(code))
    setLoading(false)
    onChangeRightPanelMode(false)
  }
  handleExecutionRef.current = handleExecution

  return (
    <CustomProvider theme={darkMode ? 'dark' : 'light'}>
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
                  <IconButton onClick={handleExecution} icon={<PlayIcon />}>
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
          <RightPanel resp={resp} />
        </Col>
      </Grid >
    </CustomProvider>
  );
}

export default App;
