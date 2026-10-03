import { describe, expect, it, vi } from 'vitest'
import { apiUrlFor, createGreenApi, GreenApiError } from './greenApi'

const credentials = { apiUrl: 'https://3100.api.green-api.com/', idInstance: '3100123456', apiTokenInstance: 'tok/en' }

function mockFetch(status: number, body: string) {
  return vi.fn<typeof fetch>(async () => new Response(body, { status }))
}

describe('apiUrlFor', () => {
  it('берёт хост по первым четырём цифрам idInstance', () => {
    expect(apiUrlFor('3100123456')).toBe('https://3100.api.green-api.com')
    expect(apiUrlFor(' 7105000001 ')).toBe('https://7105.api.green-api.com')
  })

  it('для нестандартного id отдаёт общий хост', () => {
    expect(apiUrlFor('')).toBe('https://api.green-api.com')
    expect(apiUrlFor('abc')).toBe('https://api.green-api.com')
  })
})

describe('createGreenApi', () => {
  it('отправляет сообщение POST-запросом на sendMessage', async () => {
    const fetchMock = mockFetch(200, '{"idMessage":"BAE5"}')
    const api = createGreenApi(credentials, fetchMock)

    await expect(api.sendMessage('10000000', 'Привет')).resolves.toEqual({ idMessage: 'BAE5' })

    const [url, init] = fetchMock.mock.calls[0]
    expect(url).toBe('https://3100.api.green-api.com/waInstance3100123456/sendMessage/tok%2Fen')
    expect(init?.method).toBe('POST')
    expect(JSON.parse(init?.body as string)).toEqual({ chatId: '10000000', message: 'Привет' })
  })

  it('получает уведомление с receiveTimeout и удаляет его по receiptId', async () => {
    const fetchMock = vi.fn<typeof fetch>(async (input) =>
      String(input).includes('receiveNotification')
        ? new Response('{"receiptId":7,"body":{"typeWebhook":"x"}}')
        : new Response('{"result":true}'),
    )
    const api = createGreenApi(credentials, fetchMock)

    await expect(api.receiveNotification(20)).resolves.toMatchObject({ receiptId: 7 })
    await api.deleteNotification(7)

    expect(fetchMock.mock.calls[0][0]).toBe(
      'https://3100.api.green-api.com/waInstance3100123456/receiveNotification/tok%2Fen?receiveTimeout=20',
    )
    expect(fetchMock.mock.calls[1][0]).toBe(
      'https://3100.api.green-api.com/waInstance3100123456/deleteNotification/tok%2Fen/7',
    )
    expect(fetchMock.mock.calls[1][1]?.method).toBe('DELETE')
  })

  it('пустая очередь — null, в том числе ответ 408 у инстансов MAX', async () => {
    await expect(createGreenApi(credentials, mockFetch(200, 'null')).receiveNotification(5)).resolves.toBeNull()
    await expect(createGreenApi(credentials, mockFetch(408, '')).receiveNotification(5)).resolves.toBeNull()
  })

  it('401 превращает в понятную ошибку', async () => {
    const error = await createGreenApi(credentials, mockFetch(401, ''))
      .getStateInstance()
      .catch((e: unknown) => e)
    expect(error).toBeInstanceOf(GreenApiError)
    expect((error as GreenApiError).isUnauthorized).toBe(true)
    expect((error as GreenApiError).message).toBe('Неверный idInstance или apiTokenInstance.')
  })

  it('сетевую ошибку отдаёт со статусом 0', async () => {
    const fetchMock = vi.fn<typeof fetch>(async () => {
      throw new TypeError('Failed to fetch')
    })
    const error = await createGreenApi(credentials, fetchMock)
      .sendMessage('1', 'a')
      .catch((e: unknown) => e)
    expect(error).toMatchObject({ status: 0 })
  })

  it('показывает текст ошибки из тела ответа', async () => {
    const api = createGreenApi(credentials, mockFetch(400, '{"message":"chatId is invalid"}'))
    await expect(api.sendMessage('x', 'a')).rejects.toThrow('Ошибка GREEN-API (400): chatId is invalid')
  })
})
