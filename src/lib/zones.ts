import type { ZoneId } from './types'

export interface Zone {
  id: ZoneId
  name: string
  short: string
  color: string
  desc: string
}

export const ZONES: Zone[] = [
  { id: 1, name: 'Vision', short: 'Vision', color: '#8b5cf6', desc: 'Wer will ich in 1, 3, 5 Jahren sein?' },
  { id: 2, name: 'Mission & Werte', short: 'Mission', color: '#ec4899', desc: 'Warum mache ich das, wofür stehe ich?' },
  { id: 3, name: 'Angebot & Content', short: 'Angebot', color: '#f97316', desc: 'Was biete ich an, worüber mache ich Content?' },
  { id: 4, name: 'Finanzen', short: 'Finanzen', color: '#22c55e', desc: 'Einnahmen, Ausgaben, Preise, Rücklagen' },
  { id: 5, name: 'Kunden & Sales', short: 'Kunden', color: '#3b82f6', desc: 'Wunschkunde, Akquise, Angebote' },
  { id: 6, name: 'Marketing & Reichweite', short: 'Marketing', color: '#06b6d4', desc: 'Plattformen, Rhythmus, Formate' },
  { id: 7, name: 'Körper', short: 'Körper', color: '#ef4444', desc: 'Training, Ernährung, Schlaf' },
  { id: 8, name: 'Alltag & Rhythmus', short: 'Alltag', color: '#eab308', desc: 'Routinen, Zeitfresser, Umfeld' },
]

export const zone = (id: ZoneId): Zone => ZONES[id - 1]

/** Was die App aus einer Antwort ableitet (du bestätigst nur). */
export type Derive = 'goal' | 'task' | 'daily'

export interface Question {
  id: string
  text: string
  hint?: string
  examples: string[]
  derive?: Derive
}

// Interviews. In Phase 1 sind Zone 1 (Vision) und Zone 8 (Alltag) spielbar,
// die anderen sechs folgen in Phase 1b.
export const INTERVIEWS: Partial<Record<ZoneId, Question[]>> = {
  1: [
    {
      id: 'v1',
      text: 'Stell dir vor, es ist in einem Jahr und es lief richtig gut. Was ist anders als heute?',
      hint: 'Tipp an, was passt, oder schreib es in deinen Worten.',
      examples: ['Ich habe einen festen Tagesrhythmus', 'Ich lebe entspannt von meinen Kunden', 'Meine Personal Brand bringt mir Anfragen', 'Ich bin in der besten Form meines Lebens', 'Ich habe finanzielle Rücklagen'],
    },
    {
      id: 'v2',
      text: 'Woran würdest du in 12 Monaten in Zahlen merken, dass du es geschafft hast?',
      hint: 'Daraus werden später deine Bosse. Ein bis drei reichen.',
      examples: ['10 zahlende Kunden gleichzeitig', '5.000 € Umsatz im Monat', '10.000 Follower', '100 gepostete Videos', '3 Monatsausgaben als Rücklage'],
      derive: 'goal',
    },
    {
      id: 'v3',
      text: 'Wer willst du in 3 bis 5 Jahren sein, wenn Geld und Angst keine Rolle spielen?',
      examples: ['Unternehmer mit kleinem Team', 'Bekannte Stimme in meiner Nische', 'Ortsunabhängig und frei in meiner Zeit', 'Jemand, zu dem andere aufschauen', 'Sportlich auf Wettkampf-Niveau'],
    },
    {
      id: 'v4',
      text: 'Ehrlich: Was hast du in den letzten 4 Wochen aufgeschoben, obwohl es wichtig für diese Vision war?',
      hint: 'Unbequem, aber genau das wird deine erste Quest.',
      examples: ['Kunden aktiv ansprechen', 'Regelmäßig Videos posten', 'Mein Angebot klar formulieren', 'Rechnungen und Buchhaltung', 'Website oder Profil aufräumen'],
      derive: 'task',
    },
    {
      id: 'v5',
      text: 'Was steht dir dabei am meisten im Weg?',
      examples: ['Handy und Social Media', 'Ich fange zu viel gleichzeitig an', 'Ich weiß nicht, was zuerst', 'Kein fester Tagesablauf', 'Angst, dass es nicht gut genug ist'],
    },
    {
      id: 'v6',
      text: 'Crazy Idea: Was würdest du versuchen, wenn du wüsstest, dass es nicht scheitern kann?',
      hint: 'Nichts ist zu groß. Das landet als Sticky Note auf deiner Karte.',
      examples: ['Eigenes Produkt oder Kurs launchen', 'Ein Buch schreiben', 'Ein Jahr im Ausland arbeiten', 'Ein Event veranstalten', 'Einen Podcast starten'],
    },
  ],
  8: [
    {
      id: 'a1',
      text: 'Wie sieht ein Tag aus, nach dem du abends zufrieden ins Bett gehst?',
      examples: ['Früh aufgestanden und direkt losgelegt', 'Das Wichtigste vor dem Mittag erledigt', 'Trainiert und gut gegessen', 'Abends wirklich frei gehabt', 'Kaum am Handy gehangen'],
    },
    {
      id: 'a2',
      text: 'Was frisst dir aktuell die meiste Zeit, ohne dass es dir etwas bringt?',
      hint: 'Sei ehrlich, hier liest niemand mit.',
      examples: ['Instagram / TikTok scrollen', 'YouTube', 'Zu lange im Bett liegen', 'Planen statt machen', 'Nachrichten und Chats', 'Zocken'],
    },
    {
      id: 'a3',
      text: 'In welcher Situation kippt dein Tag am häufigsten?',
      examples: ['Direkt nach dem Aufwachen (Handy im Bett)', 'Nach dem Mittagessen', 'Wenn eine Aufgabe unklar ist', 'Nach dem Training', 'Abends, wenn ich müde bin'],
    },
    {
      id: 'a4',
      text: 'Welche kleinen Gewohnheiten willst du jeden Tag abhaken?',
      hint: 'Daraus werden deine Daily Quests. Lieber 3, die du schaffst, als 8, die dich erschlagen.',
      examples: ['Handy erst nach der Morgenroutine', 'Bett machen', '10 Minuten lesen', '10 Minuten spazieren', 'Arbeitsplatz aufräumen', 'Um 22:30 im Bett'],
      derive: 'daily',
    },
    {
      id: 'a5',
      text: 'Was in deinem Umfeld macht es dir unnötig schwer?',
      examples: ['Handy liegt immer neben mir', 'Unaufgeräumter Arbeitsplatz', 'Ich arbeite im Bett oder auf dem Sofa', 'Kein fester Arbeitsort', 'Zu viele offene Tabs und Apps'],
    },
    {
      id: 'a6',
      text: 'Welche eine Sache könntest du diese Woche ändern, die den größten Unterschied macht?',
      hint: 'Das wird eine Quest für diese Woche.',
      examples: ['Ladekabel fürs Handy raus aus dem Schlafzimmer', 'Festen Arbeitsplatz einrichten', 'Social-Media-Apps vom Homescreen nehmen', 'Wecker ans andere Ende des Zimmers', 'Essen für 3 Tage vorkochen'],
      derive: 'task',
    },
  ],
}

export const hasInterview = (id: ZoneId): boolean => !!INTERVIEWS[id]
