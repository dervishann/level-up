import type { AppData, Task } from './types'
import { addDays, dateKey, uid } from './date'
import { DEFAULT_DAILIES, emptyDay, freshData } from './store'
import { suggestSteps } from './suggest'

// Beispieldaten für den Demo-Modus: alles sofort ausprobierbar.
export function demoData(): AppData {
  const today = dateKey()
  const d = freshData()
  const t = (p: Partial<Task> & Pick<Task, 'title' | 'zone' | 'minutes'>): Task => ({
    id: uid(),
    difficulty: 2,
    dread: 1,
    kind: 'deep',
    priority: 2,
    status: 'open',
    date: today,
    steps: suggestSteps(p.title),
    stepsDone: 0,
    actualMinutes: 0,
    createdAt: Date.now(),
    ...p,
  })
  const wd = new Date().getDay()

  d.profile = {
    name: 'Demo-Held',
    wake: '06:30',
    sleep: '22:30',
    trainings: [
      { id: 'g1', type: 'gym', weekday: wd, time: '17:00', minutes: 75 },
      { id: 'g2', type: 'gym', weekday: (wd + 2) % 7, time: '17:00', minutes: 75 },
      { id: 'r1', type: 'ringen', weekday: (wd + 1) % 7, time: '19:00', minutes: 90 },
    ],
    postGoal: 3,
    clients: [],
    onboarded: true,
    startDate: addDays(today, -6),
  }
  d.char = { xp: 430, coins: 43, stats: { fokus: 90, staerke: 110, business: 80, reichweite: 60, disziplin: 70, klarheit: 60 }, streak: 4, bestStreak: 4, comebackPending: false }
  d.tasks = [
    t({ title: 'Steuerbelege Oktober sortieren', zone: 4, minutes: 45, dread: 3, priority: 3, isMain: true }),
    t({ title: 'Skript für Reel „3 Fehler am Anfang“ schreiben', zone: 3, minutes: 45, priority: 3, isMain: true }),
    t({ title: 'Angebot für Café Mila fertig machen', zone: 5, minutes: 60, dread: 2, priority: 3, isMain: true }),
    t({ title: 'Rechnung an Studio Nord schicken', zone: 4, minutes: 15, kind: 'light', dread: 2 }),
    t({ title: 'Mail an Steuerberater beantworten', zone: 4, minutes: 10, kind: 'light', priority: 1 }),
    t({ title: 'Profil-Bio auf Instagram überarbeiten', zone: 6, minutes: 25, kind: 'light', priority: 1 }),
    t({ title: 'Zwei Reels schneiden', zone: 3, minutes: 90, date: addDays(today, 1) }),
    t({ title: 'Website-Startseite neu texten', zone: 3, minutes: 120, date: undefined, priority: 1 }),
  ]
  d.inbox = [
    { id: uid(), text: 'Idee: Hook „Niemand sagt dir das über Selbstständigkeit“', createdAt: Date.now() },
    { id: uid(), text: 'Zahnarzt Termin machen', createdAt: Date.now() },
    { id: uid(), text: 'Akquise: 3 Fitnessstudios anschreiben', createdAt: Date.now() },
  ]
  d.ideas = [{ id: uid(), text: 'Serie: Ein Tag als Selbstständiger, ungeschönt', zone: 3, createdAt: Date.now() }]
  d.dailies = [...DEFAULT_DAILIES, { id: 'd-phone', title: 'Handy erst nach der Morgenroutine', zone: 8, stat: 'disziplin' }]
  d.rewards = [
    { id: uid(), title: 'Folge Serie schauen', cost: 15 },
    { id: uid(), title: 'Gaming-Abend', cost: 60 },
    { id: uid(), title: 'Cheat Meal', cost: 80 },
  ]
  d.zonesDone = [1]
  d.cards = [
    { id: uid(), zone: 1, questionId: 'v1', text: 'Ich habe einen festen Tagesrhythmus' },
    { id: uid(), zone: 1, questionId: 'v1', text: 'Meine Personal Brand bringt mir Anfragen' },
    { id: uid(), zone: 1, questionId: 'v2', text: '10 zahlende Kunden gleichzeitig' },
    { id: uid(), zone: 1, questionId: 'v2', text: '10.000 Follower' },
    { id: uid(), zone: 1, questionId: 'v3', text: 'Ortsunabhängig und frei in meiner Zeit' },
    { id: uid(), zone: 1, questionId: 'v4', text: 'Kunden aktiv ansprechen' },
    { id: uid(), zone: 1, questionId: 'v5', text: 'Handy und Social Media' },
    { id: uid(), zone: 1, questionId: 'v6', text: 'Einen Podcast starten' },
  ]
  const day = 86400000
  d.content = [
    { id: uid(), title: 'Niemand sagt dir das über Selbstständigkeit', stage: 0, active: false, createdAt: Date.now() },
    { id: uid(), title: '3 Fehler am Anfang', stage: 1, active: true, createdAt: Date.now() },
    { id: uid(), title: 'Mein Morgen als Selbstständiger', stage: 1, active: true, createdAt: Date.now() },
    { id: uid(), title: 'Gewerbe anmelden in 60 Sekunden', stage: 4, active: false, createdAt: Date.now() - 3 * day, postedAt: Date.now() },
  ]
  d.clientCards = [
    { id: uid(), name: 'Fitnessstudio Kraftwerk', stage: 0, amount: 1200, createdAt: Date.now() },
    { id: uid(), name: 'Café Mila', stage: 1, amount: 800, createdAt: Date.now() },
    { id: uid(), name: 'Studio Nord', stage: 3, amount: 1500, invoiceDate: addDays(today, -20), createdAt: Date.now() - 30 * day },
  ]
  d.settings.shootDay = (wd + 2) % 7
  d.nodes = []
  d.goals = [
    { id: uid(), zone: 1, title: '10 zahlende Kunden gleichzeitig' },
    { id: uid(), zone: 1, title: '10.000 Follower' },
  ]
  for (let i = 1; i <= 4; i++) d.days[addDays(today, -i)] = { ...emptyDay(), counted: true, xp: 80 + i * 10, mainsDone: 2, shutdownDone: true, checkinDone: true }
  d.lastDate = addDays(today, -1) // löst beim Start den Tageswechsel aus → Plan wird gebaut
  return d
}
