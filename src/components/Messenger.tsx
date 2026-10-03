import { useCallback, useEffect, useMemo, useReducer, useState } from 'react'
import { createGreenApi } from '../api/greenApi'
import type { Credentials, NotificationBody } from '../api/types'
import { useNotificationPolling } from '../hooks/useNotificationPolling'
import { toChatEvent } from '../lib/notifications'
import { ensureReceiving, type ReceivingSetup } from '../lib/receiving'
import { resolveChatId } from '../lib/resolveChatId'
import { loadChats, saveChats } from '../lib/storage'
import { chatsReducer, sortedChats } from '../state/chats'
import { ChatView } from './ChatView'
import { EmptyChat } from './EmptyChat'
import { Sidebar } from './Sidebar'
import styles from './Messenger.module.css'

interface Props {
  credentials: Credentials
  onLogout: () => void
}

export function Messenger({ credentials, onLogout }: Props) {
  const api = useMemo(() => createGreenApi(credentials), [credentials])
  const [state, dispatch] = useReducer(chatsReducer, credentials.idInstance, loadChats)
  const [setup, setSetup] = useState<ReceivingSetup | null>(null)

  useEffect(() => {
    saveChats(credentials.idInstance, state)
  }, [credentials.idInstance, state])

  useEffect(() => {
    let cancelled = false
    ensureReceiving(api)
      .then((result) => !cancelled && setSetup(result))
      // Настройки — вспомогательный шаг: если не вышло, чат всё равно работает.
      .catch((error: unknown) => console.warn('Не удалось проверить настройки инстанса', error))
    return () => {
      cancelled = true
    }
  }, [api])

  const handleNotification = useCallback((body: NotificationBody) => {
    const event = toChatEvent(body)
    if (event) dispatch({ type: 'eventReceived', event })
  }, [])
  const connection = useNotificationPolling(api, handleNotification)

  const createChat = useCallback(
    async (phone: string) => {
      const chatId = await resolveChatId(api, phone)
      dispatch({ type: 'chatOpened', chatId, phone, now: Date.now() })
    },
    [api],
  )

  const deliver = useCallback(
    (chatId: string, localId: string, text: string) => {
      api.sendMessage(chatId, text).then(
        ({ idMessage }) => dispatch({ type: 'messageSent', chatId, localId, id: idMessage }),
        (error: unknown) =>
          dispatch({
            type: 'messageFailed',
            chatId,
            localId,
            error: error instanceof Error ? error.message : 'Не удалось отправить',
          }),
      )
    },
    [api],
  )

  const sendMessage = useCallback(
    (chatId: string, text: string) => {
      const localId = `local-${crypto.randomUUID()}`
      dispatch({
        type: 'messageQueued',
        message: { id: localId, chatId, text, direction: 'out', timestamp: Date.now(), status: 'pending' },
      })
      deliver(chatId, localId, text)
    },
    [deliver],
  )

  const retryMessage = useCallback(
    (chatId: string, localId: string, text: string) => {
      dispatch({ type: 'messageRetried', chatId, localId })
      deliver(chatId, localId, text)
    },
    [deliver],
  )

  const chats = sortedChats(state)
  const activeChat = state.activeChatId ? state.chats[state.activeChatId] : undefined

  return (
    <div className={styles.layout} data-view={activeChat ? 'chat' : 'list'}>
      <Sidebar
        idInstance={credentials.idInstance}
        chats={chats}
        activeChatId={state.activeChatId}
        connection={connection}
        setup={setup}
        onSelect={(chatId) => dispatch({ type: 'chatSelected', chatId })}
        onCreate={createChat}
        onLogout={onLogout}
      />
      {activeChat ? (
        <ChatView
          key={activeChat.chatId}
          chat={activeChat}
          onSend={(text) => sendMessage(activeChat.chatId, text)}
          onRetry={(message) => retryMessage(activeChat.chatId, message.id, message.text)}
          onBack={() => dispatch({ type: 'chatSelected', chatId: null })}
        />
      ) : (
        <EmptyChat />
      )}
    </div>
  )
}
