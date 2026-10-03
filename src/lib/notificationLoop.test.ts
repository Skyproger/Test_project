import { describe, expect, it, vi } from 'vitest'
import { GreenApiError } from '../api/greenApi'
import type { Notification } from '../api/types'
import { runNotificationLoop, type ConnectionState } from './notificationLoop'

function setup(responses: Array<Notification | null | Error>) {
  const controller = new AbortController()
  const api = {
    receiveNotification: vi.fn(async (_timeout: number, _signal?: AbortSignal): Promise<Notification | null> => {
      const next = responses.shift()
      if (next === undefined) {
        controller.abort()
        return null
      }
      if (next instanceof Error) throw next
      return next
    }),
    deleteNotification: vi.fn(async (_receiptId: number, _signal?: AbortSignal) => ({ result: true })),
  }
  const received: unknown[] = []
  const connection: ConnectionState[] = []
  const sleep = vi.fn(async (_ms: number, _signal: AbortSignal) => {})
  const run = () =>
    runNotificationLoop({
      api,
      onNotification: (body) => received.push(body),
      onConnection: (state) => connection.push(state),
      signal: controller.signal,
      sleep,
    })
  return { api, received, connection, sleep, run }
}

describe('runNotificationLoop', () => {
  it('передаёт уведомления и удаляет каждое из очереди', async () => {
    const { api, received, run } = setup([
      { receiptId: 1, body: { typeWebhook: 'incomingMessageReceived' } },
      null,
      { receiptId: 2, body: { typeWebhook: 'stateInstanceChanged' } },
    ])
    await run()
    expect(received).toHaveLength(2)
    expect(api.deleteNotification.mock.calls.map((c) => c[0])).toEqual([1, 2])
  })

  it('удаляет уведомление, даже если обработчик упал', async () => {
    const { api } = setup([])
    const controller = new AbortController()
    api.receiveNotification
      .mockResolvedValueOnce({ receiptId: 5, body: { typeWebhook: 'x' } })
      .mockImplementation(async () => {
        controller.abort()
        return null
      })
    vi.spyOn(console, 'error').mockImplementation(() => {})
    await runNotificationLoop({
      api,
      onNotification: () => {
        throw new Error('boom')
      },
      onConnection: () => {},
      signal: controller.signal,
    })
    expect(api.deleteNotification).toHaveBeenCalledWith(5, controller.signal)
  })

  it('при сетевой ошибке ждёт с нарастающей паузой и восстанавливается', async () => {
    const { connection, sleep, run } = setup([new GreenApiError(0, 'Нет связи.'), new GreenApiError(500, 'Сбой.'), null])
    await run()
    expect(sleep.mock.calls.map((c) => c[0])).toEqual([1000, 2000])
    expect(connection.at(-1)).toEqual({ kind: 'online' })
    expect(connection).toContainEqual({ kind: 'retrying', message: 'Нет связи.' })
  })

  it('на 429 ждёт не меньше 5 секунд', async () => {
    const { sleep, run } = setup([new GreenApiError(429, 'Много запросов.')])
    await run()
    expect(sleep).toHaveBeenCalledWith(5000, expect.anything())
  })

  it('останавливается на неверных кредах', async () => {
    const { api, connection, run } = setup([new GreenApiError(401, 'Неверный токен.'), null])
    await run()
    expect(api.receiveNotification).toHaveBeenCalledTimes(1)
    expect(connection).toEqual([{ kind: 'stopped', message: 'Неверный токен.' }])
  })
})
