import { GreenApiError, type GreenApi } from '../api/greenApi'

/**
 * Номер телефона → chatId собеседника.
 * В MAX сообщения адресуются по внутреннему chatId пользователя, а не по номеру, поэтому
 * берём его из CheckAccount. Входящие приходят с тем же chatId — ответ попадёт в этот же чат.
 * Если у инстанса нет CheckAccount (например, это WhatsApp-инстанс), используем «номер@c.us».
 */
export async function resolveChatId(api: Pick<GreenApi, 'checkAccount'>, phone: string): Promise<string> {
  let result: Awaited<ReturnType<GreenApi['checkAccount']>>
  try {
    result = await api.checkAccount(phone)
  } catch (error) {
    if (error instanceof GreenApiError && (error.status === 404 || error.status === 405)) {
      return `${phone}@c.us`
    }
    throw error
  }

  if (result?.exist === false) throw new Error('У этого номера нет аккаунта MAX.')
  if (result?.exist) return result.chatId || `${phone}@c.us`
  throw new Error('Не удалось проверить номер. Попробуйте ещё раз.')
}
