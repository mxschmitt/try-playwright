import { useState, useContext, useEffect, useRef } from 'react';
import { Col, Container, Content, CustomProvider, Grid, HStack, IconButton, Loader, Panel, Row } from 'rsuite'
import PlayIcon from '@rsuite/icons/PlayOutline';

import { ExecutionResponse, runCode, trackEvent } from '../../utils'
import { createTurnstileGate, type TurnstileGate } from '../../turnstile'
import RightPanel from '../RightPanel'
import Header from '../Header'
import Footer from '../Footer'
import Editor from '../Editor'
import { CodeContext } from '../CodeContext'

import CodeLanguageSelector from '../CodeLanguageSelector';
import useDarkMode from '../../hooks/useDarkMode';
import styles from './index.module.css'

const VITE_TURNSTILE_SITEKEY = '0x4AAAAAAA_K0T_2LZ0rgUtv';

const filledPanelBody = {
  flex: 1,
  minHeight: 0,
  display: 'flex',
  flexDirection: 'column',
} as const

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
      const result = await runCode(getCode(), codeLanguage, turnstileToken, (partial) => {
        setLoading(false)
        onChangeRightPanelMode(false)
        setResponse(partial)
      })
      setResponse(result)
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
      <Container h="100%">
        <Header />
        <Content minh={0} overflow="auto" display="flex" direction="column">
          <Grid fluid data-testid="app-main" w="100%" flex={1} minh={0} display="flex" direction="column">
            <Row flex={1} minh={0} w="100%">
              <Col span={{ xs: 24, md: 12 }} minw={0} minh={0} pos="relative" display="flex" direction="column" className={styles.editorColumn} data-testid="app-editor-column">
                {loading && <Loader center content="loading" backdrop style={{ zIndex: 10 }} />}
                <Panel
                  bodyFill
                  flex={1}
                  minh={0}
                  w="100%"
                  display="flex"
                  direction="column"
                  overflow="hidden"
                  bodyProps={{ style: filledPanelBody }}
                  header={
                    <HStack justify="space-between" align="center" w="100%" spacing={12}>
                      <span>Editor</span>
                      <HStack spacing={10} align="center">
                        <div ref={turnstileRef} />
                        <CodeLanguageSelector codeLanguage={codeLanguage} onLanguageChange={onLanguageChange} />
                        <IconButton onClick={handleExecution} icon={<PlayIcon />} disabled={running}>
                            Run
                        </IconButton>
                      </HStack>
                    </HStack>
                  }
                >
                  <Editor onExecution={handleExecutionRef} />
                </Panel>
              </Col>
              <Col span={{ xs: 24, md: 12 }} minw={0} display="flex" direction="column" data-testid="app-examples-column">
                <RightPanel resp={resp} />
              </Col>
            </Row>
          </Grid>
        </Content>
        <Footer />
      </Container>
    </CustomProvider>
  );
}

export default App;
