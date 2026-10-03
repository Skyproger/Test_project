import { formatListTime } from '../lib/format'
import { chatTitle, lastActivity, type Chat } from '../state/chats'
import { Avatar } from './Avatar'
import { MessageStatusIcon } from './MessageStatusIcon'
import styles from './ChatListItem.module.css'

interface Props {
  chat: Chat
  active: boolean
  onSelect: () => void
}

export function ChatListItem({ chat, active, onSelect }: Props) {
  const last = chat.messages.at(-1)
  const title = chatTitle(chat)

  return (
    <button className={styles.item} data-active={active || undefined} onClick={onSelect} aria-current={active}>
      <Avatar seed={chat.chatId} name={chat.name} />
      <span className={styles.body}>
        <span className={styles.row}>
          <span className={styles.title}>{title}</span>
          <span className={styles.time}>{formatListTime(lastActivity(chat))}</span>
        </span>
        <span className={styles.row}>
          <span className={styles.preview}>
            {last?.direction === 'out' && <span className={styles.you}>Вы: </span>}
            {last ? last.text : 'Нет сообщений'}
          </span>
          {chat.unread > 0 ? (
            <span className={styles.unread} aria-label={`Непрочитанных: ${chat.unread}`}>
              {chat.unread}
            </span>
          ) : (
            last?.status && <MessageStatusIcon status={last.status} />
          )}
        </span>
      </span>
    </button>
  )
}
