import type { ClientCard, ContentCard, Level3, ZoneId } from './types'
import { addDays, dateKey, parseKey, weekdayOf } from './date'

// =====================================================================
// Business-Pipelines (einfache Kanban-Boards). Reine Funktionen.
//
// Grundidee: Jede Karte hat pro Spalte genau einen "nächsten Schritt".
// Dieser Schritt wird automatisch zur Quest im Tagesplan. Ist die Quest
// erledigt, rückt die Karte eine Spalte weiter und der nächste Schritt
// entsteht. So muss man nie überlegen, was bei einem Video oder Kunden
// als Nächstes dran ist.
// =====================================================================

export const CONTENT_STAGES = ['Idee', 'Skript', 'Gedreht', 'Geschnitten', 'Gepostet']
export const CLIENT_STAGES = ['Lead', 'Angebot', 'Läuft', 'Rechnung gestellt', 'Bezahlt']
export const LAST_STAGE = 4
/** Zahlungsziel in Tagen, danach wird eine Rechnung zur Mahn-Quest */
export const DUE_DAYS = 14

export interface StepSpec {
  title: string
  minutes: number
  kind: 'deep' | 'light'
  dread: Level3
  zone: ZoneId
  /** Karte rückt beim Erledigen eine Spalte weiter */
  advance: boolean
  /** gehört auf den Dreh-Tag (Batching) */
  shoot?: boolean
  /** erst in so vielen Tagen fällig */
  delayDays?: number
}

/** Nächster Schritt eines Content-Stücks, abhängig von der Spalte. */
export function contentStep(card: Pick<ContentCard, 'title' | 'stage'>): StepSpec | undefined {
  const t = card.title
  switch (card.stage) {
    case 0:
      return { title: `Skript schreiben: ${t}`, minutes: 45, kind: 'deep', dread: 1, zone: 3, advance: true }
    case 1:
      return { title: `Drehen: ${t}`, minutes: 20, kind: 'deep', dread: 2, zone: 3, advance: true, shoot: true }
    case 2:
      return { title: `Schneiden: ${t}`, minutes: 45, kind: 'deep', dread: 2, zone: 3, advance: true }
    case 3:
      return { title: `Posten: ${t}`, minutes: 10, kind: 'light', dread: 1, zone: 6, advance: true }
    default:
      return undefined
  }
}

/** Nächster Schritt bei einem Kunden. In "Läuft" und "Rechnung gestellt" entsteht nichts automatisch. */
export function clientStep(card: Pick<ClientCard, 'name' | 'stage'>): StepSpec | undefined {
  const n = card.name
  switch (card.stage) {
    case 0:
      return { title: `Angebot schreiben: ${n}`, minutes: 45, kind: 'deep', dread: 2, zone: 5, advance: true }
    case 1:
      return { title: `Beim Angebot nachfassen: ${n}`, minutes: 10, kind: 'light', dread: 2, zone: 5, advance: false, delayDays: 3 }
    default:
      return undefined
  }
}

export const invoiceStep = (name: string): StepSpec => ({ title: `Rechnung schreiben: ${name}`, minutes: 15, kind: 'light', dread: 2, zone: 4, advance: true })
export const reminderStep = (name: string): StepSpec => ({ title: `Zahlung anmahnen: ${name}`, minutes: 10, kind: 'light', dread: 3, zone: 4, advance: false })

export const taxReserve = (amount: number, ratePercent: number): number => Math.round((amount * ratePercent) / 100)

export const taxStep = (name: string, amount: number, ratePercent: number): StepSpec => ({
  title: `Steuer-Rücklage: ${taxReserve(amount, ratePercent).toLocaleString('de-DE')} € zurücklegen (${name})`,
  minutes: 5,
  kind: 'light',
  dread: 1,
  zone: 4,
  advance: false,
})

const dayDiff = (a: string, b: string) => Math.round((parseKey(b).getTime() - parseKey(a).getTime()) / 86400000)

/** Rechnung gestellt und Zahlungsziel überschritten? */
export const isOverdue = (card: ClientCard, today: string): boolean => card.stage === 3 && !!card.invoiceDate && dayDiff(card.invoiceDate, today) > DUE_DAYS

export const overdueDays = (card: ClientCard, today: string): number => (card.invoiceDate ? Math.max(0, dayDiff(card.invoiceDate, today) - DUE_DAYS) : 0)

/** Der nächste Tag mit diesem Wochentag (heute zählt mit). */
export function nextWeekday(from: string, weekday: number): string {
  const diff = (weekday - weekdayOf(from) + 7) % 7
  return addDays(from, diff)
}

/** Montag der Woche, in der das Datum liegt. */
export function weekStart(date: string): string {
  return addDays(date, -((weekdayOf(date) + 6) % 7))
}

export function postedThisWeek(cards: ContentCard[], today: string): number {
  const start = weekStart(today)
  return cards.filter((c) => c.postedAt && dateKey(new Date(c.postedAt)) >= start).length
}

/** Content-Stücke in Arbeit (für das WIP-Limit). */
export const activeCount = (cards: ContentCard[]): number => cards.filter((c) => c.active && c.stage < LAST_STAGE).length

/** Batching-Tipp: Wann lohnt sich ein gemeinsamer Dreh? */
export function batchHint(cards: ContentCard[], shootDay: number | undefined): string | undefined {
  const scripts = cards.filter((c) => c.stage === 1).length
  if (shootDay === undefined) return 'Leg einen festen Dreh-Tag pro Woche fest. Alle fertigen Skripte landen dann gesammelt auf diesem Tag, statt jeden Tag ein bisschen zu drehen.'
  if (scripts >= 2) return `${scripts} Skripte warten auf den Dreh. Dreh sie an deinem Dreh-Tag am Stück: einmal aufbauen, alles aufnehmen.`
  return undefined
}

export const WEEKDAY_LONG = ['Sonntag', 'Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag', 'Samstag']
