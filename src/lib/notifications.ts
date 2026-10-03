import type {
  MessageData,
  MessageNotification,
  NotificationBody,
  OutgoingStatus,
  OutgoingStatusNotification,
} from '../api/types'
import type { Message, MessageStatus } from '../state/chats'

/** Что уведомление меняет в чатах. null — уведомление чату не нужно. */
export type ChatEvent =
  | { kind: 'message'; message: Message; senderName?: string }
  | { kind: 'status'; chatId: string; id: string; status: MessageStatus; error?: string }

const MESSAGE_WEBHOOKS = new Set<string>([
  'incomingMessageReceived',
  'outgoingMessageReceived',
  'outgoingAPIMessageReceived',
])

export function toChatEvent(body: NotificationBody): ChatEvent | null {
  if (MESSAGE_WEBHOOKS.has(body.typeWebhook)) return messageEvent(body as MessageNotification)
  if (body.typeWebhook === 'outgoingMessageStatus') return statusEvent(body as OutgoingStatusNotification)
  return null
}

function messageEvent(body: MessageNotification): ChatEvent | null {
  const text = extractText(body.messageData)
  const chatId = body.senderData?.chatId
  if (text === null || !chatId || !body.idMessage) return null

  const incoming = body.typeWebhook === 'incomingMessageReceived'
  const { senderContactName, senderName, chatName } = body.senderData
  return {
    kind: 'message',
    message: {
      id: body.idMessage,
      chatId,
      text,
      direction: incoming ? 'in' : 'out',
      timestamp: toMs(body.timestamp),
      status: incoming ? undefined : 'sent',
    },
    senderName: incoming ? senderContactName || senderName || chatName : chatName,
  }
}

/** Только текст: «textMessage» и «extendedTextMessage» (текст со ссылкой). */
function extractText(data: MessageData | undefined): string | null {
  if (data?.typeMessage === 'textMessage') return data.textMessageData?.textMessage ?? null
  if (data?.typeMessage === 'extendedTextMessage') return data.extendedTextMessageData?.text ?? null
  return null
}

const STATUS_MAP: Record<OutgoingStatus, MessageStatus> = {
  sent: 'sent',
  delivered: 'delivered',
  read: 'read',
  failed: 'failed',
  noAccount: 'failed',
  notInGroup: 'failed',
}

function statusEvent(body: OutgoingStatusNotification): ChatEvent | null {
  const status = STATUS_MAP[body.status]
  if (!status || !body.chatId || !body.idMessage) return null
  return {
    kind: 'status',
    chatId: body.chatId,
    id: body.idMessage,
    status,
    error: status === 'failed' ? statusError(body) : undefined,
  }
}

function statusError(body: OutgoingStatusNotification): string {
  if (body.status === 'noAccount') return 'У получателя нет аккаунта MAX'
  return body.description || 'Сообщение не доставлено'
}

/** GREEN-API отдаёт timestamp в секундах. */
function toMs(timestamp: number | undefined): number {
  return timestamp ? timestamp * 1000 : Date.now()
}
