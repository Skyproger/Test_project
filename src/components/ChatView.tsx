import { CaretLeft } from '@phosphor-icons/react'
import { formatPhone } from '../lib/phone'
import { chatTitle, type Chat, type Message } from '../state/chats'
import { Avatar } from './Avatar'
import { Composer } from './Composer'
import { MessageList } from './MessageList'
import styles from './ChatView.module.css'

interface Props {
  chat: Chat
  onSend: (text: string) => void
  onRetry: (message: Message) => void
  onBack: () => void
}

export function ChatView({ chat, onSend, onRetry, onBack }: Props) {
  const title = chatTitle(chat)
  const subtitle = chat.name && chat.phone ? formatPhone(chat.phone) : 'MAX'

  return (
    <section className={styles.chat} aria-label={`Чат: ${title}`}>
      <header className={styles.header}>
        <button className={styles.back} onClick={onBack} aria-label="Назад к списку чатов">
          <CaretLeft size={24} />
        </button>
        <Avatar seed={chat.chatId} name={chat.name} size={40} />
        <div className={styles.info}>
          <h2 className={styles.title}>{title}</h2>
          <p className={styles.subtitle}>{subtitle}</p>
        </div>
      </header>
      <MessageList messages={chat.messages} onRetry={onRetry} />
      <Composer onSend={onSend} />
    </section>
  )
}
