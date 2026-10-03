import { describe, expect, it } from 'vitest'
import type { MessageNotification } from '../api/types'
import { toChatEvent } from './notifications'

const incoming: MessageNotification = {
  typeWebhook: 'incomingMessageReceived',
  timestamp: 1_700_000_000,
  idMessage: 'IN1',
  senderData: { chatId: '10000000', sender: '10000000', chatName: 'Иван', senderName: 'Иван' },
  messageData: { typeMessage: 'textMessage', textMessageData: { textMessage: 'Привет!' } },
}

describe('toChatEvent', () => {
  it('входящее текстовое сообщение', () => {
    expect(toChatEvent(incoming)).toEqual({
      kind: 'message',
      senderName: 'Иван',
      message: {
        id: 'IN1',
        chatId: '10000000',
        text: 'Привет!',
        direction: 'in',
        timestamp: 1_700_000_000_000,
        status: undefined,
      },
    })
  })

  it('текст со ссылкой (extendedTextMessage)', () => {
    const event = toChatEvent({
      ...incoming,
      messageData: { typeMessage: 'extendedTextMessage', extendedTextMessageData: { text: 'https://max.ru' } },
    })
    expect(event).toMatchObject({ kind: 'message', message: { text: 'https://max.ru' } })
  })

  it('сообщение, отправленное с телефона, — исходящее', () => {
    const event = toChatEvent({ ...incoming, typeWebhook: 'outgoingMessageReceived' })
    expect(event).toMatchObject({ kind: 'message', message: { direction: 'out', status: 'sent' } })
  })

  it('не-текстовые сообщения пропускает', () => {
    expect(toChatEvent({ ...incoming, messageData: { typeMessage: 'imageMessage' } })).toBeNull()
  })

  it('статус исходящего', () => {
    expect(
      toChatEvent({
        typeWebhook: 'outgoingMessageStatus',
        chatId: '10000000',
        timestamp: 1,
        idMessage: 'OUT1',
        status: 'read',
      }),
    ).toEqual({ kind: 'status', chatId: '10000000', id: 'OUT1', status: 'read', error: undefined })
  })

  it('noAccount — ошибка доставки', () => {
    expect(
      toChatEvent({ typeWebhook: 'outgoingMessageStatus', chatId: '1', timestamp: 1, idMessage: 'X', status: 'noAccount' }),
    ).toMatchObject({ status: 'failed', error: 'У получателя нет аккаунта MAX' })
  })

  it('служебные уведомления игнорирует', () => {
    expect(toChatEvent({ typeWebhook: 'stateInstanceChanged' })).toBeNull()
  })
})
