import type { Level3, ZoneId } from './types'

// Vorschlagslogik ohne KI: einfache Stichwort-Regeln.
// Ziel: Du musst nur bestätigen statt selbst zu überlegen.

const has = (text: string, words: string[]) => words.some((w) => text.includes(w))

const ZONE_WORDS: [ZoneId, string[]][] = [
  [4, ['rechnung', 'steuer', 'beleg', 'buchhaltung', 'finanz', 'konto', 'umsatz', 'preis', 'elster', 'rücklage', 'bank']],
  [5, ['kunde', 'kundin', 'angebot', 'akquise', 'lead', 'call', 'anruf', 'meeting', 'termin', 'projekt', 'auftrag']],
  [3, ['skript', 'reel', 'video', 'dreh', 'schneid', 'schnitt', 'hook', 'content', 'thumbnail', 'caption']],
  [6, ['post', 'instagram', 'tiktok', 'youtube', 'shorts', 'linkedin', 'follower', 'reichweite', 'profil', 'bio', 'story']],
  [7, ['gym', 'training', 'ringen', 'essen', 'kochen', 'meal', 'protein', 'einkauf', 'schlaf', 'arzt', 'dehnen']],
  [8, ['aufräum', 'putzen', 'wäsche', 'haushalt', 'wohnung', 'routine', 'handy', 'müll', 'paket']],
  [1, ['vision', 'ziel', 'idee']],
  [2, ['werte', 'mission', 'warum']],
]

export function suggestZone(text: string): ZoneId {
  const t = text.toLowerCase()
  for (const [z, words] of ZONE_WORDS) if (has(t, words)) return z
  return 5
}

export function suggestMinutes(text: string): number {
  const t = text.toLowerCase()
  if (has(t, ['anruf', 'mail', 'nachricht', 'antwort', 'überweis', 'bestell', 'buchen', 'termin'])) return 10
  if (has(t, ['rechnung', 'aufräum', 'einkauf', 'beleg', 'caption', 'post'])) return 25
  if (has(t, ['schneid', 'schnitt', 'dreh', 'konzept', 'website', 'steuer', 'buchhaltung', 'projekt'])) return 90
  if (has(t, ['skript', 'angebot', 'plan', 'recherch', 'schreib'])) return 45
  return 25
}

export function suggestKind(text: string, minutes: number): 'deep' | 'light' {
  const t = text.toLowerCase()
  if (has(t, ['skript', 'konzept', 'schreib', 'angebot', 'schneid', 'schnitt', 'dreh', 'website', 'plan', 'strategie'])) return 'deep'
  return minutes >= 45 ? 'deep' : 'light'
}

export function suggestDread(text: string): Level3 {
  const t = text.toLowerCase()
  if (has(t, ['steuer', 'buchhaltung', 'akquise', 'beleg', 'elster'])) return 3
  if (has(t, ['rechnung', 'anruf', 'angebot', 'aufräum', 'putzen'])) return 2
  return 1
}

export function looksLikeIdea(text: string): boolean {
  const t = text.toLowerCase()
  return has(t, ['idee', 'hook', 'vielleicht', 'irgendwann', 'könnte man', 'was wäre'])
}

/** Zerlegt eine Aufgabe in Mini-Schritte. Der erste dauert max. 2 Minuten. */
export function suggestSteps(title: string): string[] {
  const t = title.toLowerCase()
  if (has(t, ['skript', 'schreib', 'text', 'caption', 'konzept']))
    return ['Dokument öffnen und Überschrift schreiben', 'Drei Stichpunkte notieren, egal wie roh', 'Aus den Stichpunkten ganze Sätze machen', 'Einmal laut durchlesen und kürzen']
  if (has(t, ['mail', 'nachricht', 'antwort']))
    return ['Mail öffnen und Empfänger eintragen', 'Den ersten Satz schreiben', 'Rest in 3 Sätzen fertig schreiben', 'Abschicken']
  if (has(t, ['anruf', 'call']))
    return ['Nummer raussuchen', 'Einen Satz notieren: Was will ich?', 'Anrufen', 'Ergebnis in einem Satz notieren']
  if (has(t, ['rechnung']))
    return ['Rechnungsvorlage öffnen und Kundennamen eintragen', 'Positionen und Betrag eintragen', 'Als PDF speichern', 'Verschicken']
  if (has(t, ['angebot']))
    return ['Angebotsvorlage öffnen und Kundennamen eintragen', 'Leistung in 3 Stichpunkten beschreiben', 'Preis festlegen', 'Verschicken']
  if (has(t, ['steuer', 'beleg', 'buchhaltung']))
    return ['Ordner oder Programm öffnen', 'Nur die ersten 5 Belege sortieren', 'Rest abarbeiten', 'Abschließen und Ordner zumachen']
  if (has(t, ['dreh', 'video', 'reel']))
    return ['Handy aufs Stativ, Licht an', 'Den ersten Satz einmal aufnehmen', 'Alle Takes aufnehmen', 'Material sichern']
  if (has(t, ['schneid', 'schnitt']))
    return ['Schnittprogramm öffnen und Material importieren', 'Nur den Hook schneiden', 'Rest schneiden und Untertitel', 'Exportieren']
  if (has(t, ['akquise', 'kunden ansprechen', 'lead']))
    return ['Liste öffnen und einen Namen aussuchen', 'Eine Nachricht an genau diese Person schreiben', 'Zwei weitere Personen anschreiben', 'In der Liste abhaken']
  if (has(t, ['aufräum', 'putzen', 'haushalt', 'wäsche']))
    return ['Aufstehen und eine einzige Sache wegräumen', 'Eine Fläche komplett frei machen', 'Rest erledigen']
  if (has(t, ['einkauf', 'kochen', 'meal']))
    return ['Aufschreiben, was fehlt', 'Losgehen', 'Verstauen oder vorbereiten']
  return ['Alles Nötige öffnen oder bereitlegen', 'Den kleinsten ersten Teil erledigen', 'Dranbleiben bis fertig', 'Kurz prüfen und abhaken']
}

export const LATER_REASONS = ['Keine Energie', 'Blockiert', 'Keine Zeit', 'Passt gerade nicht'] as const

export const REWARD_SUGGESTIONS: { title: string; cost: number }[] = [
  { title: 'Folge Serie schauen', cost: 15 },
  { title: 'Kaffee oder Snack auswärts', cost: 20 },
  { title: 'Gaming-Abend', cost: 60 },
  { title: 'Cheat Meal', cost: 80 },
  { title: 'Freier Nachmittag', cost: 120 },
  { title: 'Etwas Neues kaufen (bis 30 €)', cost: 200 },
]

export const REFLECTION_CHIPS = ['Früh angefangen', 'Main Quest geschafft', 'Training durchgezogen', 'Wenig am Handy', 'Drangeblieben trotz null Bock', 'Gut gegessen']
