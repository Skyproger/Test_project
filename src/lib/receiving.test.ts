import { describe, expect, it, vi } from 'vitest'
import type { InstanceSettings } from '../api/types'
import { ensureReceiving } from './receiving'

const enabled: InstanceSettings = {
  webhookUrl: '',
  incomingWebhook: 'yes',
  outgoingWebhook: 'yes',
  outgoingMessageWebhook: 'yes',
  outgoingAPIMessageWebhook: 'no',
}

function api(settings: InstanceSettings) {
  return { getSettings: vi.fn(async () => settings), setSettings: vi.fn(async () => ({ saveSettings: true })) }
}

describe('ensureReceiving', () => {
  it('ничего не меняет, если всё включено', async () => {
    const client = api(enabled)
    await expect(ensureReceiving(client)).resolves.toEqual({ kind: 'ready' })
    expect(client.setSettings).not.toHaveBeenCalled()
  })

  it('включает только недостающие уведомления', async () => {
    const client = api({ ...enabled, incomingWebhook: 'no' })
    await expect(ensureReceiving(client)).resolves.toEqual({ kind: 'enabled' })
    expect(client.setSettings).toHaveBeenCalledWith({ incomingWebhook: 'yes' })
  })

  it('не трогает чужой webhookUrl', async () => {
    const client = api({ ...enabled, webhookUrl: 'https://example.com/hook', incomingWebhook: 'no' })
    await expect(ensureReceiving(client)).resolves.toEqual({ kind: 'webhook', webhookUrl: 'https://example.com/hook' })
    expect(client.setSettings).not.toHaveBeenCalled()
  })
})
