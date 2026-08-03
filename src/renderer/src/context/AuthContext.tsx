import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode
} from 'react'
import type { AuthState, CredentialsInput, CredentialsState } from '@shared/types'
import { api } from '@/lib/bridge'

const INITIAL_AUTH: AuthState = { status: 'signed-out', account: null, error: null }
const INITIAL_CREDENTIALS: CredentialsState = {
  configured: false,
  source: 'none',
  clientIdPreview: null,
  hasSecret: false,
  readOnly: false
}

interface AuthContextValue {
  auth: AuthState
  credentials: CredentialsState
  isReady: boolean
  isBusy: boolean
  error: string | null
  signIn: () => Promise<void>
  signOut: () => Promise<void>
  saveCredentials: (input: CredentialsInput) => Promise<void>
  clearCredentials: () => Promise<void>
  dismissError: () => void
}

const AuthContext = createContext<AuthContextValue | null>(null)

/** Google connection state, shared by the widget and the settings window. */
export function AuthProvider({ children }: { children: ReactNode }): React.JSX.Element {
  const [auth, setAuth] = useState<AuthState>(INITIAL_AUTH)
  const [credentials, setCredentials] = useState<CredentialsState>(INITIAL_CREDENTIALS)
  const [isReady, setIsReady] = useState(false)
  const [isBusy, setIsBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let active = true

    Promise.all([api.auth.getState(), api.auth.getCredentials()])
      .then(([authState, credentialsState]) => {
        if (!active) return
        setAuth(authState)
        setCredentials(credentialsState)
        setIsReady(true)
      })
      .catch((cause: Error) => {
        if (!active) return
        setError(cause.message)
        setIsReady(true)
      })

    const unsubscribeAuth = api.auth.onChange((state) => {
      if (!active) return
      setAuth(state)
      setIsBusy(state.status === 'signing-in')
    })
    const unsubscribeCredentials = api.auth.onCredentialsChange((state) => {
      if (active) setCredentials(state)
    })

    return () => {
      active = false
      unsubscribeAuth()
      unsubscribeCredentials()
    }
  }, [])

  const run = useCallback(async (action: () => Promise<void>) => {
    setIsBusy(true)
    setError(null)
    try {
      await action()
    } catch (cause) {
      setError((cause as Error).message)
    } finally {
      setIsBusy(false)
    }
  }, [])

  const signIn = useCallback(
    () =>
      run(async () => {
        setAuth(await api.auth.signIn())
      }),
    [run]
  )

  const signOut = useCallback(
    () =>
      run(async () => {
        setAuth(await api.auth.signOut())
      }),
    [run]
  )

  const saveCredentials = useCallback(
    (input: CredentialsInput) =>
      run(async () => {
        setCredentials(await api.auth.saveCredentials(input))
      }),
    [run]
  )

  const clearCredentials = useCallback(
    () =>
      run(async () => {
        setCredentials(await api.auth.clearCredentials())
      }),
    [run]
  )

  const dismissError = useCallback(() => setError(null), [])

  const value = useMemo<AuthContextValue>(
    () => ({
      auth,
      credentials,
      isReady,
      isBusy,
      error: error ?? auth.error,
      signIn,
      signOut,
      saveCredentials,
      clearCredentials,
      dismissError
    }),
    [auth, credentials, isReady, isBusy, error, signIn, signOut, saveCredentials, clearCredentials, dismissError]
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext)
  if (!context) throw new Error('useAuth must be used inside <AuthProvider>')
  return context
}
