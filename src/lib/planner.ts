import type { Block, DayPlan, Task } from './types'

// =====================================================================
// Planungs-Algorithmus: baut aus Aufgaben einen Tagesplan mit Uhrzeiten.
// Reine Funktion ohne Seiteneffekte, damit sie automatisch testbar ist.
//
// Regeln:
//  1. Feste Anker: Morgenroutine, Mahlzeiten, Training, Abend-Shutdown.
//  2. Max. 3 Main Quests pro Tag (Minimal-Tag: 1).
//  3. "Eat the Frog": die unangenehmste Main Quest kommt zuerst.
//  4. Schwere Arbeit (deep) so früh wie möglich, Kleinkram (light) ab 13 Uhr.
//  5. Side Quests nur, solange max. 70 % der freien Zeit verplant sind.
//  6. Arbeitsblöcke max. 90 Minuten, danach Pause.
//  7. Was nicht passt, wird ohne Vorwurf auf später verschoben (deferred).
// =====================================================================

export interface PlanTraining {
  id: string
  type: 'gym' | 'ringen'
  start: number
  minutes: number
}

export interface PlanInput {
  date: string
  /** Aufstehzeit in Minuten seit Mitternacht */
  wake: number
  /** Schlafenszeit in Minuten seit Mitternacht */
  sleep: number
  trainings: PlanTraining[]
  /** offene Aufgaben, die für diesen Tag in Frage kommen */
  tasks: Task[]
  minimal?: boolean
  /** heute schon erledigte Main Quests (zählen aufs Tageslimit) */
  mainsDone?: number
  /** Neu berechnen: nur ab dieser Minute planen */
  fromMin?: number
  /** bereits erledigte Block-IDs (werden nicht neu eingeplant) */
  doneBlockIds?: string[]
  /** Korrekturfaktor für Zeitschätzungen (1 = unverändert) */
  estimateFactor?: number
  builtAt?: number
}

export const MAX_MAINS = 3
export const MAX_PLANNED_RATIO = 0.7
export const MAX_CHUNK = 90
export const MIN_CHUNK = 25
export const LIGHT_FROM = 13 * 60

type Interval = [number, number]

const round5 = (n: number) => Math.max(5, Math.round(n / 5) * 5)
const ceil5 = (n: number) => Math.ceil(n / 5) * 5

const overlaps = (a: Interval, b: Interval) => a[0] < b[1] && b[0] < a[1]

/** Schneidet [s, e] aus der Liste freier Intervalle heraus. */
function carve(free: Interval[], s: number, e: number): Interval[] {
  const out: Interval[] = []
  for (const [a, b] of free) {
    if (e <= a || s >= b) {
      out.push([a, b])
      continue
    }
    if (s > a) out.push([a, s])
    if (e < b) out.push([e, b])
  }
  return out
}

function daysBetween(a: string, b: string): number {
  const p = (k: string) => {
    const [y, m, d] = k.split('-').map(Number)
    return Date.UTC(y, m - 1, d)
  }
  return Math.round((p(b) - p(a)) / 86400000)
}

/** Wie dringend/wichtig ist eine Aufgabe? Höher = wichtiger. */
export function score(t: Task, date: string): number {
  let s = t.priority * 10 + t.dread
  if (t.deadline) {
    const d = daysBetween(date, t.deadline)
    if (d <= 0) s += 15
    else if (d <= 2) s += 8
  }
  return s
}

/** Wählt die Main Quests des Tages (markierte zuerst, sonst die wichtigsten). */
export function pickMains(tasks: Task[], date: string, max = MAX_MAINS): Task[] {
  const byScore = (a: Task, b: Task) => score(b, date) - score(a, date)
  const flagged = tasks.filter((t) => t.isMain).sort(byScore)
  const rest = tasks.filter((t) => !t.isMain).sort(byScore)
  return [...flagged, ...rest].slice(0, max)
}

/** Der "Frosch": die Main Quest, die am meisten aufgeschoben wird. */
export function pickFrog(mains: Task[]): Task | undefined {
  const c = mains.filter((t) => t.dread >= 2)
  if (!c.length) return undefined
  return [...c].sort((a, b) => b.dread - a.dread || b.difficulty - a.difficulty)[0]
}

export function buildDayPlan(input: PlanInput): DayPlan {
  const { date, wake, sleep, minimal } = input
  const done = new Set(input.doneBlockIds ?? [])
  const factor = input.estimateFactor ?? 1
  const replanning = input.fromMin !== undefined
  const from = Math.max(wake, replanning ? ceil5(input.fromMin!) : wake)
  const shutdownStart = Math.max(sleep - 60, Math.min(from, sleep - 20))
  const dayEnd = shutdownStart

  const blocks: Block[] = []
  const occupied: Interval[] = []
  const put = (b: Block) => {
    blocks.push(b)
    occupied.push([b.start, b.end])
  }

  // ---- 1. Feste Anker ----
  if (!done.has('shutdown')) {
    put({ id: 'shutdown', type: 'shutdown', title: 'Abend-Shutdown', start: shutdownStart, end: shutdownStart + 20, zone: 8 })
  }

  for (const t of input.trainings) {
    const id = `training-${t.id}`
    if (done.has(id)) continue
    const end = t.start + t.minutes
    if (replanning && end <= from) continue // schon vorbei
    put({ id, type: 'training', title: t.type === 'gym' ? 'Gym' : 'Ringen', start: t.start, end, zone: 7 })
  }

  // Bewegliche Anker: bevorzugte Zeit, rutschen bei Bedarf nach hinten.
  const floating: { id: string; type: Block['type']; title: string; pref: number; dur: number; zone: 7 | 8 }[] = [
    { id: 'routine-morning', type: 'routine', title: 'Morgenroutine + Check-in', pref: wake, dur: 30, zone: 8 },
    { id: 'meal-breakfast', type: 'meal', title: 'Frühstück', pref: wake + 30, dur: 20, zone: 7 },
    { id: 'meal-lunch', type: 'meal', title: 'Mittagessen', pref: 12 * 60 + 30, dur: 40, zone: 7 },
    { id: 'meal-dinner', type: 'meal', title: 'Abendessen', pref: 18 * 60 + 30, dur: 40, zone: 7 },
  ]
  for (const f of floating) {
    if (done.has(f.id)) continue
    if (from > f.pref + 120) continue // Fenster verpasst – kein Vorwurf, einfach weiter
    let start = Math.max(f.pref, from)
    let placed = false
    for (; start + f.dur <= dayEnd; start += 5) {
      const iv: Interval = [start, start + f.dur]
      if (!occupied.some((o) => overlaps(o, iv))) {
        placed = true
        break
      }
    }
    if (!placed) {
      // rückwärts suchen (z. B. Abendessen vor einem späten Training)
      for (start = Math.min(f.pref, dayEnd - f.dur); start >= from; start -= 5) {
        const iv: Interval = [start, start + f.dur]
        if (!occupied.some((o) => overlaps(o, iv))) {
          placed = true
          break
        }
      }
    }
    if (placed) put({ id: f.id, type: f.type, title: f.title, start, end: start + f.dur, zone: f.zone })
  }

  // ---- 2. Freie Zeitfenster ----
  let free: Interval[] = from < dayEnd ? [[from, dayEnd]] : []
  for (const [s, e] of occupied) free = carve(free, s, e)
  const totalFree = free.reduce((sum, [a, b]) => sum + (b - a), 0)
  const budget = totalFree * MAX_PLANNED_RATIO

  // ---- 3. Aufgaben auswählen und sortieren ----
  const open = input.tasks.filter((t) => t.status === 'open')
  const mains = pickMains(open, date, Math.max(0, (minimal ? 1 : MAX_MAINS) - (input.mainsDone ?? 0)))
  const mainIds = new Set(mains.map((t) => t.id))
  const frog = pickFrog(mains)
  const byScore = (a: Task, b: Task) => score(b, date) - score(a, date)
  const orderedMains = [
    ...(frog ? [frog] : []),
    ...mains.filter((t) => t !== frog).sort((a, b) => (a.kind === b.kind ? byScore(a, b) : a.kind === 'deep' ? -1 : 1)),
  ]
  const sides = minimal ? [] : open.filter((t) => !mainIds.has(t.id)).sort(byScore)

  // ---- 4. Aufgaben in die Fenster legen ----
  const deferred: string[] = []
  let used = 0

  const tryPlace = (t: Task, isMain: boolean): boolean => {
    const dur = round5(t.minutes * factor)
    const earliest = !isMain && t.kind === 'light' ? LIGHT_FROM : 0
    for (const minStart of earliest > 0 ? [earliest, 0] : [0]) {
      let work = free.map((iv) => [...iv] as Interval)
      const chunks: Interval[] = []
      let remaining = dur

      // Passt die Aufgabe am Stück? Dann nicht zerteilen.
      if (dur <= MAX_CHUNK) {
        const slot = work.find(([a, b]) => b - Math.max(a, minStart) >= dur)
        if (slot) {
          const s = Math.max(slot[0], minStart)
          chunks.push([s, s + dur])
          remaining = 0
        }
      }
      // Sonst in Blöcke von max. 90 Minuten aufteilen.
      while (remaining > 0) {
        const need = Math.min(remaining, MIN_CHUNK)
        const slot = work.find(([a, b]) => b - Math.max(a, minStart) >= need)
        if (!slot) break
        const s = Math.max(slot[0], minStart)
        let len = Math.min(remaining, slot[1] - s, MAX_CHUNK)
        const left = remaining - len
        if (left > 0 && left < MIN_CHUNK) len -= MIN_CHUNK - left // kein Mini-Rest übrig lassen
        if (len < Math.min(remaining, MIN_CHUNK)) {
          work = carve(work, s, slot[1]) // Fenster zu klein, überspringen
          continue
        }
        chunks.push([s, s + len])
        remaining -= len
        const gap = len >= 45 ? 10 : 5
        work = carve(work, s, s + len + gap)
      }
      if (remaining > 0) continue

      chunks.forEach(([s, e], i) => {
        const len = e - s
        blocks.push({
          id: `task-${t.id}-${i + 1}`,
          type: 'task',
          title: chunks.length > 1 ? `${t.title} (Teil ${i + 1}/${chunks.length})` : t.title,
          start: s,
          end: e,
          taskId: t.id,
          zone: t.zone,
          main: isMain || undefined,
          frog: (isMain && t === frog) || undefined,
        })
        const gap = len >= 45 ? 10 : 5
        const gapEnd = Math.min(e + gap, dayEnd)
        const gapFree = free.some(([a, b]) => a <= e && b >= gapEnd) && gapEnd > e
        if (len >= 45 && gapFree) {
          blocks.push({ id: `break-${t.id}-${i + 1}`, type: 'break', title: 'Pause', start: e, end: gapEnd })
        }
        free = carve(free, s, e + gap)
      })
      used += dur
      return true
    }
    return false
  }

  for (const t of orderedMains) if (!tryPlace(t, true)) deferred.push(t.id)
  for (const t of sides) {
    const dur = round5(t.minutes * factor)
    if (used + dur > budget || !tryPlace(t, false)) deferred.push(t.id)
  }
  if (minimal) for (const t of open) if (!mainIds.has(t.id)) deferred.push(t.id)

  blocks.sort((a, b) => a.start - b.start || a.end - b.end)

  return {
    date,
    blocks,
    deferred,
    plannedRatio: totalFree > 0 ? used / totalFree : 0,
    builtAt: input.builtAt ?? 0,
  }
}

/** Die nächste Aktion: der erste Block, der noch nicht erledigt ist (Pausen zählen nicht). */
export function currentBlock(plan: DayPlan | undefined, doneIds: string[]): Block | undefined {
  if (!plan) return undefined
  const done = new Set(doneIds)
  return plan.blocks.find((b) => b.type !== 'break' && !done.has(b.id))
}

export function nextBlocks(plan: DayPlan | undefined, doneIds: string[], n = 2): Block[] {
  if (!plan) return []
  const done = new Set(doneIds)
  return plan.blocks.filter((b) => b.type !== 'break' && !done.has(b.id)).slice(1, 1 + n)
}

/** Wie viele Minuten hänge ich hinterher? (0 = im Plan) */
export function behindBy(plan: DayPlan | undefined, doneIds: string[], now: number): number {
  const cur = currentBlock(plan, doneIds)
  if (!cur) return 0
  return Math.max(0, now - cur.end)
}
