import { useState, useContext, useRef } from 'react';
import { Col, Grid, IconButton, Loader, Panel, CustomProvider } from 'rsuite'
import PlayIcon from '@rsuite/icons/PlayOutline';

import { ExecutionResponse, runCode, trackEvent } from '../../utils'
import { waitForTurnstileToken } from '../../turnstile'
import RightPanel from '../RightPanel'
import Header from '../Header'
import Editor from '../Editor'
import { CodeContext } from '../CodeContext'

import styles from './index.module.css'
import CodeLanguageSelector from '../CodeLanguageSelector';
import useDarkMode from '../../hooks/useDarkMode';

const VITE_TURNSTILE_SITEKEY = '0x4AAAAAAA_K0T_2LZ0rgUtv';

const App: React.FunctionComponent = () => {
  const { getCode, onChangeRightPanelMode, codeLanguage, onLanguageChange } = useContext(CodeContext)
  const [loading, setLoading] = useState<boolean>(false)
  const [resp, setResponse] = useState<ExecutionResponse|null>(null)
  const handleExecutionRef = useRef<() => Promise<void>>(undefined)
  const [darkMode] = useDarkMode()
  const turnstileRef = useRef<HTMLDivElement>(null)
  const skipTurnstile = Boolean(window.__TRY_PLAYWRIGHT__?.skipTurnstile)

  const handleExecution = async (): Promise<void> => {
    setLoading(true)
    setResponse(null)

    trackEvent()
    const turnstileToken = skipTurnstile
      ? ''
      : await waitForTurnstileToken({
          turnstile: window.turnstile,
          container: turnstileRef.current,
          sitekey: VITE_TURNSTILE_SITEKEY,
        })
    const codeToRun = getCode()
    try {
      setResponse(await runCode(codeToRun, codeLanguage, turnstileToken))
    } finally {
      setLoading(false)
      onChangeRightPanelMode(false)
    }
  }
  handleExecutionRef.current = handleExecution

  return (
    <CustomProvider theme={darkMode ? 'dark' : 'light'}>
      {!skipTurnstile && (
        <div
          ref={turnstileRef}
          aria-hidden="true"
          style={{ position: 'fixed', left: 0, bottom: 0, width: 300, height: 65, opacity: 0.01, pointerEvents: 'none', overflow: 'hidden' }}
        />
      )}
      <Header />
      <Grid fluid className={styles.grid}>
        <Col span={{ xs: 24, md: 12 }}>
          {loading && <Loader center content="loading" backdrop className={styles.loader} />}
          <Panel
            bodyFill
            className={styles.editorPanel}
            header={
              <>
                Editor
                <div className={styles.codeHeaderButtons}>
                  <CodeLanguageSelector codeLanguage={codeLanguage} onLanguageChange={onLanguageChange} />
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
        <Col span={{ xs: 24, md: 12 }}>
          <RightPanel resp={resp} />
        </Col>
      </Grid >
    </CustomProvider>
  );
}

export default App;
