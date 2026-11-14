import { describe, expect, it } from 'vitest'
import { leavesInOrder, moneyDrafts, moneyPlan, nextActionable, nextUnclear, parseMoney, pathTo, progress, propagateDone, subtree } from './goals'
import type { GoalNode } from './types'

const G = 'g1'
const node = (id: string, parentId: string | undefined, order: number, p: Partial<GoalNode> = {}): GoalNode => ({ id, goalId: G, parentId, title: id, order, done: false, ...p })

// Ziel
// ├─ a (Zwischenziel)
// │   ├─ a1 (klar, 25 Min)
// │   └─ a2 (klar, 45 Min)
// ├─ b (noch unklar)
// └─ c
//     └─ c1 (klar)
const tree = (): GoalNode[] => [
  node('c', undefined, 2),
  node('a', undefined, 0),
  node('b', undefined, 1),
  node('a2', 'a', 1, { minutes: 45 }),
  node('a1', 'a', 0, { minutes: 25 }),
  node('c1', 'c', 0, { minutes: 10 }),
]

describe('Quest-Kette', () => {
  it('liefert die Schritte in der richtigen Reihenfolge', () => {
    expect(leavesInOrder(tree(), G).map((n) => n.id)).toEqual(['a1', 'a2', 'b', 'c1'])
  })

  it('findet den nächsten Schritt, der noch zu groß/unklar ist', () => {
    expect(nextUnclear(tree(), G)!.id).toBe('b')
    const t = tree()
    t.find((n) => n.id === 'b')!.minutes = 25
    expect(nextUnclear(t, G)).toBeUndefined()
  })

  it('schaltet höchstens 2 Schritte gleichzeitig frei', () => {
    expect(nextActionable(tree(), G).map((n) => n.id)).toEqual(['a1', 'a2'])
  })

  it('schaltet den nächsten Schritt frei, wenn einer erledigt ist', () => {
    const t = tree()
    t.find((n) => n.id === 'a1')!.done = true
    t.find((n) => n.id === 'a2')!.taskId = 'task'
    // a2 läuft schon, b ist unklar und wird übersprungen → c1 kommt dazu
    expect(nextActionable(t, G).map((n) => n.id)).toEqual(['c1'])
  })

  it('gibt nichts frei, solange schon 2 Schritte aktiv sind', () => {
    const t = tree()
    t.find((n) => n.id === 'a1')!.taskId = 'x'
    t.find((n) => n.id === 'a2')!.taskId = 'y'
    expect(nextActionable(t, G)).toEqual([])
  })

  it('Zwischenziel ist erledigt, wenn alle Schritte darunter erledigt sind', () => {
    const t = tree()
    t.find((n) => n.id === 'a1')!.done = true
    expect(propagateDone(t, G)).toBe(false)
    expect(t.find((n) => n.id === 'a')!.done).toBe(false)
    t.find((n) => n.id === 'a2')!.done = true
    expect(propagateDone(t, G)).toBe(false)
    expect(t.find((n) => n.id === 'a')!.done).toBe(true)
  })

  it('erkennt, wenn das ganze Ziel geschafft ist', () => {
    const t = tree()
    for (const id of ['a1', 'a2', 'b', 'c1']) t.find((n) => n.id === id)!.done = true
    expect(propagateDone(t, G)).toBe(true)
    expect(progress(t, G)).toEqual({ done: 4, total: 4 })
  })

  it('zählt Fortschritt über Schritte, nicht über Zwischenziele', () => {
    const t = tree()
    t.find((n) => n.id === 'a1')!.done = true
    expect(progress(t, G)).toEqual({ done: 1, total: 4 })
  })

  it('kennt den Weg zum Schritt (das Warum)', () => {
    const t = tree()
    expect(pathTo(t, t.find((n) => n.id === 'a2')!).map((n) => n.id)).toEqual(['a', 'a2'])
  })

  it('findet einen Teilbaum komplett', () => {
    expect(subtree(tree(), 'a').map((n) => n.id).sort()).toEqual(['a', 'a1', 'a2'])
  })
})

describe('Geld-Ziel rückwärts rechnen', () => {
  it('liest Beträge aus dem Zieltext', () => {
    expect(parseMoney('10K im Monat')).toBe(10000)
    expect(parseMoney('5.000 € Umsatz im Monat')).toBe(5000)
    expect(parseMoney('2,5k nebenbei')).toBe(2500)
    expect(parseMoney('Umsatz 8000 pro Monat')).toBe(8000)
    expect(parseMoney('10.000 Follower')).toBeUndefined()
    expect(parseMoney('10 zahlende Kunden')).toBeUndefined()
  })

  it('10.000 € bei 5.000 € pro Kunde = 2 Kunden', () => {
    const p = moneyPlan({ target: 10000, price: 5000, have: 0, talksPerCustomer: 5, contactsPerTalk: 10, weeks: 12 })
    expect(p).toEqual({ customers: 2, missing: 2, talks: 10, contacts: 100, perWeek: 9 })
  })

  it('rundet Kunden auf und zieht vorhandene ab', () => {
    const p = moneyPlan({ target: 10000, price: 3000, have: 1, talksPerCustomer: 3, contactsPerTalk: 5, weeks: 8 })
    expect(p.customers).toBe(4)
    expect(p.missing).toBe(3)
    expect(p.talks).toBe(9)
    expect(p.contacts).toBe(45)
    expect(p.perWeek).toBe(6)
  })

  it('baut daraus eine Kette mit konkreten ersten Schritten', () => {
    const d = moneyDrafts({ target: 10000, price: 5000, have: 0, talksPerCustomer: 5, contactsPerTalk: 10, weeks: 12 })
    expect(d.length).toBe(4)
    expect(d[1].title).toContain('100 Wunschkunden')
    expect(d[1].children!.every((c) => c.minutes !== undefined && c.minutes <= 90)).toBe(true)
  })

  it('Ziel schon erreicht → keine Akquise-Kette', () => {
    const d = moneyDrafts({ target: 10000, price: 5000, have: 2, talksPerCustomer: 5, contactsPerTalk: 10, weeks: 12 })
    expect(d.length).toBe(1)
  })
})
