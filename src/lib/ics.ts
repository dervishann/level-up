import type { DayPlan } from './types'

// Kalender-Export: macht aus Tagesplänen eine .ics-Datei, die jede
// Kalender-App (auch der iPhone-Kalender) importieren kann.
// Zeiten sind "lokale Zeit ohne Zeitzone": 07:30 bleibt 07:30.

const pad = (n: number) => String(n).padStart(2, '0')
const stamp = (date: string, min: number) => `${date.replace(/-/g, '')}T${pad(Math.floor(min / 60))}${pad(min % 60)}00`
const esc = (s: string) => s.replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\n/g, '\\n')

export function planToIcs(plans: DayPlan[], now: Date = new Date()): string {
  const created = now.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '')
  const lines = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Level Up//Tagesplan//DE', 'CALSCALE:GREGORIAN', 'METHOD:PUBLISH']
  for (const plan of plans) {
    for (const b of plan.blocks) {
      if (b.type === 'break') continue
      lines.push(
        'BEGIN:VEVENT',
        `UID:${plan.date}-${b.id}@levelup`,
        `DTSTAMP:${created}`,
        `DTSTART:${stamp(plan.date, b.start)}`,
        `DTEND:${stamp(plan.date, b.end)}`,
        `SUMMARY:${esc((b.frog ? '🐸 ' : b.main ? '⭐ ' : '') + b.title)}`,
        'BEGIN:VALARM',
        'ACTION:DISPLAY',
        `DESCRIPTION:${esc(b.title)}`,
        'TRIGGER:-PT5M',
        'END:VALARM',
        'END:VEVENT',
      )
    }
  }
  lines.push('END:VCALENDAR')
  return lines.join('\r\n') + '\r\n'
}
