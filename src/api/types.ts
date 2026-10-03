/** Доступ к инстансу GREEN-API — значения со страницы инстанса в личном кабинете. */
export interface Credentials {
  apiUrl: string
  idInstance: string
  apiTokenInstance: string
}

export type InstanceState =
  | 'authorized'
  | 'notAuthorized'
  | 'blocked'
  | 'starting'
  | 'sleepMode'
  | 'suspended'
  | 'yellowCard'
  | 'pendingPassword'

export interface StateInstanceResponse {
  stateInstance: InstanceState
}

/** Поля настроек инстанса, от которых зависит приём уведомлений через HTTP API. */
export interface InstanceSettings {
  webhookUrl: string
  incomingWebhook: 'yes' | 'no'
  outgoingWebhook: 'yes' | 'no'
  outgoingAPIMessageWebhook: 'yes' | 'no'
  outgoingMessageWebhook: 'yes' | 'no'
}

export interface CheckAccountResponse {
  exist: boolean
  chatId?: string
}

export interface SendMessageResponse {
  idMessage: string
}

export interface DeleteNotificationResponse {
  result: boolean
}

export interface SenderData {
  chatId: string
  chatName?: string
  sender?: string
  senderName?: string
  senderContactName?: string
}

export interface MessageData {
  typeMessage: string
  textMessageData?: { textMessage: string }
  extendedTextMessageData?: { text: string }
}

export interface MessageNotification {
  typeWebhook: 'incomingMessageReceived' | 'outgoingMessageReceived' | 'outgoingAPIMessageReceived'
  timestamp: number
  idMessage: string
  senderData: SenderData
  messageData: MessageData
}

export type OutgoingStatus = 'sent' | 'delivered' | 'read' | 'failed' | 'noAccount' | 'notInGroup'

export interface OutgoingStatusNotification {
  typeWebhook: 'outgoingMessageStatus'
  chatId: string
  timestamp: number
  idMessage: string
  status: OutgoingStatus
  description?: string
}

/** Прочие типы (stateInstanceChanged и т. д.) чат не показывает — только убирает из очереди. */
export interface OtherNotification {
  typeWebhook: string
}

export type NotificationBody = MessageNotification | OutgoingStatusNotification | OtherNotification

export interface Notification {
  receiptId: number
  body: NotificationBody
}
