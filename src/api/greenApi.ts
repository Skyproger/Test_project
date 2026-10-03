import type {
  CheckAccountResponse,
  Credentials,
  DeleteNotificationResponse,
  InstanceSettings,
  Notification,
  SendMessageResponse,
  StateInstanceResponse,
} from './types'

/** Ошибка вызова GREEN-API. `status === 0` — запрос не дошёл до сервера. */
export class GreenApiError extends Error {
  readonly status: number

  constructor(status: number, message: string) {
    super(message)
    this.name = 'GreenApiError'
    this.status = status
  }

  get isUnauthorized(): boolean {
    return this.status === 401 || this.status === 403
  }
}

/**
 * Хост API инстанса указан в личном кабинете и зависит от первых четырёх цифр idInstance:
 * 3100123456 → https://3100.api.green-api.com
 */
export function apiUrlFor(idInstance: string): string {
  const prefix = idInstance.trim().slice(0, 4)
  return /^\d{4}$/.test(prefix) ? `https://${prefix}.api.green-api.com` : 'https://api.green-api.com'
}

type HttpMethod = 'GET' | 'POST' | 'DELETE'

interface RequestOptions {
  body?: unknown
  suffix?: string
  signal?: AbortSignal
}

/**
 * Клиент HTTP API GREEN-API. Адрес любого метода:
 * {apiUrl}/waInstance{idInstance}/{method}/{apiTokenInstance}
 * CORS у GREEN-API открыт, поэтому браузер ходит в API напрямую, без прокси.
 */
export function createGreenApi(credentials: Credentials, fetchImpl: typeof fetch = fetch) {
  const apiUrl = credentials.apiUrl.trim().replace(/\/+$/, '')
  const base = `${apiUrl}/waInstance${credentials.idInstance.trim()}`
  const token = encodeURIComponent(credentials.apiTokenInstance.trim())

  async function request<T>(
    httpMethod: HttpMethod,
    method: string,
    { body, suffix = '', signal }: RequestOptions = {},
  ): Promise<T | null> {
    let response: Response
    try {
      response = await fetchImpl(`${base}/${method}/${token}${suffix}`, {
        method: httpMethod,
        headers: body === undefined ? undefined : { 'Content-Type': 'application/json' },
        body: body === undefined ? undefined : JSON.stringify(body),
        signal,
      })
    } catch (error) {
      if (signal?.aborted) throw error
      throw new GreenApiError(0, 'Нет связи с GREEN-API. Проверьте интернет и адрес API.')
    }

    const text = await response.text()
    if (!response.ok) throw new GreenApiError(response.status, describeError(response.status, text))
    if (!text || text === 'null') return null
    try {
      return JSON.parse(text) as T
    } catch {
      throw new GreenApiError(response.status, 'GREEN-API вернул ответ не в формате JSON.')
    }
  }

  return {
    async getStateInstance(signal?: AbortSignal): Promise<StateInstanceResponse> {
      const result = await request<StateInstanceResponse>('GET', 'getStateInstance', { signal })
      if (!result) throw new GreenApiError(200, 'GREEN-API вернул пустой ответ. Проверьте адрес API.')
      return result
    },

    getSettings: () => request<InstanceSettings>('GET', 'getSettings'),

    setSettings: (settings: Partial<InstanceSettings>) =>
      request<{ saveSettings: boolean }>('POST', 'setSettings', { body: settings }),

    /** Проверяет, есть ли у номера аккаунт, и возвращает chatId собеседника. */
    checkAccount: (phoneNumber: string) =>
      request<CheckAccountResponse>('POST', 'checkAccount', {
        body: { phoneNumber: Number(phoneNumber) },
      }),

    async sendMessage(chatId: string, message: string): Promise<SendMessageResponse> {
      const result = await request<SendMessageResponse>('POST', 'sendMessage', {
        body: { chatId, message },
      })
      if (!result?.idMessage) throw new GreenApiError(200, 'GREEN-API не вернул idMessage.')
      return result
    },

    /**
     * Long polling: сервер держит запрос до `receiveTimeout` секунд (5–60).
     * Пустая очередь — `null`; инстансы MAX по истечении таймаута отвечают 408, это тоже «пусто».
     */
    async receiveNotification(receiveTimeout: number, signal?: AbortSignal): Promise<Notification | null> {
      try {
        return await request<Notification>('GET', 'receiveNotification', {
          suffix: `?receiveTimeout=${receiveTimeout}`,
          signal,
        })
      } catch (error) {
        if (error instanceof GreenApiError && error.status === 408) return null
        throw error
      }
    },

    deleteNotification: (receiptId: number, signal?: AbortSignal) =>
      request<DeleteNotificationResponse>('DELETE', 'deleteNotification', {
        suffix: `/${receiptId}`,
        signal,
      }),
  }
}

export type GreenApi = ReturnType<typeof createGreenApi>

function describeError(status: number, body: string): string {
  if (status === 401 || status === 403) return 'Неверный idInstance или apiTokenInstance.'
  if (status === 429) return 'Слишком много запросов к GREEN-API. Попробуйте через несколько секунд.'
  if (status === 466) return 'Исчерпан лимит запросов по тарифу инстанса.'
  if (status >= 500) return `Сервер GREEN-API временно недоступен (${status}).`

  const detail = extractMessage(body)
  if (/not authorized/i.test(detail)) {
    return 'Инстанс не авторизован: отсканируйте QR-код в личном кабинете GREEN-API.'
  }
  return detail ? `Ошибка GREEN-API (${status}): ${detail}` : `Ошибка GREEN-API (${status}).`
}

function extractMessage(body: string): string {
  if (!body) return ''
  try {
    const parsed: unknown = JSON.parse(body)
    if (parsed && typeof parsed === 'object') {
      for (const key of ['message', 'reason', 'error']) {
        const value = (parsed as Record<string, unknown>)[key]
        if (typeof value === 'string' && value) return value
      }
    }
  } catch {
    // тело не JSON — покажем как есть
  }
  return body.slice(0, 200)
}
