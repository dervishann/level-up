import type { GoalNode } from './types'

// =====================================================================
// Quest-Ketten: Ein großes Ziel wird durch Fragen so lange zerlegt, bis
// jeder Schritt in eine Sitzung passt (max. 90 Min). Reine Funktionen.
//
// Regeln:
//  1. Ein Knoten ohne Kinder ist ein "Blatt" = möglicher Schritt.
//  2. Ein Blatt mit Minuten ist "klar" und kann zur Quest werden.
//  3. Pro Ziel sind nur MAX_ACTIVE Schritte gleichzeitig im Plan.
//     Der nächste wird erst freigeschaltet, wenn einer erledigt ist.
//  4. Sind alle Kinder erledigt, ist auch das Zwischenziel erledigt.
// =====================================================================

export const MAX_ACTIVE = 2
export const MAX_DEPTH = 4

export const childrenOf = (nodes: GoalNode[], goalId: string, parentId?: string): GoalNode[] =>
  nodes.filter((n) => n.goalId === goalId && n.parentId === parentId).sort((a, b) => a.order - b.order)

/** Alle Blätter in der Reihenfolge der Kette (Tiefensuche). */
export function leavesInOrder(nodes: GoalNode[], goalId: string, parentId?: string): GoalNode[] {
  const out: GoalNode[] = []
  for (const n of childrenOf(nodes, goalId, parentId)) {
    const kids = leavesInOrder(nodes, goalId, n.id)
    if (kids.length) out.push(...kids)
    else out.push(n)
  }
  return out
}

/** Das nächste Blatt, bei dem noch unklar ist, ob es klein genug ist. */
export const nextUnclear = (nodes: GoalNode[], goalId: string): GoalNode | undefined =>
  leavesInOrder(nodes, goalId).find((n) => !n.done && n.minutes === undefined)

export function progress(nodes: GoalNode[], goalId: string): { done: number; total: number } {
  const leaves = leavesInOrder(nodes, goalId)
  return { done: leaves.filter((n) => n.done).length, total: leaves.length }
}

/** Weg vom Zwischenziel bis zu diesem Knoten (für das "Warum"). */
export function pathTo(nodes: GoalNode[], node: GoalNode): GoalNode[] {
  const path: GoalNode[] = [node]
  let cur = node
  while (cur.parentId) {
    const p = nodes.find((n) => n.id === cur.parentId)
    if (!p) break
    path.unshift(p)
    cur = p
  }
  return path
}

export const depthOf = (nodes: GoalNode[], node: GoalNode): number => pathTo(nodes, node).length

/** Markiert Zwischenziele als erledigt, sobald alle Kinder erledigt sind. Gibt true zurück, wenn das ganze Ziel geschafft ist. */
export function propagateDone(nodes: GoalNode[], goalId: string): boolean {
  const visit = (parentId?: string): boolean => {
    const kids = childrenOf(nodes, goalId, parentId)
    if (!kids.length) return false
    let all = true
    for (const k of kids) {
      const sub = childrenOf(nodes, goalId, k.id)
      if (sub.length) k.done = visit(k.id)
      if (!k.done) all = false
    }
    return all
  }
  return visit(undefined)
}

/** Welche klaren Schritte dürfen jetzt als Quest in den Plan? */
export function nextActionable(nodes: GoalNode[], goalId: string, max = MAX_ACTIVE): GoalNode[] {
  const out: GoalNode[] = []
  let active = 0
  for (const leaf of leavesInOrder(nodes, goalId)) {
    if (leaf.done) continue
    if (active >= max) break
    if (leaf.taskId) active++
    else if (leaf.minutes !== undefined) {
      out.push(leaf)
      active++
    }
  }
  return out
}

/** Alle Nachfahren eines Knotens (inklusive ihm selbst). */
export function subtree(nodes: GoalNode[], id: string): GoalNode[] {
  const root = nodes.find((n) => n.id === id)
  if (!root) return []
  const out = [root]
  for (const k of nodes.filter((n) => n.parentId === id)) out.push(...subtree(nodes, k.id))
  return out
}

// ---------- Geld-Ziele rückwärts rechnen ----------

/** "10K im Monat" → 10000, "5.000 € Umsatz" → 5000 */
export function parseMoney(text: string): number | undefined {
  const t = text.toLowerCase()
  const k = /(\d+(?:[.,]\d+)?)\s*k\b/.exec(t)
  if (k) return Math.round(parseFloat(k[1].replace(',', '.')) * 1000)
  const m = /(\d{1,3}(?:\.\d{3})+|\d{3,})\s*(?:€|euro|eur)/.exec(t)
  if (m) return Number(m[1].replace(/\./g, ''))
  if (/umsatz|verdien|einnahm/.test(t)) {
    const n = /(\d{1,3}(?:\.\d{3})+|\d{3,})/.exec(t)
    if (n) return Number(n[1].replace(/\./g, ''))
  }
  return undefined
}

export interface MoneyInput {
  target: number
  price: number
  have: number
  /** 1 von wie vielen Gesprächen wird Kunde */
  talksPerCustomer: number
  /** wie viele Kontakte für ein Gespräch */
  contactsPerTalk: number
  weeks: number
}

export function moneyPlan(i: MoneyInput) {
  const customers = Math.max(1, Math.ceil(i.target / Math.max(1, i.price)))
  const missing = Math.max(0, customers - i.have)
  const talks = missing * i.talksPerCustomer
  const contacts = talks * i.contactsPerTalk
  const perWeek = Math.ceil(contacts / Math.max(1, i.weeks))
  return { customers, missing, talks, contacts, perWeek }
}

export interface NodeDraft {
  title: string
  minutes?: number
  children?: NodeDraft[]
}

const eur = (n: number) => n.toLocaleString('de-DE') + ' €'

/** Macht aus der Rechnung eine fertige Quest-Kette. */
export function moneyDrafts(i: MoneyInput): NodeDraft[] {
  const p = moneyPlan(i)
  if (p.missing === 0) return [{ title: `${p.customers} Kunden à ${eur(i.price)} halten und Ergebnis sichern` }]
  const firstBatch = Math.min(p.perWeek, 10)
  return [
    {
      title: `Angebot für ${eur(i.price)} im Monat klar formulieren`,
      children: [
        { title: 'In 3 Sätzen aufschreiben: Für wen, welches Ergebnis, welcher Preis', minutes: 25 },
        { title: 'Angebot als eine Seite (PDF oder Notiz) fertig machen', minutes: 45 },
      ],
    },
    {
      title: `${p.contacts} Wunschkunden anschreiben (${p.perWeek} pro Woche)`,
      children: [
        { title: `Liste mit den ersten ${Math.min(p.contacts, 20)} Wunschkunden erstellen`, minutes: 45 },
        { title: 'Nachrichtenvorlage schreiben (kurz, persönlich, eine Frage am Ende)', minutes: 25 },
        { title: `Die ersten ${firstBatch} Leute anschreiben`, minutes: 25 },
        { title: `Festen Akquise-Block pro Woche einplanen (${p.perWeek} Kontakte)`, minutes: 10 },
      ],
    },
    {
      title: `${p.talks} Erstgespräche führen`,
      children: [
        { title: 'Gesprächsleitfaden mit 5 Fragen schreiben', minutes: 25 },
        { title: 'Erstes Gespräch terminieren', minutes: 10 },
      ],
    },
    { title: `${p.missing} Kunden abschließen (à ${eur(i.price)})` },
  ]
}
