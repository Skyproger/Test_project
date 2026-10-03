import { PaperPlaneRight } from '@phosphor-icons/react'
import { useLayoutEffect, useRef, useState, type FormEvent, type KeyboardEvent } from 'react'
import styles from './Composer.module.css'

interface Props {
  onSend: (text: string) => void
}

const MAX_HEIGHT = 200

export function Composer({ onSend }: Props) {
  const [text, setText] = useState('')
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const canSend = text.trim() !== ''

  // Поле растёт вместе с текстом до MAX_HEIGHT, дальше — прокрутка.
  useLayoutEffect(() => {
    const el = inputRef.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = `${Math.min(el.scrollHeight, MAX_HEIGHT)}px`
  }, [text])

  function send() {
    if (!canSend) return
    onSend(text.trim())
    setText('')
    inputRef.current?.focus()
  }

  function handleSubmit(event: FormEvent) {
    event.preventDefault()
    send()
  }

  // Enter — отправить, Shift+Enter — новая строка. Во время набора через IME Enter не перехватываем.
  function handleKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing) {
      event.preventDefault()
      send()
    }
  }

  return (
    <form className={styles.composer} onSubmit={handleSubmit}>
      <div className={styles.inner}>
        <textarea
          ref={inputRef}
          className={styles.input}
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Сообщение"
          aria-label="Текст сообщения"
          rows={1}
          autoFocus
        />
        <button className={styles.send} type="submit" disabled={!canSend} aria-label="Отправить">
          <PaperPlaneRight size={22} weight="fill" />
        </button>
      </div>
    </form>
  )
}
