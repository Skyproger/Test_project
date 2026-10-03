import { GreenApiError, type GreenApi } from '../api/greenApi'
import type { NotificationBody } from '../api/types'

export type ConnectionState =
  | { kind: 'online' }
  | { kind: 'retrying'; message: string }
  | { kind: 'stopped'; message: string }

interface LoopOptions {
  api: Pick<GreenApi, 'receiveNotification' | 'deleteNotification'>
  onNotification: (body: NotificationBody) => void
  onConnection: (state: ConnectionState) => void
  signal: AbortSignal
  /** Сколько секунд сервер держит запрос, если очередь пуста (5–60). */
  receiveTimeout?: number
  sleep?: (ms: number, signal: AbortSignal) => Promise<void>
}

const MIN_BACKOFF = 1000
const MAX_BACKOFF = 30_000

/**
 * Приём сообщений по технологии HTTP API:
 * ReceiveNotification (long polling) → обработать → DeleteNotification → снова.
 * Уведомление удаляется всегда, даже если оно чату не нужно, — иначе очередь встанет на нём.
 */
export async function runNotificationLoop({
  api,
  onNotification,
  onConnection,
  signal,
  receiveTimeout = 20,
  sleep = abortableSleep,
}: LoopOptions): Promise<void> {
  let backoff = MIN_BACKOFF
  let online = false

  while (!signal.aborted) {
    try {
      const notification = await api.receiveNotification(receiveTimeout, signal)
      if (!online) {
        online = true
        onConnection({ kind: 'online' })
      }
      backoff = MIN_BACKOFF
      if (!notification) continue

      try {
        onNotification(notification.body)
      } catch (error) {
        // Сбой обработки одного уведомления не должен останавливать приём остальных.
        console.error('Не удалось обработать уведомление', notification, error)
      }
      await api.deleteNotification(notification.receiptId, signal)
    } catch (error) {
      if (signal.aborted) return
      if (error instanceof GreenApiError && error.isUnauthorized) {
        onConnection({ kind: 'stopped', message: error.message })
        return
      }
      online = false
      const message = error instanceof Error ? error.message : 'Не удалось получить сообщения'
      onConnection({ kind: 'retrying', message })
      const rateLimited = error instanceof GreenApiError && error.status === 429
      await sleep(rateLimited ? Math.max(backoff, 5000) : backoff, signal)
      backoff = Math.min(backoff * 2, MAX_BACKOFF)
    }
  }
}

function abortableSleep(ms: number, signal: AbortSignal): Promise<void> {
  return new Promise((resolve) => {
    const timer = setTimeout(done, ms)
    signal.addEventListener('abort', done, { once: true })
    function done() {
      clearTimeout(timer)
      signal.removeEventListener('abort', done)
      resolve()
    }
  })
}
