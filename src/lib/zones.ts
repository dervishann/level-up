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

// Interviews für alle 8 Zonen. Freigeschaltet wird eine nach der anderen (ZONE_ORDER).
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
  2: [
    {
      id: 'm1',
      text: 'Warum bist du selbstständig und nicht angestellt? Die ehrliche Antwort, nicht die für Instagram.',
      examples: ['Ich will frei über meine Zeit bestimmen', 'Ich will mehr verdienen, als ein Job hergibt', 'Ich will etwas Eigenes aufbauen', 'Ich halte es mit Chefs nicht aus', 'Ich will zeigen, dass ich es kann'],
    },
    {
      id: 'm2',
      text: 'Wofür sollen dich Leute kennen, wenn dein Name fällt?',
      examples: ['Der macht, was er sagt', 'Ehrlich, auch wenn es unbequem ist', 'Erklärt komplizierte Dinge einfach', 'Bringt Ergebnisse, nicht nur Ideen', 'Diszipliniert, sportlich, fokussiert'],
    },
    {
      id: 'm3',
      text: 'Welche drei Werte sind dir so wichtig, dass du dafür auch Geld liegen lassen würdest?',
      examples: ['Ehrlichkeit', 'Freiheit', 'Disziplin', 'Qualität vor Menge', 'Loyalität', 'Wachstum', 'Familie und Freunde zuerst'],
    },
    {
      id: 'm4',
      text: 'Was machst du ab jetzt bewusst NICHT mehr?',
      hint: 'Eine Not-to-do-Liste ist oft mehr wert als jede To-do-Liste.',
      examples: ['Aufträge unter meinem Mindestpreis annehmen', 'Kunden, die mich nicht respektieren', 'Fünf Projekte gleichzeitig anfangen', 'Morgens zuerst aufs Handy schauen', 'Mich mit anderen Creatorn vergleichen', 'Ja sagen, wenn ich Nein meine'],
    },
    {
      id: 'm5',
      text: 'Wem willst du mit deiner Arbeit wirklich helfen und wobei?',
      examples: ['Selbstständigen am Anfang, die keinen Plan haben', 'Kleinen Unternehmen, sichtbar zu werden', 'Leuten, die sich nicht trauen anzufangen', 'Menschen, fit und diszipliniert zu werden'],
    },
    {
      id: 'm6',
      text: 'Welcher Satz soll dich an schlechten Tagen erinnern, warum du das machst?',
      hint: 'Dein Leitsatz. Er taucht später wieder auf, wenn du ihn brauchst.',
      examples: ['Ich baue mir ein Leben, aus dem ich keinen Urlaub brauche', 'Anfangen schlägt Perfektion', 'Jeden Tag ein Prozent', 'Keiner kommt und rettet mich, also mache ich es selbst'],
    },
  ],
  3: [
    {
      id: 'o1',
      text: 'Was genau kauft ein Kunde bei dir? In einem Satz, den auch deine Oma versteht.',
      examples: ['Ich mache Social-Media-Videos für Unternehmen', 'Ich baue und betreue Websites', 'Ich berate Selbstständige beim Start', 'Ich übernehme Content komplett: Idee, Dreh, Schnitt', 'Ich bin mir selbst noch nicht sicher'],
    },
    {
      id: 'o2',
      text: 'Welches Ergebnis hat der Kunde danach, das er vorher nicht hatte?',
      hint: 'Kunden kaufen Ergebnisse, keine Tätigkeiten.',
      examples: ['Mehr Anfragen über Social Media', 'Einen professionellen Auftritt', 'Zeit, weil er es nicht mehr selbst machen muss', 'Klarheit, was er als Nächstes tun soll'],
    },
    {
      id: 'o3',
      text: 'Was an deinem Angebot ist noch unklar oder unfertig?',
      hint: 'Daraus wird eine Quest.',
      examples: ['Mein Preis steht nicht fest', 'Ich habe kein klares Paket', 'Ich kann es nicht in einem Satz erklären', 'Ich habe keine Beispiele oder Referenzen', 'Ich biete zu viele verschiedene Sachen an'],
      derive: 'task',
    },
    {
      id: 'o4',
      text: 'Über welche 3 Themen kannst du 50 Videos machen, ohne dass dir der Stoff ausgeht?',
      hint: 'Das werden deine Content-Säulen.',
      examples: ['Selbstständigkeit am Anfang: Gewerbe, Steuern, erste Kunden', 'Mein Alltag als Selbstständiger, ungeschönt', 'Disziplin, Training, Routinen', 'Fehler, die ich gemacht habe', 'Tools und Abläufe, die mir Zeit sparen', 'Kundenprojekte hinter den Kulissen'],
    },
    {
      id: 'o5',
      text: 'Was hält dich aktuell am meisten vom Posten ab?',
      examples: ['Ich weiß nicht, worüber', 'Es ist mir nicht gut genug', 'Schneiden dauert ewig', 'Ich drehe unregelmäßig, mal viel, mal nichts', 'Angst, was Bekannte denken', 'Ich habe Ideen, aber schreibe sie nie auf'],
    },
    {
      id: 'o6',
      text: 'Welchen einen Schritt machst du diese Woche für deinen Content?',
      hint: 'Tipp: Ein fester Dreh-Tag pro Woche schlägt jeden Tag ein bisschen.',
      examples: ['Einen festen Dreh-Tag pro Woche festlegen', '10 Video-Ideen in die Ideen-Truhe schreiben', '3 Videos an einem Stück vordrehen', 'Eine Schnitt-Vorlage bauen', 'Das eine Video posten, das seit Wochen fertig ist'],
      derive: 'task',
    },
  ],
  4: [
    {
      id: 'f1',
      text: 'Wie viel brauchst du im Monat mindestens, damit alles bezahlt ist?',
      hint: 'Miete, Essen, Versicherungen, Auto, Abos. Grob reicht.',
      examples: ['Unter 1.500 €', '1.500 bis 2.000 €', '2.000 bis 3.000 €', 'Über 3.000 €', 'Ich weiß es ehrlich gesagt nicht'],
    },
    {
      id: 'f2',
      text: 'Wie viel willst du in 12 Monaten pro Monat umsetzen?',
      hint: 'Das wird ein Ziel, das wir danach in Schritte zerlegen.',
      examples: ['3.000 € Umsatz im Monat', '5.000 € Umsatz im Monat', '10.000 € Umsatz im Monat'],
      derive: 'goal',
    },
    {
      id: 'f3',
      text: 'Wie sicher fühlst du dich mit deinen Preisen?',
      examples: ['Ich bin zu billig und weiß es', 'Ich würfle bei jedem Angebot neu', 'Passt, aber ich traue mich nicht zu erhöhen', 'Meine Preise stehen und ich nenne sie ohne Zögern'],
    },
    {
      id: 'f4',
      text: 'Wie läuft es mit Steuern und Buchhaltung?',
      hint: 'Kein Urteil. Nur damit nichts hinten runterfällt.',
      examples: ['Ich lege nichts für Steuern zurück', 'Belege stapeln sich seit Monaten', 'Ich habe einen Steuerberater, liefere aber zu spät', 'Ich habe ein eigenes Steuerkonto und lege regelmäßig zurück', 'Ich weiß nicht, welche Fristen ich habe'],
    },
    {
      id: 'f5',
      text: 'Was schiebst du bei den Finanzen am längsten vor dir her?',
      hint: 'Das wird eine Quest mit Extra-XP, weil sie niemand gern macht.',
      examples: ['Belege der letzten Monate sortieren', 'Offene Rechnungen schreiben', 'Zahlungen von Kunden anmahnen', 'Eigenes Konto für Steuer-Rücklagen eröffnen', 'Einmal alle Fixkosten aufschreiben', 'Unnötige Abos kündigen'],
      derive: 'task',
    },
    {
      id: 'f6',
      text: 'Welche Finanz-Routine willst du jede Woche abhaken?',
      examples: ['Freitags 20 Minuten Belege und Rechnungen', 'Von jeder Einnahme 30 % aufs Steuerkonto', 'Einmal pro Woche Kontostand anschauen', 'Offene Rechnungen prüfen'],
    },
  ],
  5: [
    {
      id: 'k1',
      text: 'Wer war dein bisher bester Kunde und was hat ihn so gut gemacht?',
      examples: ['Hat pünktlich gezahlt und nicht diskutiert', 'Hat mir vertraut und mich machen lassen', 'Wusste genau, was er wollte', 'Hat mich weiterempfohlen', 'Ich hatte noch keinen richtig guten Kunden'],
    },
    {
      id: 'k2',
      text: 'Beschreib deinen Wunschkunden so, dass du ihn auf der Straße erkennst.',
      examples: ['Lokale Unternehmen mit 5 bis 20 Mitarbeitern', 'Fitnessstudios, Coaches und Trainer', 'Handwerksbetriebe ohne Social Media', 'Gastronomie und Cafés', 'Andere Selbstständige mit vollem Kalender'],
    },
    {
      id: 'k3',
      text: 'Wo hält sich dieser Kunde auf, online und im echten Leben?',
      examples: ['Instagram', 'LinkedIn', 'Google Maps und lokale Suche', 'Bei mir in der Stadt, ich kann einfach hingehen', 'Über Empfehlungen von Bestandskunden', 'In meinem Verein oder Gym'],
    },
    {
      id: 'k4',
      text: 'Wie viele potenzielle Kunden hast du in den letzten 2 Wochen aktiv angesprochen?',
      hint: 'Aktiv heißt: Du hast den ersten Schritt gemacht.',
      examples: ['0', '1 bis 3', '4 bis 10', 'Mehr als 10'],
    },
    {
      id: 'k5',
      text: 'Was hält dich ehrlich davon ab, mehr Leute anzusprechen?',
      examples: ['Angst vor Ablehnung', 'Ich weiß nicht, was ich schreiben soll', 'Ich fühle mich aufdringlich', 'Mein Angebot ist mir selbst noch nicht klar', 'Ich habe keine Liste, wen ich ansprechen könnte', 'Ich warte, bis jemand von selbst kommt'],
    },
    {
      id: 'k6',
      text: 'Was ist dein erster Akquise-Schritt für diese Woche?',
      hint: 'Klein genug, dass du ihn wirklich machst.',
      examples: ['Liste mit 20 Wunschkunden schreiben', 'Nachrichtenvorlage für die Erstansprache schreiben', '5 Leute anschreiben', '3 Bestandskunden nach einer Empfehlung fragen', 'Einen festen Akquise-Block pro Woche festlegen'],
      derive: 'task',
    },
  ],
  6: [
    {
      id: 'r1',
      text: 'Auf welcher einen Plattform willst du zuerst richtig gut werden?',
      hint: 'Eine richtig schlägt vier halb.',
      examples: ['Instagram', 'TikTok', 'YouTube Shorts', 'LinkedIn'],
    },
    {
      id: 'r2',
      text: 'Wie oft postest du aktuell wirklich?',
      examples: ['Gar nicht', 'Wenn ich Lust habe', '1 bis 2 Mal pro Woche', '3 bis 5 Mal pro Woche', 'Täglich'],
    },
    {
      id: 'r3',
      text: 'Welchen Rhythmus hältst du auch in einer schlechten Woche durch?',
      hint: 'Lieber niedrig ansetzen und nie reißen.',
      examples: ['2 Videos pro Woche', '3 Videos pro Woche', '5 Videos pro Woche', 'Jeden Tag eins'],
    },
    {
      id: 'r4',
      text: 'Welche Formate fallen dir am leichtesten?',
      examples: ['In die Kamera sprechen', 'Voiceover über Alltagsszenen', 'Text auf dem Bild mit Musik', 'Bildschirmaufnahmen und Erklärvideos', 'Vorher/Nachher von Kundenprojekten'],
    },
    {
      id: 'r5',
      text: 'Woran merkst du in 3 Monaten, dass es funktioniert?',
      hint: 'Das wird ein Ziel, das wir in Schritte zerlegen.',
      examples: ['1.000 Follower', '10.000 Follower', '30 Videos gepostet', 'Erste Kundenanfrage über Social Media'],
      derive: 'goal',
    },
    {
      id: 'r6',
      text: 'Was richtest du diese Woche ein, damit Posten leichter wird?',
      examples: ['Profil und Bio überarbeiten', 'Feste Posting-Zeiten festlegen', 'Ideen-Liste mit 20 Hooks anlegen', 'Stativ, Licht und Mikro an einen festen Platz stellen', 'Vorlage für Untertitel und Schnitt bauen'],
      derive: 'task',
    },
  ],
  7: [
    {
      id: 'b1',
      text: 'Was ist dein wichtigstes körperliches Ziel für die nächsten 3 Monate?',
      examples: ['Muskeln aufbauen', 'Im Ringen besser werden', 'Körperfett verlieren', 'Mehr Energie im Alltag', 'Kein Training mehr ausfallen lassen'],
    },
    {
      id: 'b2',
      text: 'Was lässt dich am häufigsten ein Training ausfallen?',
      examples: ['Zu müde nach der Arbeit', 'Arbeit zieht sich und ich verschiebe es', 'Schlecht geschlafen', 'Kein fester Zeitpunkt', 'Eigentlich nichts, Training läuft'],
    },
    {
      id: 'b3',
      text: 'Wie läuft das Essen an einem normalen Tag?',
      examples: ['Regelmäßig und ich komme auf mein Protein', 'Ich vergesse zu essen, wenn ich arbeite', 'Zu viel Lieferdienst und Snacks', 'Morgens nichts, abends zu viel', 'Unter der Woche gut, am Wochenende Chaos'],
    },
    {
      id: 'b4',
      text: 'Was hält dich abends davon ab, pünktlich zu schlafen?',
      examples: ['Handy im Bett', 'Serien oder Zocken', 'Ich arbeite abends noch', 'Kopf ist voll, ich kann nicht abschalten', 'Spätes Training', 'Nichts, Schlaf passt'],
    },
    {
      id: 'b5',
      text: 'Welche Körper-Gewohnheiten willst du täglich abhaken?',
      hint: 'Daraus werden Daily Quests. Protein und Wasser hast du schon.',
      examples: ['3 richtige Mahlzeiten', '8.000 Schritte', 'Kein Handy 30 Minuten vor dem Schlafen', '10 Minuten dehnen', 'Kein Koffein nach 14 Uhr'],
      derive: 'daily',
    },
    {
      id: 'b6',
      text: 'Was bereitest du diese Woche vor, damit Essen und Training leichter laufen?',
      examples: ['Essen für 3 Tage vorkochen', 'Wocheneinkauf mit fester Liste', 'Sporttasche abends fertig packen', 'Proteinquellen auf Vorrat kaufen', 'Trainingszeiten fest in den Plan eintragen'],
      derive: 'task',
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

/** Reihenfolge, in der die Zonen freigeschaltet werden: erst Klarheit und Alltag, dann Geld, zuletzt das große Warum. */
export const ZONE_ORDER: ZoneId[] = [1, 8, 7, 5, 3, 4, 6, 2]

export const hasInterview = (id: ZoneId): boolean => !!INTERVIEWS[id]
