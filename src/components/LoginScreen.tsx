import { ChatCircleDots, Eye, EyeSlash } from '@phosphor-icons/react'
import { useId, useState, type FormEvent } from 'react'
import { apiUrlFor, createGreenApi } from '../api/greenApi'
import type { Credentials, InstanceState } from '../api/types'
import { Spinner } from './Spinner'
import styles from './LoginScreen.module.css'

interface Props {
  onLogin: (credentials: Credentials) => void
}

const STATE_ERRORS: Partial<Record<InstanceState, string>> = {
  notAuthorized:
    'Инстанс не авторизован. В приложении MAX откройте «Профиль → Устройства» и отсканируйте QR-код со страницы инстанса.',
  starting: 'Инстанс запускается. Попробуйте через пару минут.',
  blocked: 'Аккаунт инстанса заблокирован.',
  suspended: 'Инстанс приостановлен — проверьте оплату в личном кабинете.',
  sleepMode: 'Телефон с MAX не в сети. Откройте приложение MAX на телефоне.',
}

export function LoginScreen({ onLogin }: Props) {
  const [idInstance, setIdInstance] = useState('')
  const [apiTokenInstance, setApiTokenInstance] = useState('')
  const [customApiUrl, setCustomApiUrl] = useState<string | null>(null)
  const [editingApiUrl, setEditingApiUrl] = useState(false)
  const [showToken, setShowToken] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const errorId = useId()

  const apiUrl = customApiUrl ?? apiUrlFor(idInstance)
  const canSubmit = idInstance.trim() !== '' && apiTokenInstance.trim() !== '' && apiUrl.trim() !== ''

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    if (!canSubmit || loading) return

    const credentials: Credentials = {
      idInstance: idInstance.trim(),
      apiTokenInstance: apiTokenInstance.trim(),
      apiUrl: apiUrl.trim(),
    }
    setLoading(true)
    setError(null)
    try {
      const { stateInstance } = await createGreenApi(credentials).getStateInstance()
      if (stateInstance === 'authorized') {
        onLogin(credentials)
        return
      }
      setError(STATE_ERRORS[stateInstance] ?? `Инстанс недоступен (состояние: ${stateInstance}).`)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Не удалось подключиться к GREEN-API.')
    }
    setLoading(false)
  }

  return (
    <main className={styles.screen}>
      <form className={styles.card} onSubmit={handleSubmit} noValidate>
        <div className={styles.logo} aria-hidden>
          <ChatCircleDots size={34} weight="fill" />
        </div>
        <h1 className={styles.title}>Вход в MAX</h1>
        <p className={styles.subtitle}>
          Введите данные инстанса из{' '}
          <a href="https://console.green-api.com" target="_blank" rel="noreferrer">
            личного кабинета GREEN-API
          </a>
        </p>

        <label className={styles.field}>
          <span className={styles.label}>idInstance</span>
          <input
            className={styles.input}
            value={idInstance}
            onChange={(e) => setIdInstance(e.target.value)}
            placeholder="3100123456"
            inputMode="numeric"
            autoComplete="username"
            autoFocus
            aria-describedby={error ? errorId : undefined}
          />
        </label>

        <label className={styles.field}>
          <span className={styles.label}>apiTokenInstance</span>
          <span className={styles.inputWrap}>
            <input
              className={styles.input}
              value={apiTokenInstance}
              onChange={(e) => setApiTokenInstance(e.target.value)}
              type={showToken ? 'text' : 'password'}
              placeholder="Токен инстанса"
              autoComplete="current-password"
              spellCheck={false}
              aria-describedby={error ? errorId : undefined}
            />
            <button
              type="button"
              className={styles.eye}
              onClick={() => setShowToken((v) => !v)}
              aria-label={showToken ? 'Скрыть токен' : 'Показать токен'}
            >
              {showToken ? <EyeSlash size={20} /> : <Eye size={20} />}
            </button>
          </span>
        </label>

        {editingApiUrl ? (
          <label className={styles.field}>
            <span className={styles.label}>apiUrl</span>
            <input
              className={styles.input}
              value={apiUrl}
              onChange={(e) => setCustomApiUrl(e.target.value)}
              placeholder="https://3100.api.green-api.com"
              inputMode="url"
              spellCheck={false}
            />
          </label>
        ) : (
          <p className={styles.apiUrl}>
            API: <span>{apiUrl}</span>
            <button type="button" className={styles.link} onClick={() => setEditingApiUrl(true)}>
              изменить
            </button>
          </p>
        )}

        {error && (
          <p className={styles.error} id={errorId} role="alert">
            {error}
          </p>
        )}

        <button className={styles.submit} type="submit" disabled={!canSubmit || loading}>
          {loading ? <Spinner /> : 'Войти'}
        </button>
      </form>
    </main>
  )
}
