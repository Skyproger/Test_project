import { NotePencil, SignOut, WarningCircle, X } from '@phosphor-icons/react'
import { useState } from 'react'
import type { Connection } from '../hooks/useNotificationPolling'
import type { ReceivingSetup } from '../lib/receiving'
import type { Chat } from '../state/chats'
import { ChatListItem } from './ChatListItem'
import { NewChatForm } from './NewChatForm'
import styles from './Sidebar.module.css'

interface Props {
  idInstance: string
  chats: Chat[]
  activeChatId: string | null
  connection: Connection
  setup: ReceivingSetup | null
  onSelect: (chatId: string) => void
  onCreate: (phone: string) => Promise<void>
  onLogout: () => void
}

export function Sidebar({ idInstance, chats, activeChatId, connection, setup, onSelect, onCreate, onLogout }: Props) {
  const [formOpen, setFormOpen] = useState(false)
  const showForm = formOpen || chats.length === 0

  return (
    <aside className={styles.sidebar}>
      <header className={styles.header}>
        <h1 className={styles.title}>Чаты</h1>
        {chats.length > 0 && (
          <button
            className={styles.iconButton}
            onClick={() => setFormOpen((open) => !open)}
            aria-label={formOpen ? 'Закрыть' : 'Новый чат'}
            title={formOpen ? 'Закрыть' : 'Новый чат'}
          >
            {formOpen ? <X size={22} /> : <NotePencil size={22} />}
          </button>
        )}
      </header>

      {showForm && (
        <NewChatForm
          onCreate={async (phone) => {
            await onCreate(phone)
            setFormOpen(false)
          }}
        />
      )}

      <Notices connection={connection} setup={setup} />

      <nav className={styles.list} aria-label="Список чатов">
        {chats.length === 0 ? (
          <p className={styles.placeholder}>Здесь появятся ваши переписки</p>
        ) : (
          chats.map((chat) => (
            <ChatListItem
              key={chat.chatId}
              chat={chat}
              active={chat.chatId === activeChatId}
              onSelect={() => onSelect(chat.chatId)}
            />
          ))
        )}
      </nav>

      <footer className={styles.footer}>
        <div className={styles.account}>
          <span className={styles.accountLabel}>Инстанс</span>
          <span className={styles.accountId}>{idInstance}</span>
        </div>
        <button className={styles.iconButton} onClick={onLogout} aria-label="Выйти" title="Выйти">
          <SignOut size={22} />
        </button>
      </footer>
    </aside>
  )
}

function Notices({ connection, setup }: { connection: Connection; setup: ReceivingSetup | null }) {
  const notices: { tone: 'warning' | 'danger'; text: string }[] = []

  if (connection.kind === 'retrying') {
    notices.push({ tone: 'warning', text: `Нет связи: ${connection.message} Переподключаемся…` })
  }
  if (connection.kind === 'stopped') {
    notices.push({ tone: 'danger', text: `Приём сообщений остановлен: ${connection.message} Войдите заново.` })
  }
  if (setup?.kind === 'enabled') {
    notices.push({
      tone: 'warning',
      text: 'Включили приём входящих в настройках инстанса. GREEN-API применяет их до нескольких минут.',
    })
  }
  if (setup?.kind === 'webhook') {
    notices.push({
      tone: 'danger',
      text: `У инстанса задан webhookUrl (${setup.webhookUrl}) — входящие уходят туда. Очистите его в личном кабинете, чтобы видеть ответы здесь.`,
    })
  }

  if (notices.length === 0) return null
  return (
    <div className={styles.notices}>
      {notices.map((notice) => (
        <p key={notice.text} className={styles.notice} data-tone={notice.tone} role="status">
          <WarningCircle size={18} weight="fill" className={styles.noticeIcon} />
          {notice.text}
        </p>
      ))}
    </div>
  )
}
