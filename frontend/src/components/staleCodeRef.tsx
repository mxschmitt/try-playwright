import { createContext, useContext, useRef, useState, type ReactNode } from 'react'

type LatestCode = {
  code: string
  getCode: () => string
  onChange: (value: string) => void
}

const Ctx = createContext<LatestCode>({
  code: '',
  getCode: () => '',
  onChange: (_value: string) => {},
})

const Provider = ({ children }: { children: ReactNode }) => {
  const [code, setCode] = useState('')
  const latestCode = useRef(code)
  const onChange = (next: string) => {
    latestCode.current = next
    setCode(next)
  }
  return (
    <Ctx.Provider value={{ code, getCode: () => latestCode.current, onChange }}>
      {children}
    </Ctx.Provider>
  )
}

const Probe = () => {
  const { code, getCode, onChange } = useContext(Ctx)
  const [fromRender, setFromRender] = useState('unset')
  const [fromRef, setFromRef] = useState('unset')
  return (
    <div>
      <button
        onClick={() => {
          onChange('example-8-code')
          setFromRender(code)
          setFromRef(getCode())
        }}
      >
        select-and-read
      </button>
      <div data-testid="from-render">{fromRender}</div>
      <div data-testid="from-ref">{fromRef}</div>
    </div>
  )
}

/** Story used by staleCodeRef.spec.tsx — not production UI. */
export const StaleCodeRefRepro = () => (
  <Provider>
    <Probe />
  </Provider>
)
