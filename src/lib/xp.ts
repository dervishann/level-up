import type { StatKey, Task, ZoneId } from './types'

// ---------- XP-Formel (wird in den Einstellungen genau so angezeigt) ----------
// XP = (Minuten × 0,5) × Schwierigkeit × Keinen-Bock-Faktor
//      + 10 (Main Quest) + 15 (Eat the Frog) + Streak-Bonus (1 % pro Tag, max. 20 %)
//      + 25 (Comeback-Quest nach verpasstem Tag)

export const DIFFICULTY_FACTOR = { 1: 1, 2: 1.25, 3: 1.5 } as const
export const DREAD_FACTOR = { 1: 1, 2: 1.3, 3: 1.6 } as const

export const XP = {
  start: 5,
  daily: 5,
  checkin: 5,
  block: 5,
  training: 20,
  shutdown: 20,
  mapAnswer: 10,
  zoneComplete: 50,
  mainBonus: 10,
  frogBonus: 15,
  comeback: 25,
  inboxSorted: 2,
  nodeClear: 3,
  dumpItem: 2,
  focusSession: 10,
  phoneAway: 3,
  goalDone: 100,
}

export interface XpBreakdown {
  base: number
  main: number
  frog: number
  streak: number
  comeback: number
  total: number
}

export function taskXp(
  task: Pick<Task, 'minutes' | 'difficulty' | 'dread'>,
  opts: { main?: boolean; frog?: boolean; streak?: number; comeback?: boolean } = {},
): XpBreakdown {
  const base = Math.max(3, Math.round(task.minutes * 0.5 * DIFFICULTY_FACTOR[task.difficulty] * DREAD_FACTOR[task.dread]))
  const main = opts.main ? XP.mainBonus : 0
  const frog = opts.frog ? XP.frogBonus : 0
  const streak = Math.round(base * Math.min(opts.streak ?? 0, 20) * 0.01)
  const comeback = opts.comeback ? XP.comeback : 0
  return { base, main, frog, streak, comeback, total: base + main + frog + streak + comeback }
}

// ---------- Level ----------
// Von Level n auf n+1 braucht man 100 + (n − 1) × 50 XP.

export const xpForLevel = (level: number): number => 100 + (level - 1) * 50

export function levelInfo(totalXp: number): { level: number; into: number; need: number; title: string } {
  let level = 1
  let rest = totalXp
  while (rest >= xpForLevel(level)) {
    rest -= xpForLevel(level)
    level++
  }
  return { level, into: rest, need: xpForLevel(level), title: titleFor(level) }
}

const TITLES: [number, string][] = [
  [1, 'Rookie'],
  [3, 'Frühaufsteher'],
  [5, 'Macher'],
  [8, 'Hustler'],
  [12, 'Profi'],
  [16, 'Unternehmer'],
  [21, 'Stratege'],
  [27, 'Boss'],
  [35, 'CEO'],
  [45, 'Legende'],
]

export const titleFor = (level: number): string => {
  let t = TITLES[0][1]
  for (const [min, name] of TITLES) if (level >= min) t = name
  return t
}

/** Preis eines Streak-Freeze im Shop (max. 1 pro Woche) */
export const FREEZE_COST = 50

/** 1 Coin pro 10 XP */
export const coinsFor = (xp: number): number => Math.round(xp / 10)

export const STAT_LABEL: Record<StatKey, string> = {
  fokus: 'Fokus',
  staerke: 'Stärke',
  business: 'Business',
  reichweite: 'Reichweite',
  disziplin: 'Disziplin',
  klarheit: 'Klarheit',
}

export const ZONE_STAT: Record<ZoneId, StatKey> = {
  1: 'klarheit',
  2: 'klarheit',
  3: 'reichweite',
  4: 'business',
  5: 'business',
  6: 'reichweite',
  7: 'staerke',
  8: 'disziplin',
}
