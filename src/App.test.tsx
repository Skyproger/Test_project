import { act, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import App from './App'
import type { Notification } from './api/types'

/** Поддельный GREEN-API: отвечает на нужные методы и держит очередь уведомлений. */
function createFakeServer() {
  const queue: Notification[] = []
  let wakeUp: (() => void) | null = null
  const requests: { method: string; body?: unknown }[] = []

  const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = new URL(String(input))
    const method = url.pathname.split('/')[2]
    requests.push({ method, body: init?.body ? JSON.parse(init.body as string) : undefined })

    switch (method) {
      case 'getStateInstance':
        return json({ stateInstance: 'authorized' })
      case 'getSettings':
        return json({ webhookUrl: '', incomingWebhook: 'yes', outgoingWebhook: 'yes', outgoingMessageWebhook: 'yes' })
      case 'checkAccount':
        return json({ exist: true, chatId: '10000000' })
      case 'sendMessage':
        return json({ idMessage: 'OUT-1' })
      case 'deleteNotification':
        return json({ result: true })
      case 'receiveNotification': {
        // Long polling: ждём, пока в очереди что-то появится или запрос отменят.
        if (queue.length === 0) {
          await new Promise<void>((resolve, reject) => {
            wakeUp = resolve
            init?.signal?.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')))
          })
        }
        return json(queue.shift() ?? null)
      }
      default:
        return new Response('', { status: 404 })
    }
  })

  return {
    fetchMock,
    requests,
    push(notification: Notification) {
      queue.push(notification)
      wakeUp?.()
    },
  }
}

function json(value: unknown) {
  return new Response(JSON.stringify(value), { status: 200 })
}

let server: ReturnType<typeof createFakeServer>

beforeEach(() => {
  server = createFakeServer()
  vi.stubGlobal('fetch', server.fetchMock)
})

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('чат MAX', () => {
  it('вход → новый чат по номеру → отправка → ответ получателя', async () => {
    const user = userEvent.setup()
    render(<App />)

    // 1. Вход по idInstance и apiTokenInstance
    await user.type(screen.getByLabelText('idInstance'), '3100123456')
    await user.type(screen.getByLabelText('apiTokenInstance'), 'secret-token')
    expect(screen.getByText('https://3100.api.green-api.com')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Войти' }))

    // 2. Новый чат по номеру телефона
    const phone = await screen.findByLabelText('Новый чат')
    await user.type(phone, '+7 999 123-45-67')
    await user.click(screen.getByRole('button', { name: 'Создать чат' }))
    const chat = await screen.findByRole('region', { name: 'Чат: +7 999 123-45-67' })
    expect(server.requests).toContainEqual({ method: 'checkAccount', body: { phoneNumber: 79991234567 } })

    // 3. Отправка сообщения
    await user.type(within(chat).getByLabelText('Текст сообщения'), 'Привет из GREEN-API{Enter}')
    expect(await within(chat).findByText('Привет из GREEN-API')).toBeInTheDocument()
    expect(server.requests).toContainEqual({
      method: 'sendMessage',
      body: { chatId: '10000000', message: 'Привет из GREEN-API' },
    })
    expect(await within(chat).findByRole('img', { name: 'Отправлено' })).toBeInTheDocument()

    // 4. Получатель отвечает в MAX — ответ появляется в чате
    act(() => {
      server.push({
        receiptId: 1,
        body: {
          typeWebhook: 'incomingMessageReceived',
          timestamp: Math.floor(Date.now() / 1000),
          idMessage: 'IN-1',
          senderData: { chatId: '10000000', senderName: 'Иван Петров' },
          messageData: { typeMessage: 'textMessage', textMessageData: { textMessage: 'Привет! Получил' } },
        } as Notification['body'],
      })
    })
    expect(await within(chat).findByText('Привет! Получил')).toBeInTheDocument()
    expect(within(chat).getByRole('heading', { name: 'Иван Петров' })).toBeInTheDocument()
    await vi.waitFor(() => expect(server.requests).toContainEqual({ method: 'deleteNotification', body: undefined }))
  })

  it('показывает ошибку, если инстанс не авторизован', async () => {
    server.fetchMock.mockImplementationOnce(async () => json({ stateInstance: 'notAuthorized' }))
    const user = userEvent.setup()
    render(<App />)

    await user.type(screen.getByLabelText('idInstance'), '3100123456')
    await user.type(screen.getByLabelText('apiTokenInstance'), 'secret-token')
    await user.click(screen.getByRole('button', { name: 'Войти' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('Инстанс не авторизован')
  })

  it('не создаёт чат с некорректным номером', async () => {
    localStorage.setItem(
      'max-chat:credentials',
      JSON.stringify({ idInstance: '3100123456', apiTokenInstance: 't', apiUrl: 'https://3100.api.green-api.com' }),
    )
    const user = userEvent.setup()
    render(<App />)

    await user.type(await screen.findByLabelText('Новый чат'), '123')
    await user.click(screen.getByRole('button', { name: 'Создать чат' }))

    expect(screen.getByRole('alert')).toHaveTextContent('Введите номер с кодом страны')
    expect(server.requests.some((r) => r.method === 'checkAccount')).toBe(false)
  })
})
