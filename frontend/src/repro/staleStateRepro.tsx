import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from 'react'

type Mailbox = {
  code: string
  getFromSetterRef: () => string
  getFromEffectRef: () => string
  onChange: (value: string) => void
}

const Ctx = createContext<Mailbox>({
  code: '',
  getFromSetterRef: () => '',
  getFromEffectRef: () => '',
  onChange: () => {},
})

const Provider = ({ children }: { children: ReactNode }) => {
  const [code, setCode] = useState('')
  const setterRef = useRef(code)
  const effectRef = useRef(code)

  useEffect(() => {
    effectRef.current = code
  }, [code])

  const onChange = (next: string) => {
    setterRef.current = next
    setCode(next)
  }

  return (
    <Ctx.Provider value={{
      code,
      getFromSetterRef: () => setterRef.current,
      getFromEffectRef: () => effectRef.current,
      onChange,
    }}>
      {children}
    </Ctx.Provider>
  )
}

const Probe = () => {
  const { code, getFromSetterRef, getFromEffectRef, onChange } = useContext(Ctx)
  const [sameTickRender, setSameTickRender] = useState('unset')
  const [sameTickSetterRef, setSameTickSetterRef] = useState('unset')
  const [sameTickEffectRef, setSameTickEffectRef] = useState('unset')
  const [afterAwaitClosure, setAfterAwaitClosure] = useState('unset')
  const [afterAwaitSetterRef, setAfterAwaitSetterRef] = useState('unset')

  return (
    <div>
      <button
        onClick={async () => {
          onChange('example-8-code')
          setSameTickRender(code)
          setSameTickSetterRef(getFromSetterRef())
          setSameTickEffectRef(getFromEffectRef())
          const capturedFromRender = code
          await new Promise((resolve) => setTimeout(resolve, 20))
          setAfterAwaitClosure(capturedFromRender)
          setAfterAwaitSetterRef(getFromSetterRef())
        }}
      >
        select-and-run
      </button>
      <div data-testid="same-tick-render">{sameTickRender}</div>
      <div data-testid="same-tick-setter-ref">{sameTickSetterRef}</div>
      <div data-testid="same-tick-effect-ref">{sameTickEffectRef}</div>
      <div data-testid="after-await-closure">{afterAwaitClosure}</div>
      <div data-testid="after-await-setter-ref">{afterAwaitSetterRef}</div>
    </div>
  )
}

/** Characterization of stale React state vs a mailbox ref. Not production UI. */
export const StaleStateRepro = () => (
  <Provider>
    <Probe />
  </Provider>
)
