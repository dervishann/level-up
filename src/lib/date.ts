export const dateKey = (d: Date = new Date()): string => {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

export const parseKey = (key: string): Date => {
  const [y, m, d] = key.split('-').map(Number)
  return new Date(y, m - 1, d)
}

export const addDays = (key: string, n: number): string => {
  const d = parseKey(key)
  d.setDate(d.getDate() + n)
  return dateKey(d)
}

export const weekdayOf = (key: string): number => parseKey(key).getDay()

/** "06:30" → 390 */
export const toMin = (hhmm: string): number => {
  const [h, m] = hhmm.split(':').map(Number)
  return h * 60 + (m || 0)
}

/** 390 → "06:30" */
export const fmt = (min: number): string => {
  const m = ((Math.round(min) % 1440) + 1440) % 1440
  return `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`
}

export const nowMin = (d: Date = new Date()): number => d.getHours() * 60 + d.getMinutes()

export const WEEKDAYS = ['So', 'Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa']

export const niceDate = (key: string): string =>
  parseKey(key).toLocaleDateString('de-DE', { weekday: 'long', day: 'numeric', month: 'long' })

export const uid = (): string => Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4)
