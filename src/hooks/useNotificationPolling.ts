import { useEffect, useRef, useState } from 'react'
import type { GreenApi } from '../api/greenApi'
import type { NotificationBody } from '../api/types'
import { runNotificationLoop, type ConnectionState } from '../lib/notificationLoop'

export type Connection = ConnectionState | { kind: 'connecting' }

/** Держит цикл приёма уведомлений, пока компонент смонтирован. */
export function useNotificationPolling(
  api: GreenApi,
  onNotification: (body: NotificationBody) => void,
): Connection {
  const [connection, setConnection] = useState<Connection>({ kind: 'connecting' })
  const handlerRef = useRef(onNotification)

  useEffect(() => {
    handlerRef.current = onNotification
  })

  useEffect(() => {
    const controller = new AbortController()
    void runNotificationLoop({
      api,
      onNotification: (body) => handlerRef.current(body),
      onConnection: setConnection,
      signal: controller.signal,
    })
    return () => controller.abort()
  }, [api])

  return connection
}
