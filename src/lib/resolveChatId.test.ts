import { describe, expect, it, vi } from 'vitest'
import { GreenApiError } from '../api/greenApi'
import { resolveChatId } from './resolveChatId'

describe('resolveChatId', () => {
  it('берёт chatId из CheckAccount', async () => {
    const checkAccount = vi.fn(async () => ({ exist: true, chatId: '10000000' }))
    await expect(resolveChatId({ checkAccount }, '79991234567')).resolves.toBe('10000000')
    expect(checkAccount).toHaveBeenCalledWith('79991234567')
  })

  it('сообщает, что у номера нет MAX', async () => {
    const checkAccount = vi.fn(async () => ({ exist: false }))
    await expect(resolveChatId({ checkAccount }, '79991234567')).rejects.toThrow('нет аккаунта MAX')
  })

  it('без метода CheckAccount использует номер@c.us', async () => {
    const checkAccount = vi.fn(async () => {
      throw new GreenApiError(404, 'Not found')
    })
    await expect(resolveChatId({ checkAccount }, '79991234567')).resolves.toBe('79991234567@c.us')
  })
})
