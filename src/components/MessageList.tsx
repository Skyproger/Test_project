import { Fragment, useLayoutEffect, useRef } from 'react'
import { formatDay, isSameDay } from '../lib/format'
import type { Message } from '../state/chats'
import { MessageBubble } from './MessageBubble'
import styles from './MessageList.module.css'

interface Props {
  messages: Message[]
  onRetry: (message: Message) => void
}

/** Насколько близко к низу (px) лента считается «прокрученной до конца». */
const STICK_THRESHOLD = 120

export function MessageList({ messages, onRetry }: Props) {
  const scrollRef = useRef<HTMLDivElement>(null)
  const stickToBottom = useRef(true)
  const last = messages.at(-1)

  // Новое сообщение прокручивает ленту вниз, если пользователь и так был внизу
  // или сам его отправил. Если он листает историю — не дёргаем.
  useLayoutEffect(() => {
    const el = scrollRef.current
    if (!el) return
    if (stickToBottom.current || last?.direction === 'out') el.scrollTop = el.scrollHeight
  }, [last?.id, last?.direction])

  function handleScroll() {
    const el = scrollRef.current
    if (el) stickToBottom.current = el.scrollHeight - el.scrollTop - el.clientHeight < STICK_THRESHOLD
  }

  return (
    <div className={styles.scroll} ref={scrollRef} onScroll={handleScroll}>
      <div className={styles.feed} role="log" aria-live="polite" aria-label="Сообщения">
        {messages.length === 0 && <p className={styles.empty}>Напишите первое сообщение</p>}
        {messages.map((message, index) => {
          const prev = messages[index - 1]
          const newDay = !prev || !isSameDay(prev.timestamp, message.timestamp)
          const grouped = !newDay && prev.direction === message.direction
          return (
            <Fragment key={message.id}>
              {newDay && (
                <div className={styles.day}>
                  <span>{formatDay(message.timestamp)}</span>
                </div>
              )}
              <MessageBubble message={message} grouped={grouped} onRetry={() => onRetry(message)} />
            </Fragment>
          )
        })}
      </div>
    </div>
  )
}
