import { useState } from 'react'
import type { Credentials } from './api/types'
import { LoginScreen } from './components/LoginScreen'
import { Messenger } from './components/Messenger'
import { clearCredentials, loadCredentials, saveCredentials } from './lib/storage'

export default function App() {
  const [credentials, setCredentials] = useState<Credentials | null>(loadCredentials)

  if (!credentials) {
    return (
      <LoginScreen
        onLogin={(next) => {
          saveCredentials(next)
          setCredentials(next)
        }}
      />
    )
  }

  return (
    <Messenger
      key={credentials.idInstance}
      credentials={credentials}
      onLogout={() => {
        clearCredentials()
        setCredentials(null)
      }}
    />
  )
}
