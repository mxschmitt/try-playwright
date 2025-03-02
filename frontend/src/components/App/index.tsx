import { useState, useContext, useRef } from 'react';
import { Col, Grid, IconButton, Loader, Panel, CustomProvider } from 'rsuite'
import PlayIcon from '@rsuite/icons/PlayOutline';

import { ExecutionResponse, runCode, trackEvent } from '../../utils'
import RightPanel from '../RightPanel'
import Header from '../Header'
import Editor from '../Editor'
import { CodeContext } from '../CodeContext'

import styles from './index.module.css'
import CodeLanguageSelector from '../CodeLanguageSelector';
import useDarkMode from '../../hooks/useDarkMode';

const VITE_TURNSTILE_SITEKEY = '0x4AAAAAAA_K0T_2LZ0rgUtv';

const App: React.FunctionComponent = () => {
  const { code, onChangeRightPanelMode, codeLanguage, onLanguageChange } = useContext(CodeContext)
  const [loading, setLoading] = useState<boolean>(false)
  const [resp, setResponse] = useState<ExecutionResponse|null>(null)
  const handleExecutionRef = useRef<() => Promise<void>>()
  const [darkMode] = useDarkMode()
  const turnstileRef = useRef<HTMLDivElement>(null)

  const handleExecution = async (): Promise<void> => {
    setLoading(true)
    setResponse(null)

    trackEvent()
    const turnstileToken = await new Promise<string>((resolve) => {
      try {
        (window as any).turnstile.reset();
      } catch (error) {}
      (window as any).turnstile.execute(turnstileRef.current, {
        sitekey: VITE_TURNSTILE_SITEKEY,
        callback: (token: string) => resolve(token),
        'error-callback': () => resolve(''),
      });
    });
    setResponse(await runCode(code, codeLanguage, turnstileToken))
    setLoading(false)
    onChangeRightPanelMode(false)
  }
  handleExecutionRef.current = handleExecution

  return (
    <CustomProvider theme={darkMode ? 'dark' : 'light'}>
      <div ref={turnstileRef} style={{ display: 'none' }} />
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
        <Col xs={24} md={12}>
          <RightPanel resp={resp} />
        </Col>
      </Grid >
    </CustomProvider>
  );
}

export default App;
