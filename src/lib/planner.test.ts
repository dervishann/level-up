import { describe, expect, it } from 'vitest'
import { buildDayPlan, currentBlock, behindBy, estimateFactor, neglectedZones, LIGHT_FROM, MAX_CHUNK, type PlanInput } from './planner'
import type { Task } from './types'

let n = 0
const task = (p: Partial<Task> = {}): Task => ({
  id: `t${++n}`,
  title: `Aufgabe ${n}`,
  zone: 5,
  minutes: 30,
  difficulty: 2,
  dread: 1,
  kind: 'deep',
  priority: 2,
  status: 'open',
  steps: [],
  stepsDone: 0,
  actualMinutes: 0,
  createdAt: 0,
  ...p,
})

const base = (p: Partial<PlanInput> = {}): PlanInput => ({
  date: '2026-11-16',
  wake: 6 * 60 + 30,
  sleep: 22 * 60 + 30,
  trainings: [],
  tasks: [],
  ...p,
})

const noOverlap = (plan: ReturnType<typeof buildDayPlan>) => {
  const b = plan.blocks
  for (let i = 1; i < b.length; i++) expect(b[i].start, `${b[i - 1].title} / ${b[i].title}`).toBeGreaterThanOrEqual(b[i - 1].end)
}

describe('Tagesplan bauen', () => {
  it('enthält alle Anker in der richtigen Reihenfolge, ohne Überschneidung', () => {
    const plan = buildDayPlan(base())
    expect(plan.blocks.map((b) => b.id)).toEqual(['routine-morning', 'meal-breakfast', 'meal-lunch', 'meal-dinner', 'shutdown'])
    expect(plan.blocks[0].start).toBe(390)
    expect(plan.blocks.at(-1)!.start).toBe(21 * 60 + 30)
    noOverlap(plan)
  })

  it('plant höchstens 3 Main Quests', () => {
    const tasks = Array.from({ length: 6 }, () => task({ isMain: true }))
    const plan = buildDayPlan(base({ tasks }))
    const mains = new Set(plan.blocks.filter((b) => b.main).map((b) => b.taskId))
    expect(mains.size).toBe(3)
    noOverlap(plan)
  })

  it('wählt automatisch die wichtigsten Aufgaben als Main Quests', () => {
    const low = task({ priority: 1 })
    const high = task({ priority: 3 })
    const due = task({ priority: 1, deadline: '2026-11-16' })
    const mid = task({ priority: 2 })
    const plan = buildDayPlan(base({ tasks: [low, high, due, mid] }))
    const mains = plan.blocks.filter((b) => b.main).map((b) => b.taskId)
    expect(mains).toContain(high.id)
    expect(mains).toContain(due.id)
    expect(mains).not.toContain(low.id)
  })

  it('Eat the Frog: die unangenehmste Main Quest kommt zuerst', () => {
    const a = task({ isMain: true, priority: 3 })
    const frog = task({ isMain: true, dread: 3, priority: 1 })
    const c = task({ isMain: true, priority: 3 })
    const plan = buildDayPlan(base({ tasks: [a, frog, c] }))
    const first = plan.blocks.find((b) => b.type === 'task')!
    expect(first.taskId).toBe(frog.id)
    expect(first.frog).toBe(true)
  })

  it('legt Kleinkram auf den Nachmittag', () => {
    const mains = [task({ isMain: true }), task({ isMain: true }), task({ isMain: true })]
    const light = task({ kind: 'light', minutes: 15, priority: 1 })
    const plan = buildDayPlan(base({ tasks: [...mains, light] }))
    const b = plan.blocks.find((x) => x.taskId === light.id)!
    expect(b.start).toBeGreaterThanOrEqual(LIGHT_FROM)
  })

  it('verplant mit Side Quests nie mehr als 70 % der freien Zeit', () => {
    const tasks = Array.from({ length: 30 }, () => task({ minutes: 60 }))
    const plan = buildDayPlan(base({ tasks }))
    expect(plan.plannedRatio).toBeLessThanOrEqual(0.7)
    expect(plan.deferred.length).toBeGreaterThan(0)
    noOverlap(plan)
  })

  it('Training ist fester Anker, Abendessen weicht aus', () => {
    const plan = buildDayPlan(base({ trainings: [{ id: 'r1', type: 'ringen', start: 18 * 60, minutes: 90 }] }))
    const tr = plan.blocks.find((b) => b.id === 'training-r1')!
    const dinner = plan.blocks.find((b) => b.id === 'meal-dinner')!
    expect(tr.start).toBe(18 * 60)
    expect(dinner.start).toBeGreaterThanOrEqual(tr.end)
    noOverlap(plan)
  })

  it('Minimal-Tag: nur 1 Main Quest, alles andere verschoben', () => {
    const tasks = [task({ isMain: true }), task({ isMain: true }), task(), task()]
    const plan = buildDayPlan(base({ tasks, minimal: true }))
    expect(plan.blocks.filter((b) => b.type === 'task').length).toBe(1)
    expect(plan.deferred.length).toBe(3)
  })

  it('erledigte Main Quests zählen aufs Tageslimit', () => {
    const tasks = [task({ isMain: true }), task({ isMain: true }), task({ isMain: true })]
    const plan = buildDayPlan(base({ tasks, mainsDone: 2 }))
    expect(plan.blocks.filter((b) => b.main).length).toBe(1)
    const min = buildDayPlan(base({ tasks, minimal: true, mainsDone: 1 }))
    expect(min.blocks.filter((b) => b.type === 'task').length).toBe(0)
  })

  it('teilt lange Aufgaben in Blöcke von max. 90 Minuten mit Pause', () => {
    const long = task({ isMain: true, minutes: 200 })
    const plan = buildDayPlan(base({ tasks: [long] }))
    const parts = plan.blocks.filter((b) => b.taskId === long.id)
    expect(parts.length).toBeGreaterThan(1)
    for (const p of parts) expect(p.end - p.start).toBeLessThanOrEqual(MAX_CHUNK)
    expect(parts.reduce((s, p) => s + p.end - p.start, 0)).toBe(200)
    expect(plan.blocks.some((b) => b.type === 'break')).toBe(true)
    noOverlap(plan)
  })

  it('berücksichtigt den gelernten Schätzfaktor', () => {
    const t = task({ isMain: true, minutes: 40 })
    const plan = buildDayPlan(base({ tasks: [t], estimateFactor: 1.5 }))
    const b = plan.blocks.find((x) => x.taskId === t.id)!
    expect(b.end - b.start).toBe(60)
  })

  it('alle Blöcke liegen zwischen Aufstehen und Schlafen', () => {
    const tasks = Array.from({ length: 10 }, (_, i) => task({ minutes: 20 + i * 15, kind: i % 2 ? 'light' : 'deep' }))
    const plan = buildDayPlan(base({ tasks, trainings: [{ id: 'g', type: 'gym', start: 17 * 60, minutes: 75 }] }))
    for (const b of plan.blocks) {
      expect(b.start).toBeGreaterThanOrEqual(390)
      expect(b.end).toBeLessThanOrEqual(22 * 60 + 30)
    }
    noOverlap(plan)
  })
})

describe('Plan neu berechnen', () => {
  it('plant nur noch ab jetzt und lässt Erledigtes weg', () => {
    const tasks = [task({ isMain: true }), task({ isMain: true }), task({ minutes: 60 })]
    const plan = buildDayPlan(base({ tasks, fromMin: 15 * 60 + 2, doneBlockIds: ['routine-morning', 'meal-breakfast', 'meal-lunch'] }))
    for (const b of plan.blocks) expect(b.start).toBeGreaterThanOrEqual(15 * 60 + 5)
    expect(plan.blocks.find((b) => b.id === 'meal-lunch')).toBeUndefined()
    expect(plan.blocks.find((b) => b.id === 'meal-dinner')).toBeDefined()
    expect(plan.blocks.find((b) => b.id === 'shutdown')).toBeDefined()
    noOverlap(plan)
  })

  it('verschiebt Unwichtiges auf morgen, wenn der Rest-Tag zu kurz ist', () => {
    const main = task({ isMain: true, minutes: 45 })
    const sides = Array.from({ length: 6 }, () => task({ minutes: 60, priority: 1 }))
    const plan = buildDayPlan(base({ tasks: [main, ...sides], fromMin: 19 * 60 }))
    expect(plan.blocks.some((b) => b.taskId === main.id)).toBe(true)
    expect(plan.deferred.length).toBeGreaterThanOrEqual(5)
    noOverlap(plan)
  })

  it('verpasste Mahlzeit wird nachgeholt, wenn sie noch nicht lange her ist', () => {
    const plan = buildDayPlan(base({ fromMin: 13 * 60 + 30 }))
    const lunch = plan.blocks.find((b) => b.id === 'meal-lunch')!
    expect(lunch.start).toBe(13 * 60 + 30)
    expect(plan.blocks.find((b) => b.id === 'meal-breakfast')).toBeUndefined()
  })

  it('funktioniert auch spät am Abend noch (nur Shutdown bleibt)', () => {
    const plan = buildDayPlan(base({ tasks: [task({ isMain: true, minutes: 120 })], fromMin: 22 * 60 }))
    expect(plan.blocks.map((b) => b.id)).toEqual(['shutdown'])
    expect(plan.blocks[0].end).toBeLessThanOrEqual(22 * 60 + 30)
    expect(plan.deferred.length).toBe(1)
  })
})

describe('Was jetzt?', () => {
  it('zeigt den ersten nicht erledigten Block', () => {
    const plan = buildDayPlan(base({ tasks: [task({ isMain: true })] }))
    expect(currentBlock(plan, [])!.id).toBe('routine-morning')
    expect(currentBlock(plan, ['routine-morning'])!.id).toBe('meal-breakfast')
  })

  it('erkennt, wenn ich hinterherhänge', () => {
    const plan = buildDayPlan(base())
    expect(behindBy(plan, [], 6 * 60 + 40)).toBe(0)
    expect(behindBy(plan, [], 8 * 60)).toBe(60)
  })
})

describe('Lernende Zeitschätzung', () => {
  const done = (minutes: number, actual: number) => task({ status: 'done', minutes, actualMinutes: actual })

  it('bleibt bei 1, solange es zu wenig Daten gibt', () => {
    expect(estimateFactor([done(30, 60), done(30, 60)])).toBe(1)
  })

  it('verlängert künftige Schätzungen, wenn Aufgaben länger dauern', () => {
    expect(estimateFactor(Array.from({ length: 6 }, () => done(30, 40)))).toBe(1.35)
  })

  it('ist nach oben begrenzt und verkürzt nie', () => {
    expect(estimateFactor(Array.from({ length: 6 }, () => done(30, 120)))).toBe(1.6)
    expect(estimateFactor(Array.from({ length: 6 }, () => done(60, 20)))).toBe(1)
  })

  it('ignoriert Aufgaben ohne Timer', () => {
    expect(estimateFactor([...Array.from({ length: 4 }, () => done(30, 60)), done(30, 0), done(30, 0)])).toBe(1)
  })
})

describe('Vernachlässigte Zonen', () => {
  const at = (d: string) => new Date(d + 'T12:00:00').getTime()

  it('meldet erkundete Zonen ohne erledigte Quest seit 3 Wochen', () => {
    const tasks = [task({ zone: 4, status: 'done', doneAt: at('2026-10-01') }), task({ zone: 5, status: 'done', doneAt: at('2026-11-10') })]
    expect(neglectedZones(tasks, [4, 5], '2026-09-01', '2026-11-14')).toEqual([{ zone: 4, days: 44 }])
  })

  it('meldet nichts in den ersten Wochen nach dem Start und nichts für Zonen im Nebel', () => {
    expect(neglectedZones([], [1, 8], '2026-11-01', '2026-11-14')).toEqual([])
    expect(neglectedZones([], [1], '2026-09-01', '2026-11-14').map((n) => n.zone)).toEqual([1])
  })
})
