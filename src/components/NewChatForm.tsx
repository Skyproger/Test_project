import { ArrowRight } from '@phosphor-icons/react'
import { useId, useState, type FormEvent } from 'react'
import { normalizePhone } from '../lib/phone'
import { Spinner } from './Spinner'
import styles from './NewChatForm.module.css'

interface Props {
  onCreate: (phone: string) => Promise<void>
}

export function NewChatForm({ onCreate }: Props) {
  const [value, setValue] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const hintId = useId()

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    if (loading) return
    const phone = normalizePhone(value)
    if (!phone) {
      setError('Введите номер с кодом страны, например +7 999 123-45-67')
      return
    }

    setLoading(true)
    setError(null)
    try {
      await onCreate(phone)
      setValue('')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Не удалось создать чат.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <form className={styles.form} onSubmit={handleSubmit} noValidate>
      <label className={styles.label} htmlFor={`${hintId}-input`}>
        Новый чат
      </label>
      <div className={styles.row}>
        <input
          id={`${hintId}-input`}
          className={styles.input}
          value={value}
          onChange={(e) => {
            setValue(e.target.value)
            setError(null)
          }}
          type="tel"
          inputMode="tel"
          autoComplete="tel"
          placeholder="Номер телефона получателя"
          aria-describedby={hintId}
          aria-invalid={error ? true : undefined}
          autoFocus
        />
        <button className={styles.submit} type="submit" disabled={!value.trim() || loading} aria-label="Создать чат">
          {loading ? <Spinner size={18} /> : <ArrowRight size={20} weight="bold" />}
        </button>
      </div>
      <p className={styles.hint} id={hintId} data-error={error ? true : undefined} role={error ? 'alert' : undefined}>
        {error ?? 'Номер с кодом страны — у получателя должен быть аккаунт MAX'}
      </p>
    </form>
  )
}
