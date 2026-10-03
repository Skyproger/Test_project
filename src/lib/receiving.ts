import type { GreenApi } from '../api/greenApi'
import type { InstanceSettings } from '../api/types'

export type ReceivingSetup =
  /** Всё уже включено. */
  | { kind: 'ready' }
  /** Включили нужные уведомления; GREEN-API применяет настройки до нескольких минут. */
  | { kind: 'enabled' }
  /** У инстанса задан webhookUrl — уведомления уходят туда, а не в очередь HTTP API. */
  | { kind: 'webhook'; webhookUrl: string }

const REQUIRED: Partial<InstanceSettings> = {
  incomingWebhook: 'yes',
  outgoingWebhook: 'yes',
  outgoingMessageWebhook: 'yes',
}

/**
 * У нового инстанса уведомления о входящих выключены, и без них ответ собеседника
 * в очередь не попадёт. Включаем только недостающие флаги: SetSettings перезапускает инстанс.
 * Чужой webhookUrl не трогаем — только сообщаем о нём.
 */
export async function ensureReceiving(api: Pick<GreenApi, 'getSettings' | 'setSettings'>): Promise<ReceivingSetup> {
  const settings = await api.getSettings()
  if (settings?.webhookUrl) return { kind: 'webhook', webhookUrl: settings.webhookUrl }

  const missing = Object.fromEntries(
    Object.entries(REQUIRED).filter(([key, value]) => settings?.[key as keyof InstanceSettings] !== value),
  ) as Partial<InstanceSettings>
  if (Object.keys(missing).length === 0) return { kind: 'ready' }

  await api.setSettings(missing)
  return { kind: 'enabled' }
}
