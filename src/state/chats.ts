import type { ChatEvent } from '../lib/notifications'
import { formatPhone } from '../lib/phone'

export type MessageStatus = 'pending' | 'sent' | 'delivered' | 'read' | 'failed'

export interface Message {
  /** idMessage из GREEN-API; у ещё не отправленного — локальный id. */
  id: string
  chatId: string
  text: string
  direction: 'in' | 'out'
  /** Миллисекунды. */
  timestamp: number
  /** Только у исходящих. */
  status?: MessageStatus
  error?: string
}

export interface Chat {
  chatId: string
  phone?: string
  /** Имя собеседника из уведомлений MAX, если оно пришло. */
  name?: string
  messages: Message[]
  unread: number
  createdAt: number
}

export interface ChatsState {
  chats: Record<string, Chat>
  activeChatId: string | null
}

export type ChatsAction =
  | { type: 'chatOpened'; chatId: string; phone?: string; now: number }
  | { type: 'chatSelected'; chatId: string | null }
  | { type: 'messageQueued'; message: Message }
  | { type: 'messageSent'; chatId: string; localId: string; id: string }
  | { type: 'messageFailed'; chatId: string; localId: string; error: string }
  | { type: 'messageRetried'; chatId: string; localId: string }
  | { type: 'eventReceived'; event: ChatEvent }

export const initialChatsState: ChatsState = { chats: {}, activeChatId: null }

export function chatsReducer(state: ChatsState, action: ChatsAction): ChatsState {
  switch (action.type) {
    case 'chatOpened': {
      const existing = state.chats[action.chatId]
      const chat: Chat = existing
        ? { ...existing, phone: existing.phone ?? action.phone, unread: 0 }
        : { chatId: action.chatId, phone: action.phone, messages: [], unread: 0, createdAt: action.now }
      return { chats: { ...state.chats, [chat.chatId]: chat }, activeChatId: chat.chatId }
    }

    case 'chatSelected': {
      const chat = action.chatId ? state.chats[action.chatId] : undefined
      if (!chat) return { ...state, activeChatId: null }
      return {
        chats: chat.unread ? { ...state.chats, [chat.chatId]: { ...chat, unread: 0 } } : state.chats,
        activeChatId: chat.chatId,
      }
    }

    case 'messageQueued':
      return updateChat(state, action.message.chatId, (chat) => ({
        ...chat,
        messages: insertSorted(chat.messages, action.message),
      }))

    case 'messageSent':
      return updateChat(state, action.chatId, (chat) => {
        const local = chat.messages.find((m) => m.id === action.localId)
        if (!local) return chat
        // Уведомление outgoingAPIMessageReceived могло прийти раньше ответа sendMessage —
        // тогда в ленте уже есть сообщение с настоящим id, а локальную копию убираем.
        if (chat.messages.some((m) => m.id === action.id)) {
          return { ...chat, messages: chat.messages.filter((m) => m !== local) }
        }
        return {
          ...chat,
          messages: chat.messages.map((m) =>
            m === local ? { ...m, id: action.id, status: 'sent', error: undefined } : m,
          ),
        }
      })

    case 'messageFailed':
      return patchMessage(state, action.chatId, action.localId, { status: 'failed', error: action.error })

    case 'messageRetried':
      return patchMessage(state, action.chatId, action.localId, { status: 'pending', error: undefined })

    case 'eventReceived':
      return action.event.kind === 'message'
        ? receiveMessage(state, action.event.message, action.event.senderName)
        : receiveStatus(state, action.event)
  }
}

function receiveMessage(state: ChatsState, message: Message, senderName?: string): ChatsState {
  const existing = state.chats[message.chatId]
  if (existing?.messages.some((m) => m.id === message.id)) return state

  const chat: Chat = existing ?? {
    chatId: message.chatId,
    phone: phoneFromChatId(message.chatId),
    messages: [],
    unread: 0,
    createdAt: message.timestamp,
  }
  const unseen = message.direction === 'in' && state.activeChatId !== chat.chatId
  return {
    ...state,
    chats: {
      ...state.chats,
      [chat.chatId]: {
        ...chat,
        name: chat.name ?? (senderName || undefined),
        messages: insertSorted(chat.messages, message),
        unread: chat.unread + (unseen ? 1 : 0),
      },
    },
  }
}

const STATUS_RANK: Record<MessageStatus, number> = { pending: 0, failed: 1, sent: 1, delivered: 2, read: 3 }

function receiveStatus(state: ChatsState, event: Extract<ChatEvent, { kind: 'status' }>): ChatsState {
  const message = state.chats[event.chatId]?.messages.find((m) => m.id === event.id)
  if (!message) return state
  // Статусы могут прийти не по порядку: «прочитано» не откатываем обратно в «отправлено».
  if (STATUS_RANK[event.status] < STATUS_RANK[message.status ?? 'pending']) return state
  if (event.status === message.status) return state
  return patchMessage(state, event.chatId, event.id, { status: event.status, error: event.error })
}

function updateChat(state: ChatsState, chatId: string, update: (chat: Chat) => Chat): ChatsState {
  const chat = state.chats[chatId]
  if (!chat) return state
  const next = update(chat)
  return next === chat ? state : { ...state, chats: { ...state.chats, [chatId]: next } }
}

function patchMessage(state: ChatsState, chatId: string, id: string, patch: Partial<Message>): ChatsState {
  return updateChat(state, chatId, (chat) =>
    chat.messages.some((m) => m.id === id)
      ? { ...chat, messages: chat.messages.map((m) => (m.id === id ? { ...m, ...patch } : m)) }
      : chat,
  )
}

function insertSorted(messages: Message[], message: Message): Message[] {
  let index = messages.length
  while (index > 0 && messages[index - 1].timestamp > message.timestamp) index--
  return [...messages.slice(0, index), message, ...messages.slice(index)]
}

/** WhatsApp-подобный chatId «79991234567@c.us» содержит номер; у MAX chatId — внутренний id. */
function phoneFromChatId(chatId: string): string | undefined {
  const match = /^(\d{10,15})@c\.us$/.exec(chatId)
  return match?.[1]
}

/* ---------- Селекторы ---------- */

export function lastActivity(chat: Chat): number {
  return chat.messages.at(-1)?.timestamp ?? chat.createdAt
}

export function sortedChats(state: ChatsState): Chat[] {
  return Object.values(state.chats).sort((a, b) => lastActivity(b) - lastActivity(a))
}

export function chatTitle(chat: Chat): string {
  if (chat.name) return chat.name
  if (chat.phone) return formatPhone(chat.phone)
  return `Чат ${chat.chatId}`
}
