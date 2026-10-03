import { describe, expect, it } from 'vitest'
import { chatsReducer, chatTitle, initialChatsState, sortedChats, type ChatsState, type Message } from './chats'

const opened = chatsReducer(initialChatsState, { type: 'chatOpened', chatId: '100', phone: '79991234567', now: 1000 })

function incoming(id: string, timestamp: number, chatId = '100'): Message {
  return { id, chatId, text: `msg ${id}`, direction: 'in', timestamp }
}

function receive(state: ChatsState, message: Message, senderName?: string) {
  return chatsReducer(state, { type: 'eventReceived', event: { kind: 'message', message, senderName } })
}

function queue(state: ChatsState, id = 'local-1') {
  return chatsReducer(state, {
    type: 'messageQueued',
    message: { id, chatId: '100', text: 'Привет', direction: 'out', timestamp: 2000, status: 'pending' },
  })
}

describe('chatsReducer', () => {
  it('создаёт чат по номеру и делает его активным', () => {
    expect(opened.activeChatId).toBe('100')
    expect(chatTitle(opened.chats['100'])).toBe('+7 999 123-45-67')
  })

  it('повторное открытие не теряет историю', () => {
    const withMessage = receive(opened, incoming('a', 2000))
    const reopened = chatsReducer(withMessage, { type: 'chatOpened', chatId: '100', phone: '79991234567', now: 5000 })
    expect(reopened.chats['100'].messages).toHaveLength(1)
  })

  it('отправка: pending → sent с настоящим idMessage', () => {
    const sent = chatsReducer(queue(opened), { type: 'messageSent', chatId: '100', localId: 'local-1', id: 'BAE5' })
    expect(sent.chats['100'].messages).toMatchObject([{ id: 'BAE5', status: 'sent' }])
  })

  it('ошибка отправки и повтор', () => {
    const failed = chatsReducer(queue(opened), {
      type: 'messageFailed',
      chatId: '100',
      localId: 'local-1',
      error: 'Нет связи',
    })
    expect(failed.chats['100'].messages[0]).toMatchObject({ status: 'failed', error: 'Нет связи' })

    const retried = chatsReducer(failed, { type: 'messageRetried', chatId: '100', localId: 'local-1' })
    expect(retried.chats['100'].messages[0]).toMatchObject({ status: 'pending', error: undefined })
  })

  it('не дублирует сообщение, если outgoingAPIMessageReceived пришёл раньше ответа sendMessage', () => {
    let state = queue(opened)
    state = receive(state, { id: 'BAE5', chatId: '100', text: 'Привет', direction: 'out', timestamp: 2001, status: 'sent' })
    state = chatsReducer(state, { type: 'messageSent', chatId: '100', localId: 'local-1', id: 'BAE5' })
    expect(state.chats['100'].messages.map((m) => m.id)).toEqual(['BAE5'])
  })

  it('входящее в открытый чат не увеличивает счётчик непрочитанных', () => {
    const state = receive(opened, incoming('a', 2000), 'Иван')
    expect(state.chats['100'].unread).toBe(0)
    expect(state.chats['100'].name).toBe('Иван')
  })

  it('входящее от нового собеседника создаёт чат с непрочитанным', () => {
    const state = receive(opened, incoming('b', 3000, '200'), 'Мария')
    expect(state.chats['200']).toMatchObject({ name: 'Мария', unread: 1 })
    expect(sortedChats(state).map((c) => c.chatId)).toEqual(['200', '100'])

    const selected = chatsReducer(state, { type: 'chatSelected', chatId: '200' })
    expect(selected.chats['200'].unread).toBe(0)
  })

  it('повторное уведомление с тем же idMessage игнорирует', () => {
    const once = receive(opened, incoming('a', 2000))
    expect(receive(once, incoming('a', 2000))).toBe(once)
  })

  it('держит сообщения в порядке времени', () => {
    let state = receive(opened, incoming('late', 3000))
    state = receive(state, incoming('early', 2000))
    expect(state.chats['100'].messages.map((m) => m.id)).toEqual(['early', 'late'])
  })

  it('статусы только повышаются: read не откатывается в delivered', () => {
    let state = chatsReducer(queue(opened), { type: 'messageSent', chatId: '100', localId: 'local-1', id: 'X' })
    const status = (s: 'delivered' | 'read') =>
      ({ type: 'eventReceived', event: { kind: 'status', chatId: '100', id: 'X', status: s } }) as const
    state = chatsReducer(state, status('read'))
    state = chatsReducer(state, status('delivered'))
    expect(state.chats['100'].messages[0].status).toBe('read')
  })
})
