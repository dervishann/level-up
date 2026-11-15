import { describe, expect, it } from 'vitest'
import { classify, cleanTitle, guessName, parseWhen, processDump, splitDump } from './dump'

// 2026-11-15 ist ein Sonntag
const TODAY = '2026-11-15'

describe('Life Dump zerlegen', () => {
  it('trennt Zeilen, Aufzählungen, Sätze und „außerdem“', () => {
    const text = `- Rechnung an Studio Nord schicken
2) Zahnarzt anrufen
Ich bin gerade ziemlich gestresst. Muss morgen noch die Steuer machen; außerdem Wäsche waschen`
    expect(splitDump(text)).toEqual([
      'Rechnung an Studio Nord schicken',
      'Zahnarzt anrufen',
      'Ich bin gerade ziemlich gestresst',
      'Muss morgen noch die Steuer machen',
      'Wäsche waschen',
    ])
  })

  it('zerschneidet keine Datumsangaben und keine Beträge', () => {
    expect(splitDump('Bis 20.11. die Steuer abgeben')).toEqual(['Bis 20.11. die Steuer abgeben'])
    expect(splitDump('Ich will 10.000 € im Monat')).toEqual(['Ich will 10.000 € im Monat'])
  })
})

describe('Datum erkennen', () => {
  it('heute, morgen, übermorgen', () => {
    expect(parseWhen('heute noch anrufen', TODAY).date).toBe('2026-11-15')
    expect(parseWhen('morgen Rechnung schreiben', TODAY).date).toBe('2026-11-16')
    expect(parseWhen('übermorgen zum Arzt', TODAY).date).toBe('2026-11-17')
    expect(parseWhen('morgens joggen', TODAY).date).toBeUndefined()
  })

  it('Wochentage und nächste Woche', () => {
    expect(parseWhen('am Freitag Belege', TODAY).date).toBe('2026-11-20')
    expect(parseWhen('Sonntag Wochenplanung', TODAY).date).toBe('2026-11-22')
    expect(parseWhen('nächste Woche Akquise', TODAY).date).toBe('2026-11-16')
  })

  it('„bis“ wird zur Deadline, ohne den Tag zu verplanen', () => {
    expect(parseWhen('bis 30.11. Steuer abgeben', TODAY)).toEqual({ date: undefined, deadline: '2026-11-30' })
    expect(parseWhen('bis morgen Angebot schicken', TODAY)).toEqual({ date: '2026-11-16', deadline: '2026-11-16' })
  })

  it('Datum in der Vergangenheit gehört ins nächste Jahr', () => {
    expect(parseWhen('am 3.1. Termin', TODAY).date).toBe('2027-01-03')
  })

  it('irgendwann bleibt ohne Datum', () => {
    expect(parseWhen('irgendwann mal Keller aufräumen', TODAY)).toEqual({ vague: true })
  })
})

describe('Art erkennen', () => {
  it('Aufgaben, Gefühle, Ziele, Ideen', () => {
    expect(classify('Muss noch die Rechnung schicken')).toBe('task')
    expect(classify('Zahnarzt anrufen')).toBe('task')
    expect(classify('Ich bin gerade ziemlich gestresst')).toBe('note')
    expect(classify('Ich will 10.000 € im Monat verdienen')).toBe('goal')
    expect(classify('Bis Ende des Jahres 1.000 Follower')).toBe('goal')
    expect(classify('Idee: Podcast mit anderen Selbstständigen')).toBe('idea')
  })

  it('Video-Ideen gehen in die Content-Pipeline, Video-Arbeit bleibt Aufgabe', () => {
    expect(classify('Video über meine 3 größten Fehler')).toBe('content')
    expect(classify('Reel schneiden und posten')).toBe('task')
  })

  it('neue Kunden werden Leads, bekannte Kunden bleiben Aufgaben', () => {
    expect(classify('Anfrage von Fitnessstudio Kraftwerk')).toBe('lead')
    expect(classify('Studio Nord hat sich gemeldet, Angebot schicken', ['Studio Nord'])).toBe('task')
    expect(guessName('Anfrage von Fitnessstudio Kraftwerk wegen Videos')).toBe('Fitnessstudio Kraftwerk')
    expect(guessName('Café Mila hat sich gemeldet')).toBe('Café Mila')
  })
})

describe('Titel kürzen', () => {
  it('entfernt Füll- und Zeitwörter am Anfang', () => {
    expect(cleanTitle('Muss bis Freitag noch die Rechnung an Studio Nord schicken')).toBe('Rechnung an Studio Nord schicken')
    expect(cleanTitle('morgen dringend Zahnarzt anrufen')).toBe('Zahnarzt anrufen')
    expect(cleanTitle('irgendwann mal Keller aufräumen')).toBe('Keller aufräumen')
    expect(cleanTitle('ich muss am 20.11. die Steuer abgeben')).toBe('Steuer abgeben')
  })

  it('lässt normale Titel und zu kurze Reste in Ruhe', () => {
    expect(cleanTitle('Wäsche waschen')).toBe('Wäsche waschen')
    expect(cleanTitle('Muss noch')).toBe('Muss noch')
  })
})

describe('Ganzer Dump', () => {
  it('liefert vollständige Vorschläge', () => {
    let n = 0
    const items = processDump(
      `Ich bin gerade ziemlich gestresst
Muss dringend die Rechnung an Studio Nord schicken
irgendwann mal den Keller aufräumen
Steuer seit Wochen nicht gemacht, nervt, ca. 2 Stunden`,
      TODAY,
      ['Studio Nord'],
      () => `i${++n}`,
    )
    expect(items.map((i) => i.type)).toEqual(['note', 'task', 'task', 'task'])

    const invoice = items[1]
    expect(invoice.date).toBe(TODAY)
    expect(invoice.priority).toBe(3)
    expect(invoice.zone).toBe(5)

    const cellar = items[2]
    expect(cellar.date).toBeUndefined()
    expect(cellar.priority).toBe(1)

    const tax = items[3]
    expect(tax.dread).toBe(3)
    expect(tax.minutes).toBe(120)
    expect(tax.zone).toBe(4)
    expect(tax.date).toBe('2026-11-16') // ohne Angabe: morgen, damit der heutige Plan nicht überläuft
  })

  it('ordnet Gesundheit und Geld-Ziele dem richtigen Bereich zu', () => {
    const [doc, money] = processDump('Zahnarzt anrufen\nIch will 10K im Monat', TODAY)
    expect(doc.zone).toBe(7)
    expect(money.type).toBe('goal')
    expect(money.zone).toBe(4)
  })

  it('leerer Text ergibt nichts', () => {
    expect(processDump('   \n\n - ', TODAY)).toEqual([])
  })
})
