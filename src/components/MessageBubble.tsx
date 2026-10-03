import { ArrowClockwise } from '@phosphor-icons/react'
import { formatTime } from '../lib/format'
import type { Message } from '../state/chats'
import { MessageStatusIcon } from './MessageStatusIcon'
import styles from './MessageBubble.module.css'

interface Props {
  message: Message
  /** Идёт сразу за сообщением того же автора — меньше отступ. */
  grouped: boolean
  onRetry: () => void
}

export function MessageBubble({ message, grouped, onRetry }: Props) {
  const outgoing = message.direction === 'out'

  return (
    <div className={styles.row} data-out={outgoing || undefined} data-grouped={grouped || undefined}>
      <div className={styles.bubble}>
        <span className={styles.text}>{message.text}</span>
        <span className={styles.meta}>
          <time dateTime={new Date(message.timestamp).toISOString()}>{formatTime(message.timestamp)}</time>
          {message.status && <MessageStatusIcon status={message.status} className={styles.status} />}
        </span>
      </div>
      {message.status === 'failed' && (
        <div className={styles.failed}>
          <span>{message.error ?? 'Не отправлено'}</span>
          <button className={styles.retry} onClick={onRetry}>
            <ArrowClockwise size={14} weight="bold" />
            Повторить
          </button>
        </div>
      )}
    </div>
  )
}
