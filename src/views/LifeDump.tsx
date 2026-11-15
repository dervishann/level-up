import { useMemo, useState } from 'react'
import { useStore } from '../lib/store'
import { processDump, TYPE_LABEL, type DumpItem, type DumpType } from '../lib/dump'
import { addDays, dateKey, parseKey } from '../lib/date'
import { ZONES, zone as zoneOf } from '../lib/zones'
import type { Level3, ZoneId } from '../lib/types'
import { Chips, Overlay, buzz, zoneStyle } from '../ui'

const TYPES: DumpType[] = ['task', 'goal', 'note', 'idea', 'content', 'lead', 'skip']
const TYPE_ICON: Record<DumpType, string> = { task: '✅', goal: '🎯', note: '📝', idea: '💡', content: '🎬', lead: '🤝', skip: '✕' }
const WHERE: Record<DumpType, string> = {
  task: 'in deinen Plan',
  goal: 'zu deinen Zielen (morgen zerlegen wir es)',
  note: 'als Ast auf die Lebens-Karte',
  idea: 'in die Ideen-Truhe',
  content: 'in die Content-Pipeline',
  lead: 'in die Kunden-Pipeline',
  skip: 'nirgendwohin',
}

const PROMPTS = [
  'Was steht diese Woche noch an?',
  'Was schiebst du gerade vor dir her?',
  'Was läuft gerade gut, was nicht?',
  'Was ist mit Kunden, Geld, Content?',
  'Was geht dir sonst noch durch den Kopf?',
]

function whenLabel(it: DumpItem, today: string): string {
  if (!it.date) return it.deadline ? `bis ${parseKey(it.deadline).toLocaleDateString('de-DE', { day: 'numeric', month: 'numeric' })}` : 'irgendwann'
  if (it.date === today) return 'heute'
  if (it.date === addDays(today, 1)) return 'morgen'
  return parseKey(it.date).toLocaleDateString('de-DE', { weekday: 'short', day: 'numeric', month: 'numeric' })
}

function ItemCard({ it, onChange }: { it: DumpItem; onChange: (p: Partial<DumpItem>) => void }) {
  const [open, setOpen] = useState(false)
  const today = dateKey()
  const skip = it.type === 'skip'
  return (
    <div className="card col dump-item" style={{ ...zoneStyle(it.zone), opacity: skip ? 0.45 : 1, gap: 10 }}>
      <textarea className="dump-text" rows={Math.max(1, Math.ceil(it.text.length / 32))} value={it.text} onChange={(e) => onChange({ text: e.target.value })} />
      <div className="dump-types">
        {TYPES.map((t) => (
          <button key={t} className={'chip' + (it.type === t ? ' on' : '')} onClick={() => onChange({ type: t })}>
            {TYPE_ICON[t]} {TYPE_LABEL[t]}
          </button>
        ))}
      </div>
      {!skip && (
        <button className="row small" style={{ textAlign: 'left', width: '100%' }} onClick={() => setOpen(!open)}>
          <span className="zbadge">
            <i>{it.zone}</i>
          </span>
          <span className="grow muted">
            {zoneOf(it.zone).short}
            {it.type === 'task' && ` · ${whenLabel(it, today)} · ${it.minutes} Min${it.priority === 3 ? ' · wichtig' : ''}${it.dread === 3 ? ' · 😩' : ''}`}
            {it.type === 'lead' && ` · ${it.name}`}
          </span>
          <span className="muted">{open ? '▴' : 'ändern ▾'}</span>
        </button>
      )}
      {!skip && open && (
        <div className="col" style={{ gap: 12 }}>
          <div className="chips">
            {ZONES.map((z) => (
              <button key={z.id} className={'chip' + (it.zone === z.id ? ' on' : '')} style={zoneStyle(z.id)} onClick={() => onChange({ zone: z.id as ZoneId })}>
                <b style={{ color: z.color }}>{z.id}</b> {z.short}
              </button>
            ))}
          </div>
          {it.type === 'lead' && <input value={it.name ?? ''} onChange={(e) => onChange({ name: e.target.value })} placeholder="Name des Kunden" />}
          {it.type === 'task' && (
            <>
              <Chips
                options={[
                  { v: today, label: 'Heute' },
                  { v: addDays(today, 1), label: 'Morgen' },
                  { v: addDays(today, 2), label: 'Übermorgen' },
                  { v: '', label: 'Irgendwann' },
                ]}
                value={it.date ?? ''}
                onChange={(v) => onChange({ date: v || undefined })}
              />
              <Chips options={[10, 25, 45, 60, 90].map((v) => ({ v, label: `${v} Min` }))} value={it.minutes} onChange={(v) => onChange({ minutes: v, kind: v >= 45 ? 'deep' : it.kind })} />
              <Chips
                options={[
                  { v: 1 as Level3, label: 'Kann warten' },
                  { v: 2 as Level3, label: 'Normal' },
                  { v: 3 as Level3, label: 'Wichtig' },
                ]}
                value={it.priority}
                onChange={(v) => onChange({ priority: v })}
              />
              <Chips
                options={[
                  { v: 1 as Level3, label: 'Geht klar' },
                  { v: 2 as Level3, label: 'Ungern' },
                  { v: 3 as Level3, label: 'Keinen Bock (mehr XP)' },
                ]}
                value={it.dread}
                onChange={(v) => onChange({ dread: v })}
              />
            </>
          )}
        </div>
      )}
    </div>
  )
}

export function LifeDump({ onClose, initialText = '', inboxIds = [] }: { onClose: () => void; initialText?: string; inboxIds?: string[] }) {
  const clientCards = useStore((s) => s.data.clientCards)
  const clients = useMemo(() => clientCards.map((c) => c.name), [clientCards])
  const lastDump = useStore((s) => s.data.dumps[0])
  const applyDump = useStore((s) => s.applyDump)
  const [text, setText] = useState(initialText)
  const [items, setItems] = useState<DumpItem[] | null>(null)
  const [done, setDone] = useState<Record<string, number> | null>(null)
  const prompt = useMemo(() => PROMPTS[Math.floor(Math.random() * PROMPTS.length)], [])

  const process = () => {
    buzz()
    setItems(processDump(text, dateKey(), clients))
  }
  const change = (id: string, p: Partial<DumpItem>) => setItems((list) => list!.map((x) => (x.id === id ? { ...x, ...p } : x)))

  // 3) Fertig
  if (done) {
    return (
      <Overlay>
        <div className="col center" style={{ marginTop: 50, gap: 14 }}>
          <div style={{ fontSize: 60 }}>🧠</div>
          <h1>Kopf ist leer.</h1>
          <div className="col" style={{ gap: 6 }}>
            {Object.entries(done)
              .filter(([, n]) => n > 0)
              .map(([t, n]) => (
                <div key={t} className="small">
                  {TYPE_ICON[t as DumpType]} {n}× {TYPE_LABEL[t as DumpType]} → {WHERE[t as DumpType]}
                </div>
              ))}
          </div>
          <p className="muted small">Was heute dran ist, steht schon in deinem Plan.</p>
        </div>
        <div className="foot">
          <button className="btn primary big" onClick={onClose}>
            Zum Plan
          </button>
        </div>
      </Overlay>
    )
  }

  // 2) Prüfliste
  if (items) {
    const active = items.filter((i) => i.type !== 'skip' && i.text.trim())
    const apply = () => {
      const counts: Record<string, number> = {}
      for (const i of active) counts[i.type] = (counts[i.type] ?? 0) + 1
      applyDump(text, items, inboxIds)
      buzz([10, 40, 20])
      setDone(counts)
    }
    return (
      <Overlay>
        <div className="row between">
          <h3>Life Dump · {items.length} Punkte erkannt</h3>
          <button className="x" onClick={onClose} aria-label="Schließen">
            ✕
          </button>
        </div>
        <p className="muted small">So würde ich es einsortieren. Tipp an, was nicht passt. Nichts wird gespeichert, bevor du unten bestätigst.</p>
        {items.length === 0 && <p className="muted">Ich habe nichts erkannt. Geh zurück und schreib ein paar Zeilen.</p>}
        <div className="col" style={{ gap: 10 }}>
          {items.map((it) => (
            <ItemCard key={it.id} it={it} onChange={(p) => change(it.id, p)} />
          ))}
        </div>
        <div className="foot">
          <button className="btn primary big" disabled={!active.length} onClick={apply}>
            {active.length} Punkte einsortieren
          </button>
          <button className="btn ghost" onClick={() => setItems(null)}>
            Zurück zum Text
          </button>
        </div>
      </Overlay>
    )
  }

  // 1) Schreiben
  return (
    <Overlay>
      <div className="row between">
        <h3>Life Dump</h3>
        <button className="x" onClick={onClose} aria-label="Schließen">
          ✕
        </button>
      </div>
      <div className="col">
        <h1 style={{ fontSize: 26 }}>Schreib einfach alles raus.</h1>
        <p className="muted small">Was gerade in deinem Leben los ist, was noch erledigt werden muss, was dich nervt, was du vorhast. Ungeordnet, in deinen Worten. Ich sortiere es danach.</p>
      </div>
      <textarea
        className="dump-area"
        value={text}
        onChange={(e) => setText(e.target.value)}
        autoFocus
        placeholder={`${prompt}\n\nz. B.\nMuss bis Freitag noch die Rechnung an Studio Nord schicken\nBin gerade ziemlich gestresst wegen der Steuer, schiebe die seit Wochen\nAnfrage von Fitnessstudio Kraftwerk\nVideo über meine 3 größten Fehler am Anfang\nIch will 10K im Monat`}
      />
      <p className="tiny muted">Tipp: Eine Sache pro Zeile wird am besten erkannt. „morgen“, „Freitag“, „bis 20.11.“, „dringend“, „keinen Bock“ und „2 Stunden“ versteht die App.</p>
      <div className="foot">
        <button className="btn primary big" disabled={!text.trim()} onClick={process}>
          Verarbeiten
        </button>
        {lastDump && !text && (
          <p className="tiny muted center">Letzter Life Dump: {new Date(lastDump.at).toLocaleDateString('de-DE', { weekday: 'long', day: 'numeric', month: 'long' })}</p>
        )}
      </div>
    </Overlay>
  )
}
