const timeFormat = new Intl.DateTimeFormat('ru-RU', { hour: '2-digit', minute: '2-digit' })
const dayFormat = new Intl.DateTimeFormat('ru-RU', { day: 'numeric', month: 'long' })
const dayWithYearFormat = new Intl.DateTimeFormat('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' })
const shortDateFormat = new Intl.DateTimeFormat('ru-RU', { day: '2-digit', month: '2-digit', year: '2-digit' })
const weekdayFormat = new Intl.DateTimeFormat('ru-RU', { weekday: 'short' })

const DAY = 24 * 60 * 60 * 1000

function startOfDay(ms: number): number {
  const date = new Date(ms)
  date.setHours(0, 0, 0, 0)
  return date.getTime()
}

export function isSameDay(a: number, b: number): boolean {
  return startOfDay(a) === startOfDay(b)
}

/** Время сообщения: «14:05». */
export function formatTime(ms: number): string {
  return timeFormat.format(ms)
}

/** Разделитель дней в ленте: «Сегодня», «Вчера», «3 октября», «3 октября 2025 г.». */
export function formatDay(ms: number, now = Date.now()): string {
  const diff = startOfDay(now) - startOfDay(ms)
  if (diff === 0) return 'Сегодня'
  if (diff === DAY) return 'Вчера'
  return new Date(ms).getFullYear() === new Date(now).getFullYear()
    ? dayFormat.format(ms)
    : dayWithYearFormat.format(ms)
}

/** Время в списке чатов, как в MAX: сегодня — часы, на неделе — день недели, раньше — дата. */
export function formatListTime(ms: number, now = Date.now()): string {
  const diff = startOfDay(now) - startOfDay(ms)
  if (diff === 0) return formatTime(ms)
  if (diff < 7 * DAY) return weekdayFormat.format(ms)
  return shortDateFormat.format(ms)
}
