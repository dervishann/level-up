import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { AppData, ClientCard, ContentCard, DayLog, Daily, GoalNode, Level3, Recurring, Reward, StatKey, Task, Training, ZoneId } from './types'
import { addDays, dateKey, nowMin, toMin, uid, weekdayOf } from './date'
import { buildDayPlan } from './planner'
import { coinsFor, FREEZE_COST, levelInfo, taskXp, XP, ZONE_STAT } from './xp'
import { activeCount, clientStep, contentStep, invoiceStep, isOverdue, LAST_STAGE, nextWeekday, reminderStep, taxStep, weekStart, type StepSpec } from './pipelines'
import { suggestKind, suggestSteps, suggestZone } from './suggest'
import { ZONE_ORDER, zone as zoneInfo } from './zones'
import { childrenOf, nextActionable, propagateDone, subtree, type NodeDraft } from './goals'

export const emptyDay = (): DayLog => ({ dailiesDone: [], blocksDone: [], xp: 0, mainsDone: 0 })

export const DEFAULT_DAILIES: Daily[] = [
  { id: 'd-wake', title: 'Pünktlich aufgestanden', zone: 8, stat: 'disziplin' },
  { id: 'd-protein', title: 'Protein-Ziel erreicht', zone: 7, stat: 'staerke' },
  { id: 'd-water', title: 'Genug Wasser getrunken', zone: 7, stat: 'staerke' },
]

export const DEFAULT_RECURRING: Recurring[] = [
  { id: 'r-akquise', title: 'Akquise-Block: Wunschkunden anschreiben', zone: 5, minutes: 45, kind: 'deep', dread: 3, weekday: 1, active: true },
  { id: 'r-rechnungen', title: 'Rechnungen schreiben und offene prüfen', zone: 4, minutes: 25, kind: 'light', dread: 2, weekday: 5, active: true },
  { id: 'r-belege', title: 'Belege und Buchhaltung der Woche', zone: 4, minutes: 25, kind: 'light', dread: 3, weekday: 5, active: true },
]

export const freshData = (): AppData => ({
  version: 1,
  profile: { name: '', wake: '06:30', sleep: '22:30', trainings: [], postGoal: 3, clients: [], onboarded: false, startDate: dateKey() },
  char: { xp: 0, coins: 0, stats: { fokus: 0, staerke: 0, business: 0, reichweite: 0, disziplin: 0, klarheit: 0 }, streak: 0, bestStreak: 0, comebackPending: false },
  tasks: [],
  inbox: [],
  ideas: [],
  dailies: DEFAULT_DAILIES,
  rewards: [],
  cards: [],
  goals: [],
  nodes: [],
  content: [],
  clientCards: [],
  recurring: DEFAULT_RECURRING,
  taxDates: [],
  purchases: [],
  freezes: 0,
  zonesDone: [],
  plans: {},
  days: {},
  settings: { theme: 'dark', focusMinutes: 25, wipLimit: 3, taxRate: 30 },
  lastDate: dateKey(),
})

/** Bringt ältere gespeicherte Daten oder Backups auf den aktuellen Stand (neue Felder bekommen Standardwerte). */
export function upgrade(saved?: Partial<AppData>): AppData {
  const fresh = freshData()
  if (!saved) return fresh
  return { ...fresh, ...saved, settings: { ...fresh.settings, ...saved.settings }, profile: { ...fresh.profile, ...saved.profile }, char: { ...fresh.char, ...saved.char } }
}

/** Kurze Rückmeldung für Animationen (wird nicht gespeichert). */
export interface Fx {
  id: number
  xp: number
  label: string
  levelUp?: number
  title?: string
  /** Loot-Truhe: zufälliger Bonus nach einer Quest */
  loot?: { coins: number; xp: number }
}

export interface NewTask {
  title: string
  zone: ZoneId
  minutes: number
  kind: 'deep' | 'light'
  priority: Level3
  dread: Level3
  difficulty?: Level3
  date?: string
  deadline?: string
  isMain?: boolean
}

interface Store {
  data: AppData
  fx: Fx | null
  clearFx: () => void

  finishOnboarding: (p: { name: string; wake: string; sleep: string; trainings: Training[]; postGoal: number; clients: string[]; rewards: Reward[] }) => void
  ensureToday: () => void
  replan: () => number
  addInbox: (text: string) => void
  removeInbox: (id: string) => void
  inboxToTask: (id: string, t: NewTask) => void
  inboxToIdea: (id: string, zone: ZoneId) => void
  addTask: (t: NewTask) => string
  startTask: (id: string) => void
  addWork: (id: string, minutes: number, sessionDone?: boolean) => void
  stepDone: (id: string) => void
  completeTask: (id: string) => void
  laterTask: (id: string, reason: string) => void
  deleteTask: (id: string) => void
  doneBlock: (blockId: string, note?: string) => void
  toggleDaily: (id: string) => void
  checkin: (energy: number, sleep: number, minimal: boolean) => void
  finishShutdown: (mainIds: string[], reflection: string) => void
  answerQuestion: (zone: ZoneId, questionId: string, texts: string[]) => void
  finishZone: (zone: ZoneId, accepted: { goals: string[]; tasks: string[]; dailies: string[] }) => void
  editCard: (id: string, text: string) => void
  deleteCard: (id: string) => void
  addCard: (zone: ZoneId, text: string) => void
  addGoal: (title: string, zone?: ZoneId) => string
  deleteGoal: (id: string) => void
  inboxToGoal: (id: string) => string
  addNodes: (goalId: string, parentId: string | undefined, drafts: NodeDraft[]) => void
  setNodeReady: (nodeId: string, minutes: number) => void
  researchNode: (nodeId: string) => void
  deleteNode: (nodeId: string) => void
  finishBreakdown: (goalId: string) => void
  addContent: (title: string) => void
  ideaToContent: (ideaId: string) => void
  startContent: (id: string) => boolean
  moveContent: (id: string, dir: 1 | -1) => void
  deleteContent: (id: string) => void
  addClient: (name: string, amount?: number) => void
  moveClient: (id: string, dir: 1 | -1) => void
  setClientAmount: (id: string, amount: number) => void
  clientInvoice: (id: string) => void
  deleteClient: (id: string) => void
  setBusiness: (p: Partial<Pick<AppData['settings'], 'wipLimit' | 'taxRate' | 'shootDay' | 'focusMinutes'>>) => void
  updateRecurring: (id: string, p: Partial<Pick<Recurring, 'active' | 'weekday'>>) => void
  addTaxDate: (title: string, date: string) => void
  deleteTaxDate: (id: string) => void
  buyReward: (id: string) => boolean
  addReward: (title: string, cost: number) => void
  deleteReward: (id: string) => void
  buyFreeze: () => boolean
  phoneAway: () => void
  setTheme: (t: 'dark' | 'light') => void
  updateProfile: (p: Partial<AppData['profile']>) => void
  markBackup: () => void
  importData: (d: AppData) => void
  reset: () => void
}

// ---------- Hilfsfunktionen (arbeiten auf einer Kopie der Daten) ----------

const clone = <T,>(x: T): T => JSON.parse(JSON.stringify(x))

const day = (d: AppData, key: string): DayLog => (d.days[key] ??= emptyDay())

function buildPlan(d: AppData, date: string, fromNow: boolean) {
  const wd = weekdayOf(date)
  const log = d.days[date]
  d.plans[date] = buildDayPlan({
    date,
    wake: toMin(d.profile.wake),
    sleep: toMin(d.profile.sleep),
    trainings: d.profile.trainings.filter((t) => t.weekday === wd).map((t) => ({ id: t.id, type: t.type, start: toMin(t.time), minutes: t.minutes })),
    tasks: d.tasks.filter((t) => t.status === 'open' && t.date !== undefined && t.date <= date),
    minimal: log?.minimal,
    mainsDone: log?.mainsDone,
    fromMin: fromNow ? nowMin() : undefined,
    doneBlockIds: log?.blocksDone,
    builtAt: Date.now(),
  })
  return d.plans[date]
}

/** Heute neu planen: ab jetzt, falls der Tag schon läuft. */
const rebuildToday = (d: AppData) => {
  const today = dateKey()
  return buildPlan(d, today, nowMin() > toMin(d.profile.wake))
}

function markCounted(d: AppData, key: string) {
  const log = day(d, key)
  if (log.counted) return
  log.counted = true
  d.char.streak += 1
  d.char.bestStreak = Math.max(d.char.bestStreak, d.char.streak)
}

function makeTask(t: NewTask): Task {
  return {
    id: uid(),
    title: t.title.trim(),
    zone: t.zone,
    minutes: t.minutes,
    difficulty: t.difficulty ?? (t.minutes >= 60 ? 3 : t.minutes >= 25 ? 2 : 1),
    dread: t.dread,
    kind: t.kind,
    priority: t.priority,
    deadline: t.deadline,
    status: 'open',
    date: t.date,
    isMain: t.isMain,
    steps: suggestSteps(t.title),
    stepsDone: 0,
    actualMinutes: 0,
    createdAt: Date.now(),
  }
}

/** Legt für die nächsten klaren Schritte jeder Quest-Kette Aufgaben an (max. 2 aktive pro Ziel). */
function syncGoals(d: AppData): number {
  let created = 0
  const today = dateKey()
  for (const g of d.goals) {
    for (const node of nextActionable(d.nodes, g.id)) {
      const zone = g.zone <= 2 ? suggestZone(node.title) : g.zone
      const minutes = node.minutes ?? 25
      const t = makeTask({ title: node.title, zone, minutes, kind: suggestKind(node.title, minutes), priority: 3, dread: 2, date: today })
      t.goalNodeId = node.id
      d.tasks.push(t)
      node.taskId = t.id
      created++
    }
  }
  return created
}

function insertDrafts(d: AppData, goalId: string, parentId: string | undefined, drafts: NodeDraft[]) {
  let order = childrenOf(d.nodes, goalId, parentId).length
  for (const dr of drafts) {
    const title = dr.title.trim()
    if (!title) continue
    const node: GoalNode = { id: uid(), goalId, parentId, title, order: order++, minutes: dr.children?.length ? undefined : dr.minutes, done: false }
    d.nodes.push(node)
    if (dr.children?.length) insertDrafts(d, goalId, node.id, dr.children)
  }
}

// ---------- Pipelines: Karte ↔ Quest ----------

type Gain = { xp: number; label: string; stat?: StatKey; lootChance?: number }

function taskFromStep(spec: StepSpec, date: string, card?: Task['card'], priority: Level3 = 2): Task {
  const t = makeTask({ title: spec.title, zone: spec.zone, minutes: spec.minutes, kind: spec.kind, priority, dread: spec.dread, date })
  t.card = card
  return t
}

const dropCardTasks = (d: AppData, type: 'content' | 'client', id: string) => {
  d.tasks = d.tasks.filter((t) => !(t.status === 'open' && t.card?.type === type && t.card.id === id))
}

/** Sorgt dafür, dass genau die passende Quest zur Karte existiert. */
function syncContentCard(d: AppData, c: ContentCard) {
  dropCardTasks(d, 'content', c.id)
  if (!c.active || c.stage >= LAST_STAGE) return
  const spec = contentStep(c)
  if (!spec) return
  const today = dateKey()
  const date = spec.shoot && d.settings.shootDay !== undefined ? nextWeekday(today, d.settings.shootDay) : today
  d.tasks.push(taskFromStep(spec, date, { type: 'content', id: c.id, advance: spec.advance }))
}

function syncClientCard(d: AppData, c: ClientCard) {
  dropCardTasks(d, 'client', c.id)
  const spec = clientStep(c)
  if (!spec) return
  d.tasks.push(taskFromStep(spec, addDays(dateKey(), spec.delayDays ?? 0), { type: 'client', id: c.id, advance: spec.advance }))
}

function setContentStage(d: AppData, c: ContentCard, stage: number) {
  c.stage = Math.max(0, Math.min(LAST_STAGE, stage))
  if (c.stage >= 1) c.active = true
  if (c.stage === LAST_STAGE) {
    c.postedAt ??= Date.now()
    c.active = false
  } else c.postedAt = undefined
  syncContentCard(d, c)
}

function setClientStage(d: AppData, c: ClientCard, stage: number) {
  const prev = c.stage
  c.stage = Math.max(0, Math.min(LAST_STAGE, stage))
  if (c.stage >= 3) c.invoiceDate ??= dateKey()
  else {
    c.invoiceDate = undefined
    c.remindedOn = undefined
  }
  if (c.stage === LAST_STAGE && prev !== LAST_STAGE) {
    c.paidAt = Date.now()
    // Bezahlt → direkt die Steuer-Rücklage als kleine Quest
    if (c.amount) d.tasks.push(taskFromStep(taxStep(c.name, c.amount, d.settings.taxRate), dateKey()))
  }
  if (c.stage < LAST_STAGE) c.paidAt = undefined
  syncClientCard(d, c)
}

/** Läuft einmal pro Tag: wiederkehrende Quests, überfällige Rechnungen, Steuer-Termine. */
function dailyBusiness(d: AppData, today: string) {
  const wd = weekdayOf(today)
  for (const r of d.recurring) {
    if (!r.active || r.weekday !== wd || r.lastCreated === today) continue
    if (d.tasks.some((t) => t.status === 'open' && t.recurringId === r.id)) continue
    const t = makeTask({ title: r.title, zone: r.zone, minutes: r.minutes, kind: r.kind, priority: 2, dread: r.dread, date: today })
    t.recurringId = r.id
    d.tasks.push(t)
    r.lastCreated = today
  }
  // Selbstheilung: aktive Karten ohne offene Quest bekommen ihren nächsten Schritt zurück
  const hasTask = (type: 'content' | 'client', id: string) => d.tasks.some((t) => t.status === 'open' && t.card?.type === type && t.card.id === id)
  for (const c of d.content) if (c.active && c.stage < LAST_STAGE && !hasTask('content', c.id)) syncContentCard(d, c)
  for (const c of d.clientCards) if (c.stage === 0 && !hasTask('client', c.id)) syncClientCard(d, c)
  for (const c of d.clientCards) {
    if (!isOverdue(c, today)) continue
    if (c.remindedOn && addDays(c.remindedOn, 7) > today) continue // höchstens einmal pro Woche
    if (d.tasks.some((t) => t.status === 'open' && t.card?.type === 'client' && t.card.id === c.id)) continue
    d.tasks.push(taskFromStep(reminderStep(c.name), today, { type: 'client', id: c.id, advance: false }, 3))
    c.remindedOn = today
  }
  for (const td of d.taxDates) {
    if (td.questCreated || td.date < today || addDays(today, 7) < td.date) continue
    const t = makeTask({ title: `Steuer-Termin vorbereiten: ${td.title}`, zone: 4, minutes: 45, kind: 'deep', priority: 3, dread: 3, date: today, deadline: td.date })
    d.tasks.push(t)
    td.questCreated = true
  }
}

/** Schließt eine Aufgabe ab und liefert die XP dafür. */
function finishTask(d: AppData, t: Task): Gain {
  const today = dateKey()
  const log = day(d, today)
  const blocks = (d.plans[today]?.blocks ?? []).filter((b) => b.taskId === t.id)
  const isMain = blocks.some((b) => b.main) || !!t.isMain
  const isFrog = blocks.some((b) => b.frog)
  const comeback = d.char.comebackPending
  const xp = taskXp(t, { main: isMain, frog: isFrog, streak: d.char.streak, comeback })
  t.status = 'done'
  t.doneAt = Date.now()
  t.stepsDone = t.steps.length
  for (const b of blocks) if (!log.blocksDone.includes(b.id)) log.blocksDone.push(b.id)
  if (isMain) {
    log.mainsDone += 1
    markCounted(d, today)
  }
  if (comeback) d.char.comebackPending = false
  let label = comeback ? 'Comeback geschafft!' : isFrog ? 'Frosch gegessen!' : isMain ? 'Main Quest erledigt!' : 'Quest erledigt!'
  let bonus = 0
  // Schritt einer Quest-Kette: abhaken und den nächsten freischalten.
  const node = t.goalNodeId ? d.nodes.find((n) => n.id === t.goalNodeId) : undefined
  if (node) {
    node.done = true
    const goalDone = propagateDone(d.nodes, node.goalId)
    const unlocked = syncGoals(d)
    if (goalDone) {
      bonus = XP.goalDone
      label = 'Ziel erreicht!'
    } else if (unlocked) label = 'Nächster Schritt freigeschaltet!'
    if (unlocked) rebuildToday(d)
  }
  // Pipeline-Karte rückt eine Spalte weiter und bekommt ihre nächste Quest.
  if (t.card?.advance) {
    if (t.card.type === 'content') {
      const c = d.content.find((x) => x.id === t.card!.id)
      if (c) {
        setContentStage(d, c, c.stage + 1)
        if (c.stage === LAST_STAGE) label = 'Gepostet!'
      }
    } else {
      const c = d.clientCards.find((x) => x.id === t.card!.id)
      if (c) setClientStage(d, c, c.stage + 1)
    }
    rebuildToday(d)
  }
  return {
    xp: xp.total + bonus,
    label,
    stat: t.kind === 'deep' && t.zone !== 7 ? (isMain ? ZONE_STAT[t.zone] : 'fokus') : ZONE_STAT[t.zone],
    lootChance: isFrog ? 0.4 : isMain ? 0.25 : 0.12,
  }
}

const zoneQuestPrefix = (id: ZoneId) => `Zone ${id} erkunden`

/** Die nächste Zone, die noch im Nebel liegt (in der Reihenfolge ZONE_ORDER). */
export const nextZone = (zonesDone: ZoneId[]): ZoneId | undefined => ZONE_ORDER.find((z) => !zonesDone.includes(z))

/** Eine Zone ist betretbar, wenn sie erkundet ist oder ihre Quest schon freigeschaltet wurde. */
export const zoneUnlocked = (d: AppData, id: ZoneId): boolean =>
  id === 1 || d.zonesDone.includes(id) || d.tasks.some((t) => t.title.startsWith(zoneQuestPrefix(id)))

/** Legt die Quest für die nächste Zone an, falls es noch keine offene Zonen-Quest gibt (max. 1 neue Zone pro Tag). */
function ensureZoneQuest(d: AppData, date: string) {
  const next = nextZone(d.zonesDone)
  if (!next || !d.zonesDone.includes(1)) return
  if (d.tasks.some((t) => t.status === 'open' && /^Zone \d erkunden/.test(t.title))) return
  const q = makeTask({ title: `${zoneQuestPrefix(next)}: ${zoneInfo(next).short}-Interview`, zone: next, minutes: 10, kind: 'deep', priority: 3, dread: 1, date })
  q.steps = ['Auf „Interview starten“ tippen', 'Fragen beantworten (Antippen reicht)', 'Vorschläge am Ende bestätigen']
  d.tasks.push(q)
}

let fxCounter = 0

export const useStore = create<Store>()(
  persist(
    (set, get) => {
      /** Daten ändern + optional XP vergeben. */
      const mutate = (fn: (d: AppData) => Gain | void) => {
        const d = clone(get().data)
        const before = levelInfo(d.char.xp)
        const gain = fn(d)
        let fx: Fx | null = null
        if (gain && gain.xp > 0) {
          d.char.xp += gain.xp
          d.char.coins += coinsFor(gain.xp)
          if (gain.stat) d.char.stats[gain.stat] += gain.xp
          day(d, dateKey()).xp += gain.xp
          fx = { id: ++fxCounter, xp: gain.xp, label: gain.label }
          // Loot-Drop: zufällige Truhe mit Bonus-Coins oder XP-Schub
          if (gain.lootChance && Math.random() < gain.lootChance) {
            const loot = Math.random() < 0.7 ? { coins: 5 + Math.floor(Math.random() * 11), xp: 0 } : { coins: 0, xp: 25 }
            d.char.coins += loot.coins
            d.char.xp += loot.xp
            day(d, dateKey()).xp += loot.xp
            fx.loot = loot
          }
          const after = levelInfo(d.char.xp)
          if (after.level > before.level) {
            fx.levelUp = after.level
            fx.title = after.title
          }
        }
        set(fx ? { data: d, fx } : { data: d })
      }

      return {
        data: freshData(),
        fx: null,
        clearFx: () => set({ fx: null }),

        finishOnboarding: (p) =>
          mutate((d) => {
            const today = dateKey()
            d.profile = { ...d.profile, ...p, name: p.name.trim() || 'Held', onboarded: true, startDate: today }
            d.rewards = p.rewards
            d.lastDate = today
            if (!d.tasks.length) {
              d.tasks.push(
                makeTask({ title: 'Zone 1 erkunden: Vision-Interview', zone: 1, minutes: 10, kind: 'deep', priority: 3, dread: 1, date: today, isMain: true }),
                makeTask({ title: 'Kopf leeren: alles in die Inbox kippen', zone: 8, minutes: 10, kind: 'light', priority: 2, dread: 1, date: today }),
              )
              d.tasks[0].steps = ['Unten auf „Karte“ tippen', 'Zone 1 antippen', 'Fragen beantworten (Antippen reicht)']
              d.tasks[1].steps = ['Unten rechts auf das Plus tippen', 'Alles aufschreiben, was im Kopf ist', 'Beim Shutdown heute Abend sortieren']
            }
            rebuildToday(d)
          }),

        // Tageswechsel: Streak prüfen, Unerledigtes mitnehmen, Plan bauen.
        ensureToday: () => {
          const cur = get().data
          const today = dateKey()
          if (!cur.profile.onboarded) return
          if (cur.lastDate === today && cur.plans[today] && !cur.profile.clients.length) return
          mutate((d) => {
            // Kunden aus dem Onboarding einmalig in die Pipeline übernehmen
            if (d.profile.clients.length) {
              for (const name of d.profile.clients) d.clientCards.push({ id: uid(), name, stage: 2, createdAt: Date.now() })
              d.profile.clients = []
            }
            if (d.lastDate !== today) {
              const yesterday = addDays(today, -1)
              // Streak-Freeze rettet genau einen verpassten Tag
              const onlyYesterdayMissed = !d.days[yesterday]?.counted && (d.days[addDays(today, -2)]?.counted || d.lastDate === yesterday)
              if (onlyYesterdayMissed && d.freezes > 0 && d.char.streak > 0) {
                d.freezes -= 1
                d.days[yesterday] = { ...(d.days[yesterday] ?? emptyDay()), counted: true, frozen: true }
              }
              if (!d.days[yesterday]?.counted && d.profile.startDate < today) {
                if (d.char.streak > 0 || d.days[d.lastDate]) d.char.comebackPending = true
                d.char.streak = 0
              }
              for (const t of d.tasks) {
                if (t.status === 'open' && t.date && t.date < today) {
                  t.date = today
                  t.isMain = false
                }
              }
              // alte Pläne aufräumen (30 Tage reichen)
              const cutoff = addDays(today, -30)
              for (const k of Object.keys(d.plans)) if (k < cutoff) delete d.plans[k]
              ensureZoneQuest(d, today)
              dailyBusiness(d, today)
              d.lastDate = today
            }
            day(d, today)
            rebuildToday(d)
          })
        },

        replan: () => {
          let moved = 0
          mutate((d) => {
            const today = dateKey()
            const plan = buildPlan(d, today, true)
            const tomorrow = addDays(today, 1)
            for (const id of plan.deferred) {
              const t = d.tasks.find((x) => x.id === id)
              if (t) {
                t.date = tomorrow
                t.isMain = false
                moved++
              }
            }
            plan.deferred = []
          })
          return moved
        },

        addInbox: (text) =>
          mutate((d) => {
            const lines = text.split('\n').map((l) => l.trim()).filter(Boolean)
            for (const l of lines) d.inbox.push({ id: uid(), text: l, createdAt: Date.now() })
          }),

        removeInbox: (id) => mutate((d) => void (d.inbox = d.inbox.filter((i) => i.id !== id))),

        inboxToTask: (id, t) =>
          mutate((d) => {
            d.inbox = d.inbox.filter((i) => i.id !== id)
            d.tasks.push(makeTask(t))
            if (t.date === dateKey()) rebuildToday(d)
            return { xp: XP.inboxSorted, label: 'Einsortiert', stat: 'klarheit' }
          }),

        inboxToIdea: (id, zone) =>
          mutate((d) => {
            const item = d.inbox.find((i) => i.id === id)
            d.inbox = d.inbox.filter((i) => i.id !== id)
            if (item) d.ideas.push({ id: uid(), text: item.text, zone, createdAt: Date.now() })
            return { xp: XP.inboxSorted, label: 'In die Ideen-Truhe', stat: 'klarheit' }
          }),

        addTask: (t) => {
          const task = makeTask(t)
          mutate((d) => {
            d.tasks.push(task)
            if (t.date === dateKey()) rebuildToday(d)
          })
          return task.id
        },

        startTask: (id) =>
          mutate((d) => {
            const t = d.tasks.find((x) => x.id === id)
            if (!t) return
            t.startedAt ??= Date.now()
            if (t.startXpGiven) return
            t.startXpGiven = true
            return { xp: XP.start, label: 'Angefangen!', stat: 'disziplin' }
          }),

        addWork: (id, minutes, sessionDone) =>
          mutate((d) => {
            const t = d.tasks.find((x) => x.id === id)
            if (t) t.actualMinutes += minutes
            const log = day(d, dateKey())
            log.focusMin = (log.focusMin ?? 0) + minutes
            // Eine volle Fokus-Session (mind. 15 Min) gibt Extra-XP
            if (sessionDone && minutes >= 15) return { xp: XP.focusSession, label: 'Fokus-Session geschafft', stat: 'fokus' }
          }),

        stepDone: (id) =>
          mutate((d) => {
            const t = d.tasks.find((x) => x.id === id)
            if (t && t.stepsDone < t.steps.length) t.stepsDone += 1
          }),

        completeTask: (id) =>
          mutate((d) => {
            const t = d.tasks.find((x) => x.id === id)
            if (!t || t.status === 'done') return
            return finishTask(d, t)
          }),

        laterTask: (id, reason) =>
          mutate((d) => {
            const t = d.tasks.find((x) => x.id === id)
            if (!t) return
            t.laterReason = reason
            t.date = addDays(dateKey(), 1)
            t.isMain = false
            rebuildToday(d)
          }),

        deleteTask: (id) =>
          mutate((d) => {
            const gone = d.tasks.find((t) => t.id === id)
            if (gone?.goalNodeId) d.nodes = d.nodes.filter((n) => n.id !== gone.goalNodeId)
            d.tasks = d.tasks.filter((t) => t.id !== id)
            syncGoals(d)
            rebuildToday(d)
          }),

        doneBlock: (blockId, note) =>
          mutate((d) => {
            const today = dateKey()
            const log = day(d, today)
            if (log.blocksDone.includes(blockId)) return
            log.blocksDone.push(blockId)
            const b = d.plans[today]?.blocks.find((x) => x.id === blockId)
            if (b?.type === 'training') {
              if (note) log.trainingNote = note
              return { xp: XP.training, label: 'Training erledigt!', stat: 'staerke' }
            }
            if (b?.type === 'meal') return { xp: XP.block, label: 'Gegessen', stat: 'staerke' }
            return { xp: XP.block, label: 'Erledigt', stat: 'disziplin' }
          }),

        toggleDaily: (id) =>
          mutate((d) => {
            const log = day(d, dateKey())
            if (log.dailiesDone.includes(id)) {
              log.dailiesDone = log.dailiesDone.filter((x) => x !== id)
              return
            }
            log.dailiesDone.push(id)
            const daily = d.dailies.find((x) => x.id === id)
            return { xp: XP.daily, label: 'Daily Quest', stat: daily?.stat ?? 'disziplin' }
          }),

        checkin: (energy, sleep, minimal) =>
          mutate((d) => {
            const today = dateKey()
            const log = day(d, today)
            const first = !log.checkinDone
            log.energy = energy
            log.sleep = sleep
            log.minimal = minimal
            log.checkinDone = true
            if (!log.blocksDone.includes('routine-morning')) log.blocksDone.push('routine-morning')
            rebuildToday(d)
            if (first) return { xp: XP.checkin, label: 'Check-in', stat: 'klarheit' }
          }),

        finishShutdown: (mainIds, reflection) =>
          mutate((d) => {
            const today = dateKey()
            const tomorrow = addDays(today, 1)
            const log = day(d, today)
            const first = !log.shutdownDone
            log.shutdownDone = true
            log.reflection = reflection
            if (!log.blocksDone.includes('shutdown')) log.blocksDone.push('shutdown')
            for (const t of d.tasks) {
              if (t.status !== 'open') continue
              if (mainIds.includes(t.id)) {
                t.date = tomorrow
                t.isMain = true
              } else if (t.date && t.date <= today) {
                t.date = tomorrow
                t.isMain = false
              } else if (t.date === tomorrow) {
                t.isMain = false
              }
            }
            buildPlan(d, tomorrow, false)
            markCounted(d, today)
            if (first) return { xp: XP.shutdown, label: 'Shutdown. Gute Nacht!', stat: 'disziplin' }
          }),

        answerQuestion: (zone, questionId, texts) =>
          mutate((d) => {
            const had = d.cards.some((c) => c.questionId === questionId)
            d.cards = d.cards.filter((c) => c.questionId !== questionId)
            for (const text of texts) d.cards.push({ id: uid(), zone, questionId, text })
            if (!had && texts.length) return { xp: XP.mapAnswer, label: 'Karte erkundet', stat: 'klarheit' }
          }),

        finishZone: (zone, accepted) =>
          mutate((d) => {
            const today = dateKey()
            const first = !d.zonesDone.includes(zone)
            if (first) d.zonesDone.push(zone)
            accepted.goals.forEach((title, i) => {
              const goalId = uid()
              d.goals.push({ id: goalId, zone, title })
              // Das erste Ziel wird morgen direkt zerlegt (eins nach dem anderen, nicht alle auf einmal).
              if (i === 0) {
                const q = makeTask({ title: `Ziel zerlegen: ${title}`, zone, minutes: 15, kind: 'deep', priority: 3, dread: 1, date: addDays(today, 1) })
                q.breakdownGoalId = goalId
                q.steps = ['Auf „Zerlegen starten“ tippen', 'Fragen beantworten, bis jeder Schritt in eine Sitzung passt', 'Die ersten Schritte landen automatisch im Plan']
                d.tasks.push(q)
              }
            })
            accepted.tasks.forEach((title, i) =>
              d.tasks.push(makeTask({ title, zone, minutes: 25, kind: 'deep', priority: 3, dread: 2, date: addDays(today, i === 0 ? 0 : 1) })),
            )
            for (const title of accepted.dailies) {
              if (!d.dailies.some((x) => x.title === title)) d.dailies.push({ id: uid(), title, zone, stat: ZONE_STAT[zone] })
            }
            // Die Quest "Zone erkunden" gilt damit als erledigt.
            const quest = d.tasks.find((t) => t.status === 'open' && t.zone === zone && t.title.startsWith(`Zone ${zone} erkunden`))
            if (quest) {
              quest.status = 'done'
              quest.doneAt = Date.now()
              const log = day(d, today)
              for (const b of d.plans[today]?.blocks ?? []) if (b.taskId === quest.id && !log.blocksDone.includes(b.id)) log.blocksDone.push(b.id)
              if (quest.isMain) {
                log.mainsDone += 1
                markCounted(d, today)
              }
            }
            // Nächste Zone als Quest für morgen freischalten (max. 1 pro Tag).
            ensureZoneQuest(d, addDays(today, 1))
            rebuildToday(d)
            if (first) return { xp: XP.zoneComplete, label: 'Zone komplett erkundet!', stat: 'klarheit' }
          }),

        editCard: (id, text) =>
          mutate((d) => {
            const c = d.cards.find((x) => x.id === id)
            if (c) c.text = text
          }),
        deleteCard: (id) => mutate((d) => void (d.cards = d.cards.filter((c) => c.id !== id))),
        addCard: (zone, text) => mutate((d) => void d.cards.push({ id: uid(), zone, text })),

        addGoal: (title, zone) => {
          const id = uid()
          mutate((d) => void d.goals.push({ id, zone: zone ?? suggestZone(title), title: title.trim() }))
          return id
        },

        deleteGoal: (id) =>
          mutate((d) => {
            const nodeIds = new Set(d.nodes.filter((n) => n.goalId === id).map((n) => n.id))
            d.tasks = d.tasks.filter((t) => !(t.status === 'open' && ((t.goalNodeId && nodeIds.has(t.goalNodeId)) || t.breakdownGoalId === id)))
            d.nodes = d.nodes.filter((n) => n.goalId !== id)
            d.goals = d.goals.filter((g) => g.id !== id)
            rebuildToday(d)
          }),

        inboxToGoal: (id) => {
          const goalId = uid()
          mutate((d) => {
            const item = d.inbox.find((i) => i.id === id)
            d.inbox = d.inbox.filter((i) => i.id !== id)
            if (item) d.goals.push({ id: goalId, zone: suggestZone(item.text), title: item.text })
          })
          return goalId
        },

        addNodes: (goalId, parentId, drafts) =>
          mutate((d) => {
            // Ein bisher "klarer" Schritt, der doch zerlegt wird, verliert seine Quest.
            const parent = parentId ? d.nodes.find((n) => n.id === parentId) : undefined
            if (parent) {
              if (parent.taskId) d.tasks = d.tasks.filter((t) => !(t.id === parent.taskId && t.status === 'open'))
              parent.taskId = undefined
              parent.minutes = undefined
            }
            insertDrafts(d, goalId, parentId, drafts)
            if (syncGoals(d)) rebuildToday(d)
            return { xp: XP.nodeClear, label: 'Zerlegt', stat: 'klarheit' }
          }),

        setNodeReady: (nodeId, minutes) =>
          mutate((d) => {
            const n = d.nodes.find((x) => x.id === nodeId)
            if (!n) return
            n.minutes = minutes
            if (syncGoals(d)) rebuildToday(d)
            return { xp: XP.nodeClear, label: 'Schritt geklärt', stat: 'klarheit' }
          }),

        researchNode: (nodeId) =>
          mutate((d) => {
            const n = d.nodes.find((x) => x.id === nodeId)
            if (!n) return
            insertDrafts(d, n.goalId, n.id, [{ title: `Herausfinden, wie das geht: ${n.title}`, minutes: 15 }])
            if (syncGoals(d)) rebuildToday(d)
            return { xp: XP.nodeClear, label: 'Recherche-Quest angelegt', stat: 'klarheit' }
          }),

        deleteNode: (nodeId) =>
          mutate((d) => {
            const gone = subtree(d.nodes, nodeId)
            const ids = new Set(gone.map((n) => n.id))
            const goalId = gone[0]?.goalId
            d.tasks = d.tasks.filter((t) => !(t.status === 'open' && t.goalNodeId && ids.has(t.goalNodeId)))
            d.nodes = d.nodes.filter((n) => !ids.has(n.id))
            if (goalId) propagateDone(d.nodes, goalId)
            syncGoals(d)
            rebuildToday(d)
          }),

        finishBreakdown: (goalId) =>
          mutate((d) => {
            const q = d.tasks.find((t) => t.status === 'open' && t.breakdownGoalId === goalId)
            if (!q || !d.nodes.some((n) => n.goalId === goalId)) return
            const gain = finishTask(d, q)
            rebuildToday(d)
            return gain
          }),

        // ---------- Content-Pipeline ----------
        addContent: (title) => mutate((d) => void d.content.push({ id: uid(), title: title.trim(), stage: 0, active: false, createdAt: Date.now() })),

        ideaToContent: (ideaId) =>
          mutate((d) => {
            const idea = d.ideas.find((i) => i.id === ideaId)
            if (!idea) return
            d.ideas = d.ideas.filter((i) => i.id !== ideaId)
            d.content.push({ id: uid(), title: idea.text.replace(/^idee:\s*/i, ''), stage: 0, active: false, createdAt: Date.now() })
          }),

        startContent: (id) => {
          const cur = get().data
          if (activeCount(cur.content) >= cur.settings.wipLimit) return false
          mutate((d) => {
            const c = d.content.find((x) => x.id === id)
            if (!c) return
            c.active = true
            syncContentCard(d, c)
            rebuildToday(d)
          })
          return true
        },

        moveContent: (id, dir) =>
          mutate((d) => {
            const c = d.content.find((x) => x.id === id)
            if (!c) return
            setContentStage(d, c, c.stage + dir)
            if (c.stage === 0) {
              c.active = false
              dropCardTasks(d, 'content', c.id)
            }
            rebuildToday(d)
          }),

        deleteContent: (id) =>
          mutate((d) => {
            dropCardTasks(d, 'content', id)
            d.content = d.content.filter((c) => c.id !== id)
            rebuildToday(d)
          }),

        // ---------- Kunden-Pipeline ----------
        addClient: (name, amount) =>
          mutate((d) => {
            const c: ClientCard = { id: uid(), name: name.trim(), stage: 0, amount, createdAt: Date.now() }
            d.clientCards.push(c)
            syncClientCard(d, c)
            rebuildToday(d)
          }),

        moveClient: (id, dir) =>
          mutate((d) => {
            const c = d.clientCards.find((x) => x.id === id)
            if (!c) return
            setClientStage(d, c, c.stage + dir)
            rebuildToday(d)
          }),

        setClientAmount: (id, amount) =>
          mutate((d) => {
            const c = d.clientCards.find((x) => x.id === id)
            if (c) c.amount = amount || undefined
          }),

        clientInvoice: (id) =>
          mutate((d) => {
            const c = d.clientCards.find((x) => x.id === id)
            if (!c || c.stage !== 2) return
            dropCardTasks(d, 'client', c.id)
            d.tasks.push(taskFromStep(invoiceStep(c.name), dateKey(), { type: 'client', id: c.id, advance: true }, 3))
            rebuildToday(d)
          }),

        deleteClient: (id) =>
          mutate((d) => {
            dropCardTasks(d, 'client', id)
            d.clientCards = d.clientCards.filter((c) => c.id !== id)
            rebuildToday(d)
          }),

        setBusiness: (p) =>
          mutate((d) => {
            const shootChanged = 'shootDay' in p && p.shootDay !== d.settings.shootDay
            d.settings = { ...d.settings, ...p }
            if (shootChanged) {
              for (const c of d.content) if (c.stage === 1 && c.active) syncContentCard(d, c)
              rebuildToday(d)
            }
          }),

        updateRecurring: (id, p) =>
          mutate((d) => {
            const r = d.recurring.find((x) => x.id === id)
            if (r) Object.assign(r, p)
          }),

        addTaxDate: (title, date) =>
          mutate((d) => {
            d.taxDates.push({ id: uid(), title: title.trim(), date })
            dailyBusiness(d, dateKey())
            rebuildToday(d)
          }),
        deleteTaxDate: (id) => mutate((d) => void (d.taxDates = d.taxDates.filter((t) => t.id !== id))),

        // ---------- Reward-Shop ----------
        buyReward: (id) => {
          const cur = get().data
          const r = cur.rewards.find((x) => x.id === id)
          if (!r || cur.char.coins < r.cost) return false
          mutate((d) => {
            d.char.coins -= r.cost
            d.purchases.unshift({ id: uid(), title: r.title, cost: r.cost, at: Date.now() })
            d.purchases = d.purchases.slice(0, 50)
          })
          return true
        },
        addReward: (title, cost) => mutate((d) => void d.rewards.push({ id: uid(), title: title.trim(), cost })),
        deleteReward: (id) => mutate((d) => void (d.rewards = d.rewards.filter((r) => r.id !== id))),

        buyFreeze: () => {
          const cur = get().data
          const week = weekStart(dateKey())
          if (cur.char.coins < FREEZE_COST || cur.freezeWeek === week || cur.freezes >= 1) return false
          mutate((d) => {
            d.char.coins -= FREEZE_COST
            d.freezes += 1
            d.freezeWeek = week
          })
          return true
        },

        phoneAway: () => mutate(() => ({ xp: XP.phoneAway, label: 'Handy ist weg', stat: 'disziplin' })),

        setTheme: (t) => mutate((d) => void (d.settings.theme = t)),
        updateProfile: (p) =>
          mutate((d) => {
            d.profile = { ...d.profile, ...p }
            rebuildToday(d)
          }),
        markBackup: () => mutate((d) => void (d.settings.lastBackupAt = Date.now())),
        importData: (incoming) => set({ data: upgrade(incoming), fx: null }),
        reset: () => set({ data: freshData(), fx: null }),
      }
    },
    {
      name: 'levelup-data',
      version: 1,
      partialize: (s) => ({ data: s.data }),
      // Ältere gespeicherte Daten bekommen neue Felder automatisch dazu.
      merge: (saved, current) => ({ ...current, data: upgrade((saved as { data?: Partial<AppData> })?.data) }),
    },
  ),
)

// ---------- Auswahl-Helfer für die Oberfläche ----------

export const todayLog = (d: AppData): DayLog => d.days[dateKey()] ?? emptyDay()
