import { useState, useContext, useEffect, useRef } from 'react';
import { Col, Grid, IconButton, Loader, Panel, CustomProvider } from 'rsuite'
import PlayIcon from '@rsuite/icons/PlayOutline';

import { ExecutionResponse, runCode, trackEvent } from '../../utils'
import { createTurnstileGate, type TurnstileGate } from '../../turnstile'
import RightPanel from '../RightPanel'
import Header from '../Header'
import Footer from '../Footer'
import Editor from '../Editor'
import { CodeContext } from '../CodeContext'

import styles from './index.module.css'
import CodeLanguageSelector from '../CodeLanguageSelector';
import useDarkMode from '../../hooks/useDarkMode';

const VITE_TURNSTILE_SITEKEY = '0x4AAAAAAA_K0T_2LZ0rgUtv';

const App: React.FunctionComponent = () => {
  const { getCode, onChangeRightPanelMode, codeLanguage, onLanguageChange } = useContext(CodeContext)
  const [loading, setLoading] = useState<boolean>(false)
  const [running, setRunning] = useState<boolean>(false)
  const [resp, setResponse] = useState<ExecutionResponse|null>(null)
  const handleExecutionRef = useRef<() => Promise<void>>(undefined)
  const runningRef = useRef(false)
  const [darkMode] = useDarkMode()
  const turnstileRef = useRef<HTMLDivElement>(null)
  const gateRef = useRef<TurnstileGate | null>(null)

  if (!gateRef.current) {
    gateRef.current = createTurnstileGate({ sitekey: VITE_TURNSTILE_SITEKEY })
  }

  useEffect(() => {
    return () => {
      gateRef.current?.remove()
    }
  }, [])

  const handleExecution = async (): Promise<void> => {
    if (runningRef.current) {
      return
    }
    runningRef.current = true
    setRunning(true)
    setResponse(null)

    trackEvent()
    try {
      // Keep the loader off until the widget has a token so an interactive
      // challenge is not covered by the editor backdrop (z-index 10).
      const turnstileToken = await gateRef.current!.getToken(turnstileRef.current)
      if (gateRef.current!.mode === 'cloudflare' && !turnstileToken) {
        throw new Error('Could not complete bot check. Please try again.')
      }
      setLoading(true)
      // After await: do not use render-time `code` (stale vs example select).
      setResponse(await runCode(getCode(), codeLanguage, turnstileToken))
    } catch (error) {
      setResponse({ error: String(error) })
    } finally {
      runningRef.current = false
      setRunning(false)
      setLoading(false)
      onChangeRightPanelMode(false)
    }
  }
  handleExecutionRef.current = handleExecution

  return (
    <CustomProvider theme={darkMode ? 'dark' : 'light'}>
      <div className={styles.shell}>
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
                    <div ref={turnstileRef} className={styles.turnstile} />
                    <CodeLanguageSelector codeLanguage={codeLanguage} onLanguageChange={onLanguageChange} />
                    <IconButton onClick={handleExecution} icon={<PlayIcon />} disabled={running}>
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
        </Grid>
        <Footer />
      </div>
    </CustomProvider>
  );
}

export default App;
