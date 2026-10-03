import type { Credentials } from '../api/types'
import { initialChatsState, type ChatsState } from '../state/chats'

const CREDENTIALS_KEY = 'max-chat:credentials'
const chatsKey = (idInstance: string) => `max-chat:chats:${idInstance}`

/* localStorage может быть недоступен (приватный режим, запрет cookies) — тогда просто не сохраняем. */

function read<T>(key: string): T | null {
  try {
    const raw = localStorage.getItem(key)
    return raw ? (JSON.parse(raw) as T) : null
  } catch {
    return null
  }
}

function write(key: string, value: unknown): void {
  try {
    localStorage.setItem(key, JSON.stringify(value))
  } catch {
    // нет места или хранилище запрещено
  }
}

function remove(key: string): void {
  try {
    localStorage.removeItem(key)
  } catch {
    // хранилище запрещено
  }
}

export function loadCredentials(): Credentials | null {
  const value = read<Credentials>(CREDENTIALS_KEY)
  return value?.idInstance && value.apiTokenInstance && value.apiUrl ? value : null
}

export function saveCredentials(credentials: Credentials): void {
  write(CREDENTIALS_KEY, credentials)
}

export function clearCredentials(): void {
  remove(CREDENTIALS_KEY)
}

/**
 * История чатов хранится в браузере отдельно для каждого инстанса.
 * Сообщения, которые не успели уйти до перезагрузки страницы, помечаем как неотправленные.
 */
export function loadChats(idInstance: string): ChatsState {
  const saved = read<Pick<ChatsState, 'chats'>>(chatsKey(idInstance))
  if (!saved?.chats) return initialChatsState
  const chats = Object.fromEntries(
    Object.entries(saved.chats).map(([chatId, chat]) => [
      chatId,
      {
        ...chat,
        messages: chat.messages.map((m) =>
          m.status === 'pending' ? { ...m, status: 'failed' as const, error: 'Не отправлено' } : m,
        ),
      },
    ]),
  )
  return { chats, activeChatId: null }
}

export function saveChats(idInstance: string, state: ChatsState): void {
  write(chatsKey(idInstance), { chats: state.chats })
}

export function clearChats(idInstance: string): void {
  remove(chatsKey(idInstance))
}
