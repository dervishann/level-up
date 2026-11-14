import { describe, expect, it } from 'vitest'
import { activeCount, batchHint, clientStep, contentStep, isOverdue, nextWeekday, overdueDays, postedThisWeek, taxReserve, weekStart } from './pipelines'
import { planToIcs } from './ics'
import type { ClientCard, ContentCard } from './types'

const content = (p: Partial<ContentCard> = {}): ContentCard => ({ id: 'c', title: 'Video', stage: 0, active: false, createdAt: 0, ...p })
const client = (p: Partial<ClientCard> = {}): ClientCard => ({ id: 'k', name: 'Studio Nord', stage: 0, createdAt: 0, ...p })

describe('Content-Pipeline', () => {
  it('kennt für jede Spalte den nächsten Schritt', () => {
    expect(contentStep(content({ stage: 0 }))!.title).toBe('Skript schreiben: Video')
    expect(contentStep(content({ stage: 1 }))!.shoot).toBe(true)
    expect(contentStep(content({ stage: 2 }))!.title).toContain('Schneiden')
    expect(contentStep(content({ stage: 3 }))!.kind).toBe('light')
    expect(contentStep(content({ stage: 4 }))).toBeUndefined()
  })

  it('zählt nur aktive, noch nicht gepostete Stücke aufs WIP-Limit', () => {
    const cards = [content({ active: true, stage: 1 }), content({ active: true, stage: 4 }), content({ active: false, stage: 0 }), content({ active: true, stage: 0 })]
    expect(activeCount(cards)).toBe(2)
  })

  it('zählt Posts der laufenden Woche (Montag bis Sonntag)', () => {
    const at = (d: string) => new Date(d + 'T12:00:00').getTime()
    // 2026-11-14 ist ein Samstag, die Woche beginnt am Montag 09.11.
    const cards = [content({ postedAt: at('2026-11-09') }), content({ postedAt: at('2026-11-13') }), content({ postedAt: at('2026-11-08') }), content()]
    expect(weekStart('2026-11-14')).toBe('2026-11-09')
    expect(postedThisWeek(cards, '2026-11-14')).toBe(2)
  })

  it('schlägt Batching vor', () => {
    expect(batchHint([], undefined)).toContain('Dreh-Tag')
    expect(batchHint([content({ stage: 1 }), content({ stage: 1 })], 2)).toContain('2 Skripte')
    expect(batchHint([content({ stage: 1 })], 2)).toBeUndefined()
  })

  it('findet den nächsten Dreh-Tag', () => {
    expect(nextWeekday('2026-11-14', 6)).toBe('2026-11-14') // heute ist Samstag
    expect(nextWeekday('2026-11-14', 2)).toBe('2026-11-17') // nächster Dienstag
    expect(weekStart('2026-11-09')).toBe('2026-11-09')
    expect(weekStart('2026-11-15')).toBe('2026-11-09') // Sonntag gehört zur Woche davor
  })
})

describe('Kunden-Pipeline', () => {
  it('Lead → Angebot schreiben rückt die Karte weiter, Nachfassen nicht', () => {
    expect(clientStep(client({ stage: 0 }))!.advance).toBe(true)
    const follow = clientStep(client({ stage: 1 }))!
    expect(follow.advance).toBe(false)
    expect(follow.delayDays).toBe(3)
    expect(clientStep(client({ stage: 2 }))).toBeUndefined()
  })

  it('Rechnung ist nach 14 Tagen überfällig', () => {
    const c = client({ stage: 3, invoiceDate: '2026-11-01' })
    expect(isOverdue(c, '2026-11-15')).toBe(false)
    expect(isOverdue(c, '2026-11-16')).toBe(true)
    expect(overdueDays(c, '2026-11-20')).toBe(5)
    expect(isOverdue(client({ stage: 4, invoiceDate: '2026-01-01' }), '2026-11-16')).toBe(false)
  })

  it('rechnet die Steuer-Rücklage', () => {
    expect(taxReserve(5000, 30)).toBe(1500)
    expect(taxReserve(1234, 25)).toBe(309)
  })
})

describe('Kalender-Export', () => {
  it('erzeugt gültige Termine mit lokaler Uhrzeit und Erinnerung', () => {
    const ics = planToIcs(
      [
        {
          date: '2026-11-16',
          deferred: [],
          plannedRatio: 0,
          builtAt: 0,
          blocks: [
            { id: 'task-a-1', type: 'task', title: 'Angebot, Teil 1; fertig', start: 450, end: 495, main: true },
            { id: 'break-a-1', type: 'break', title: 'Pause', start: 495, end: 505 },
            { id: 'shutdown', type: 'shutdown', title: 'Abend-Shutdown', start: 1290, end: 1310 },
          ],
        },
      ],
      new Date('2026-11-15T10:00:00Z'),
    )
    expect(ics.startsWith('BEGIN:VCALENDAR\r\n')).toBe(true)
    expect(ics.trimEnd().endsWith('END:VCALENDAR')).toBe(true)
    expect(ics.match(/BEGIN:VEVENT/g)!.length).toBe(2) // Pause wird nicht exportiert
    expect(ics).toContain('DTSTART:20261116T073000')
    expect(ics).toContain('DTEND:20261116T081500')
    expect(ics).toContain('SUMMARY:⭐ Angebot\\, Teil 1\\; fertig')
    expect(ics).toContain('TRIGGER:-PT5M')
    expect(ics).toContain('DTSTAMP:20261115T100000Z')
  })
})
