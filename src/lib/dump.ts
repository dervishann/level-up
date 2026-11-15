import type { Level3, ZoneId } from './types'
import { addDays, weekdayOf } from './date'
import { looksLikeIdea, suggestDread, suggestKind, suggestMinutes, suggestZone } from './suggest'
import { parseMoney } from './goals'

// =====================================================================
// Life Dump: Freitext rein → einzelne Punkte mit Vorschlag raus.
// Reine Funktionen ohne KI. Die Erkennung ist absichtlich vorsichtig:
// Der Nutzer sieht jeden Vorschlag in einer Prüfliste und korrigiert per
// Tipp, bevor etwas eingepflegt wird.
//
// Arten:
//  task     → Aufgabe im Plan (mit Tag, Dauer, Priorität)
//  goal     → Ziel, das danach in eine Quest-Kette zerlegt wird
//  idea     → Ideen-Truhe
//  content  → Video-Idee in der Content-Pipeline
//  lead     → neuer Kunde in der Kunden-Pipeline
//  note     → Notiz zur eigenen Lage, landet als Ast auf der Lebens-Karte
//  skip     → wird ignoriert
// =====================================================================

export type DumpType = 'task' | 'goal' | 'idea' | 'content' | 'lead' | 'note' | 'skip'

export interface DumpItem {
  id: string
  text: string
  type: DumpType
  zone: ZoneId
  /** YYYY-MM-DD; leer = irgendwann */
  date?: string
  deadline?: string
  minutes: number
  priority: Level3
  dread: Level3
  kind: 'deep' | 'light'
  /** Name bei neuen Kunden */
  name?: string
}

export const TYPE_LABEL: Record<DumpType, string> = {
  task: 'Aufgabe',
  goal: 'Ziel',
  idea: 'Idee',
  content: 'Video-Idee',
  lead: 'Neuer Kunde',
  note: 'Notiz',
  skip: 'Ignorieren',
}

const has = (t: string, re: RegExp) => re.test(t)

// \b in JavaScript kennt keine Umlaute („übermorgen“, „über“, „müde“). rx() ersetzt \b durch eine Unicode-Wortgrenze.
const W = '[\\p{L}\\p{N}_]'
const B = `(?:(?<!${W})(?=${W})|(?<=${W})(?!${W}))`
const rx = (re: RegExp) => new RegExp(re.source.replace(/\\b/g, B), re.flags.replace('u', '') + 'u')

/** Zerlegt den Text in einzelne Punkte (Zeilen, Aufzählungen, Sätze, „außerdem“ …). */
export function splitDump(text: string): string[] {
  return text
    .replace(/\r/g, '')
    .split(/\n+|;\s*|\s+(?:und außerdem|außerdem|ausserdem|und dann noch|und noch)\s+/i)
    .flatMap((part) => part.split(/(?<=[^\d\s.][.!?])\s+(?=[A-ZÄÖÜ])/))
    .map((s) =>
      s
        .replace(/^\s*(?:[-*•–·]|\d+[.)])\s*/, '')
        .replace(/^(?:und außerdem|außerdem|ausserdem|und dann noch|und noch|und)\s+/i, '')
        .replace(/\s+/g, ' ')
        .replace(/[.!]+$/, '')
        .trim(),
    )
    .filter((s) => s.length >= 3)
}

const WEEKDAYS: [RegExp, number][] = [
  [/\b(?:am |bis )?(?:sonntag|so\.)\b/i, 0],
  [/\b(?:am |bis )?(?:montag|mo\.)\b/i, 1],
  [/\b(?:am |bis )?(?:dienstag|di\.)\b/i, 2],
  [/\b(?:am |bis )?(?:mittwoch|mi\.)\b/i, 3],
  [/\b(?:am |bis )?(?:donnerstag|do\.)\b/i, 4],
  [/\b(?:am |bis )?(?:freitag|fr\.)\b/i, 5],
  [/\b(?:am |bis )?(?:samstag|sa\.)\b/i, 6],
]

/** Findet ein Datum im Text. deadline = mit „bis“ formuliert. */
export function parseWhen(text: string, today: string): { date?: string; deadline?: string; vague?: boolean } {
  const t = text.toLowerCase()
  const isDeadline = rx(/\bbis\b/).test(t)
  const result = (d: string) => (isDeadline ? { date: d <= addDays(today, 1) ? d : undefined, deadline: d } : { date: d })

  if (rx(/\bübermorgen\b/).test(t)) return result(addDays(today, 2))
  if (rx(/\bmorgen\b/).test(t) && !rx(/\bmorgens\b/).test(t)) return result(addDays(today, 1))
  if (rx(/\b(heute|sofort|asap|gleich|dringend)\b/).test(t)) return { date: today }
  if (rx(/\bnächste woche\b|\bkommende woche\b/).test(t)) return { date: addDays(today, ((8 - weekdayOf(today)) % 7) || 7) }
  if (rx(/\b(irgendwann|mal|wenn ich zeit habe|bei gelegenheit|demnächst)\b/).test(t)) return { vague: true }

  const dm = /\b(\d{1,2})\.(\d{1,2})\.?(\d{2,4})?\b/.exec(t)
  if (dm) {
    const [y] = today.split('-').map(Number)
    let year = dm[3] ? Number(dm[3].length === 2 ? '20' + dm[3] : dm[3]) : y
    const key = (yy: number) => `${yy}-${dm[2].padStart(2, '0')}-${dm[1].padStart(2, '0')}`
    if (!dm[3] && key(year) < today) year += 1
    return result(key(year))
  }
  for (const [re, wd] of WEEKDAYS) {
    if (rx(re).test(t)) {
      const diff = (wd - weekdayOf(today) + 7) % 7
      return result(addDays(today, diff === 0 ? 7 : diff))
    }
  }
  return {}
}

const TASK = rx(/\b(muss|müsste|sollte|soll|noch|erledigen|machen|anrufen|schreiben|schicken|senden|bezahlen|überweisen|kaufen|bestellen|kündigen|beantragen|abgeben|einreichen|vorbereiten|fertig|termin|buchen|klären|melden|abholen|zurückrufen|nachfragen|planen|aufräumen|vereinbaren|gemacht|erledigt|ansteht|nachholen)\b/)
const FEELING = rx(/\b(fühl|gefühl|gestresst|stress|müde|erschöpft|nervt|genervt|sorge|sorgen|angst|überfordert|motiviert|unmotiviert|glücklich|traurig|frustriert|läuft gut|läuft schlecht|läuft nicht|ich glaube|mir ist aufgefallen|ich merke|zur zeit|gerade|momentan|aktuell)\b/)
const GOAL = rx(/\b(ziel|will .{0,40}(erreichen|schaffen|haben|werden)|bis ende|in \d+ (monaten|wochen|jahren)|follower|abonnenten|pro monat|im monat|kunden gleichzeitig)\b/)
const CONTENT = rx(/\b(video|reel|reels|tiktok|short|shorts|youtube|hook|content|post über|posten über|story über|thumbnail)\b/)
const LEAD = rx(/\b(anfrage von|neuer kunde|neue kundin|interessent|interessentin|lead|potenzieller kunde|will mit mir arbeiten|hat sich gemeldet)\b/)

/** Versucht bei neuen Kunden den Namen zu finden. */
export function guessName(text: string): string {
  const m = /(?:[Aa]nfrage von|[Kk]unde|[Kk]undin|[Ii]nteressent(?:in)?|[Ll]ead)[:\s]+(?:ein(?:e|en)?\s+)?(\p{Lu}[\p{L}\p{N}&.-]*(?:\s+\p{Lu}[\p{L}\p{N}&.-]*){0,3})/u.exec(text)
  if (m) return m[1].trim()
  const caps = /(?<!\p{L})(\p{Lu}[\p{L}&-]+(?:\s+\p{Lu}[\p{L}&-]+){0,2})\s+(?:hat|will|möchte|braucht)(?!\p{L})/u.exec(text)
  return caps ? caps[1] : text.slice(0, 40)
}

/** Macht aus „Muss bis Freitag noch die Rechnung schicken“ → „Rechnung schicken“. Zeit und Dringlichkeit sind da schon erkannt. */
export function cleanTitle(text: string): string {
  const lead = rx(/^(?:ich\s+)?(?:muss|müsste|sollte|soll|will|wollte|noch|heute|morgen|übermorgen|dringend|unbedingt|sofort|asap|irgendwann|mal|nächste woche|diese woche|(?:am|bis)\s+(?:\d{1,2}\.\d{1,2}\.?(?:\d{2,4})?|montag|dienstag|mittwoch|donnerstag|freitag|samstag|sonntag|morgen|übermorgen))(?:\b|(?<=\.))[,\s]*/i)
  let t = text.trim()
  for (let i = 0; i < 8; i++) {
    const next = t.replace(lead, '')
    if (next === t) break
    t = next
  }
  t = t.replace(/^(?:die|der|das|den|dem|ein|eine|einen)\s+(?=\p{Lu})/u, '')
  if (t.length < 3) return text.trim()
  return t.charAt(0).toUpperCase() + t.slice(1)
}

export function classify(text: string, knownClients: string[] = []): DumpType {
  const t = text.toLowerCase()
  const isClient = knownClients.some((c) => c.length >= 3 && t.includes(c.toLowerCase()))
  if (has(t, LEAD) && !isClient) return 'lead'
  if (parseMoney(text) !== undefined && has(t, GOAL)) return 'goal'
  if (has(t, GOAL) && !has(t, TASK)) return 'goal'
  if (has(t, CONTENT) && (looksLikeIdea(text) || rx(/\b(idee|über|zum thema)\b/).test(t)) && !rx(/\b(schneiden|posten|hochladen|drehen)\b/).test(t)) return 'content'
  if (looksLikeIdea(text) && !has(t, TASK)) return 'idea'
  if (has(t, FEELING) && !has(t, TASK)) return 'note'
  return 'task'
}

export function processDump(text: string, today: string, knownClients: string[] = [], makeId: () => string = () => Math.random().toString(36).slice(2, 10)): DumpItem[] {
  return splitDump(text).map((raw) => {
    const t = raw.toLowerCase()
    const type = classify(raw, knownClients)
    const when = parseWhen(raw, today)
    const urgent = rx(/\b(dringend|wichtig|unbedingt|asap|sofort|deadline)\b/).test(t) || (!!when.deadline && when.deadline <= addDays(today, 2))
    const someday = when.vague || rx(/\b(kann warten|nicht so wichtig|irgendwann)\b/).test(t)
    const quick = rx(/\b(kurz|schnell|nur eben|5 min)\b/).test(t)
    let minutes = quick ? 10 : suggestMinutes(raw)
    const mm = rx(/(\d+)\s*(min|minuten|std|stunden|h)\b/).exec(t)
    if (mm) minutes = Math.min(180, Math.max(5, Number(mm[1]) * (/^(std|stunden|h)$/.test(mm[2]) ? 60 : 1)))
    const dread: Level3 = rx(/\b(keinen bock|kein bock|nervt|schiebe|seit wochen|seit monaten|hasse|ätzend)\b/).test(t) ? 3 : suggestDread(raw)
    const isClient = knownClients.some((c) => c.length >= 3 && t.includes(c.toLowerCase()))
    const zone: ZoneId = type === 'content' ? 3 : type === 'lead' || isClient ? 5 : type === 'goal' && parseMoney(raw) !== undefined ? 4 : suggestZone(raw)
    return {
      id: makeId(),
      text: type === 'task' ? cleanTitle(raw) : raw,
      type,
      zone,
      date: type === 'task' ? (when.date ?? (someday ? undefined : urgent ? today : addDays(today, 1))) : undefined,
      deadline: when.deadline,
      minutes,
      priority: urgent ? 3 : someday ? 1 : 2,
      dread,
      kind: suggestKind(raw, minutes),
      name: type === 'lead' ? guessName(raw) : undefined,
    }
  })
}
