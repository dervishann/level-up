import { useState } from 'react'
import { useStore } from '../lib/store'
import { INTERVIEWS, ZONES, zone as zoneOf, type Derive, type Question } from '../lib/zones'
import type { MapCard, ZoneId } from '../lib/types'
import type { Modal } from '../App'
import { Overlay, Progress, Sheet, ZoneBadge, buzz, zoneStyle } from '../ui'
import { GoalsSection } from './Goals'

// ---------- Interview: eine Frage pro Screen ----------

export function Interview({ zone, onClose }: { zone: ZoneId; onClose: () => void }) {
  const questions = INTERVIEWS[zone] ?? []
  const cards = useStore((s) => s.data.cards)
  const { answerQuestion, finishZone } = useStore.getState()
  const firstOpen = questions.findIndex((q) => !cards.some((c) => c.questionId === q.id))
  const [i, setI] = useState(firstOpen === -1 ? 0 : firstOpen)
  const [picked, setPicked] = useState<string[]>(() => cards.filter((c) => c.questionId === questions[firstOpen === -1 ? 0 : firstOpen]?.id).map((c) => c.text))
  const [own, setOwn] = useState('')
  const [accepted, setAccepted] = useState<Record<string, boolean>>({})
  const z = zoneOf(zone)
  const q: Question | undefined = questions[i]

  const go = (n: number) => {
    setI(n)
    setOwn('')
    setPicked(useStore.getState().data.cards.filter((c) => c.questionId === questions[n]?.id).map((c) => c.text))
  }

  const addOwn = () => {
    const t = own.trim()
    if (t && !picked.includes(t)) setPicked([...picked, t])
    setOwn('')
  }

  const next = () => {
    const all = own.trim() && !picked.includes(own.trim()) ? [...picked, own.trim()] : picked
    answerQuestion(zone, q!.id, all)
    buzz()
    go(i + 1)
  }

  // Abschluss: Vorschläge bestätigen
  if (!q) {
    const now = useStore.getState().data
    const proposals: { key: string; type: Derive; text: string }[] = []
    for (const qq of questions) {
      if (!qq.derive) continue
      for (const c of now.cards.filter((x) => x.questionId === qq.id)) proposals.push({ key: c.id, type: qq.derive, text: c.text })
    }
    const isOn = (k: string) => accepted[k] ?? true
    const label: Record<Derive, string> = { goal: 'Großes Ziel (wird später ein Boss)', task: 'Quest', daily: 'Daily Quest' }
    const done = () => {
      const pick = (t: Derive) => proposals.filter((p) => p.type === t && isOn(p.key)).map((p) => p.text)
      finishZone(zone, { goals: pick('goal'), tasks: pick('task'), dailies: pick('daily') })
      buzz([10, 40, 20])
      onClose()
    }
    return (
      <Overlay zoneId={zone}>
        <div className="col">
          <ZoneBadge id={zone} />
          <h1>Zone erkundet!</h1>
          <p className="muted">{proposals.length ? 'Aus deinen Antworten schlage ich das hier vor. Tipp ab, was du nicht willst.' : 'Deine Antworten hängen jetzt als Äste an der Karte.'}</p>
        </div>
        <div className="col" style={{ gap: 8 }}>
          {proposals.map((p) => (
            <button key={p.key} className="card row" style={{ textAlign: 'left', opacity: isOn(p.key) ? 1 : 0.45 }} onClick={() => setAccepted({ ...accepted, [p.key]: !isOn(p.key) })}>
              <span className={'check' + (isOn(p.key) ? ' on' : '')}>✓</span>
              <span className="grow">
                <span className="tiny muted">{label[p.type]}</span>
                <br />
                {p.text}
              </span>
            </button>
          ))}
        </div>
        <div className="foot">
          <button className="btn primary big" onClick={done}>
            Bestätigen
          </button>
          <button className="btn ghost" onClick={() => go(questions.length - 1)}>
            Zurück
          </button>
        </div>
      </Overlay>
    )
  }

  const options = [...q.examples, ...picked.filter((p) => !q.examples.includes(p))]
  return (
    <Overlay zoneId={zone}>
      <div className="row between">
        <ZoneBadge id={zone} />
        <button className="x" onClick={onClose} aria-label="Schließen">
          ✕
        </button>
      </div>
      <Progress n={i + 1} of={questions.length} />
      <div className="col">
        <h1 style={{ fontSize: 24 }}>{q.text}</h1>
        {q.hint && <p className="muted small">{q.hint}</p>}
      </div>
      <div className="chips stack">
        {options.map((o) => (
          <button key={o} className={'chip' + (picked.includes(o) ? ' on' : '')} onClick={() => setPicked(picked.includes(o) ? picked.filter((x) => x !== o) : [...picked, o])}>
            {o}
          </button>
        ))}
      </div>
      <div className="row">
        <input value={own} onChange={(e) => setOwn(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && addOwn()} placeholder="Eigene Antwort …" />
        <button className="btn sm" onClick={addOwn} disabled={!own.trim()}>
          +
        </button>
      </div>
      <div className="foot">
        <button className="btn primary big" disabled={!picked.length && !own.trim()} onClick={next}>
          {i === questions.length - 1 ? 'Fertig' : 'Weiter'}
        </button>
        {i > 0 && (
          <button className="btn ghost" onClick={() => go(i - 1)}>
            Zurück
          </button>
        )}
        <p className="tiny muted center">Zone: {z.name} · Du kannst jederzeit unterbrechen, deine Antworten bleiben.</p>
      </div>
    </Overlay>
  )
}

// ---------- Lebens-Karte ----------

export function MapView({ open }: { open: (m: Modal) => void }) {
  const data = useStore((s) => s.data)
  const { editCard, deleteCard, addCard } = useStore.getState()
  const [openZone, setOpenZone] = useState<ZoneId | null>(1)
  const [edit, setEdit] = useState<MapCard | { zone: ZoneId; id: null; text: string } | null>(null)
  const [text, setText] = useState('')

  const pct = (id: ZoneId) => {
    const qs = INTERVIEWS[id]
    if (!qs) return 0
    const answered = qs.filter((q) => data.cards.some((c) => c.questionId === q.id)).length
    return Math.round((answered / qs.length) * 100)
  }
  const playable = (id: ZoneId) => !!INTERVIEWS[id] && (id === 1 || data.zonesDone.includes(1))
  const total = Math.round(ZONES.reduce((s, z) => s + pct(z.id), 0) / ZONES.length)

  const startEdit = (c: MapCard | { zone: ZoneId; id: null; text: string }) => {
    setEdit(c)
    setText(c.text)
  }

  return (
    <div className="screen">
      <div className="col gap-l">
        <div className="narrow">
          <h1>Lebens-Karte</h1>
          <p className="muted small">{total} % deiner Welt erkundet. Jede Zone, die du freilegst, gibt deinen Quests ein Warum.</p>
        </div>

        <GoalsSection open={open} />

        <div className="map-grid">
          {ZONES.map((z) => {
            const p = pct(z.id)
            const can = playable(z.id)
            const cards = data.cards.filter((c) => c.zone === z.id)
            const isOpen = openZone === z.id && can
            return (
              <div key={z.id} className={'card zone-card col' + (can ? '' : ' fog')} style={zoneStyle(z.id)}>
                <button className="row" style={{ textAlign: 'left', width: '100%' }} onClick={() => can && setOpenZone(isOpen ? null : z.id)}>
                  <span className="zbadge">
                    <i style={{ width: 34, height: 34, fontSize: 16 }}>{z.id}</i>
                  </span>
                  <span className="grow">
                    <b>{z.name}</b>
                    <br />
                    <span className="muted small">{can ? z.desc : INTERVIEWS[z.id] ? 'Im Nebel · erst Zone 1 erkunden' : 'Im Nebel · wird in den nächsten Tagen freigeschaltet'}</span>
                  </span>
                  {can && <span className="num small muted">{p} %</span>}
                </button>
                {can && (
                  <div className="bar">
                    <div style={{ width: `${p}%` }} />
                  </div>
                )}
                {isOpen && (
                  <>
                    {(INTERVIEWS[z.id] ?? []).map((q) => {
                      const mine = cards.filter((c) => c.questionId === q.id)
                      if (!mine.length) return null
                      return (
                        <div key={q.id} className="col" style={{ gap: 6 }}>
                          <span className="tiny muted">{q.text}</span>
                          {mine.map((c) => (
                            <button key={c.id} className={'branch' + (q.id === 'v6' ? ' sticky' : '')} style={{ textAlign: 'left' }} onClick={() => startEdit(c)}>
                              {c.text}
                            </button>
                          ))}
                        </div>
                      )
                    })}
                    {cards.filter((c) => !c.questionId).map((c) => (
                      <button key={c.id} className="branch" style={{ textAlign: 'left' }} onClick={() => startEdit(c)}>
                        {c.text}
                      </button>
                    ))}
                    <div className="row">
                      <button className="btn sm primary" onClick={() => open({ k: 'interview', zone: z.id })}>
                        {p === 0 ? 'Interview starten' : p < 100 ? 'Interview fortsetzen' : 'Antworten überarbeiten'}
                      </button>
                      <button className="btn sm" onClick={() => startEdit({ zone: z.id, id: null, text: '' })}>
                        + Ast
                      </button>
                    </div>
                  </>
                )}
              </div>
            )
          })}
        </div>

        {data.ideas.length > 0 && (
          <div className="narrow col" style={{ gap: 8 }}>
            <h3>Ideen-Truhe · {data.ideas.length}</h3>
            {data.ideas.map((i) => (
              <div key={i.id} className="branch" style={zoneStyle(i.zone)}>
                💡 {i.text}
              </div>
            ))}
          </div>
        )}
      </div>

      {edit && (
        <Sheet onClose={() => setEdit(null)} zoneId={edit.zone}>
          <h2>{edit.id ? 'Ast bearbeiten' : 'Neuer Ast'}</h2>
          <input value={text} onChange={(e) => setText(e.target.value)} autoFocus placeholder="Was gehört hier noch hin?" />
          <button
            className="btn primary"
            disabled={!text.trim()}
            onClick={() => {
              if (edit.id) editCard(edit.id, text.trim())
              else addCard(edit.zone, text.trim())
              setEdit(null)
            }}
          >
            Speichern
          </button>
          {edit.id && (
            <button
              className="btn ghost danger"
              onClick={() => {
                deleteCard(edit.id!)
                setEdit(null)
              }}
            >
              Löschen
            </button>
          )}
        </Sheet>
      )}
    </div>
  )
}
