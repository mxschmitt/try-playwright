import App from '.'
import CodeContextProvider from '../CodeContext'

export const Desktop = () => (
  <>
    <style>{'html, body, #root { height: 100%; margin: 0; }'}</style>
    <CodeContextProvider>
      <App />
    </CodeContextProvider>
  </>
)
