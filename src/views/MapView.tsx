import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { useStore, zoneUnlocked } from '../lib/store'
import { INTERVIEWS, ZONE_ORDER, ZONES, zone as zoneOf, type Derive, type Question } from '../lib/zones'
import type { MapCard, ZoneId } from '../lib/types'
import type { Modal } from '../App'
import { Overlay, Progress, Sheet, ZoneBadge, buzz, zoneStyle } from '../ui'
import { GoalsSection } from './Goals'
import { neglectedZones } from '../lib/planner'
import { dateKey } from '../lib/date'

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

type EditTarget = MapCard | { zone: ZoneId; id: null; text: string }

const usePct = () => {
  const cards = useStore((s) => s.data.cards)
  return (id: ZoneId) => {
    const qs = INTERVIEWS[id]
    if (!qs) return 0
    return Math.round((qs.filter((q) => cards.some((c) => c.questionId === q.id)).length / qs.length) * 100)
  }
}

const fogText = (id: ZoneId, zonesDone: ZoneId[]): string => {
  const before = ZONE_ORDER[ZONE_ORDER.indexOf(id) - 1]
  if (before === undefined || zonesDone.includes(before)) return 'Im Nebel · wird morgen als Quest freigeschaltet'
  return `Im Nebel · kommt nach Zone ${before} (${zoneOf(before).short})`
}

/** Inhalt einer geöffneten Zone: Äste, Interview-Knopf, Ast hinzufügen. */
function ZoneDetail({ id, open, onEdit }: { id: ZoneId; open: (m: Modal) => void; onEdit: (c: EditTarget) => void }) {
  const cards = useStore((s) => s.data.cards).filter((c) => c.zone === id)
  const p = usePct()(id)
  return (
    <>
      {(INTERVIEWS[id] ?? []).map((q) => {
        const mine = cards.filter((c) => c.questionId === q.id)
        if (!mine.length) return null
        return (
          <div key={q.id} className="col" style={{ gap: 6 }}>
            <span className="tiny muted">{q.text}</span>
            {mine.map((c) => (
              <button key={c.id} className={'branch' + (q.id === 'v6' ? ' sticky' : '')} style={{ textAlign: 'left' }} onClick={() => onEdit(c)}>
                {c.text}
              </button>
            ))}
          </div>
        )
      })}
      {cards
        .filter((c) => !c.questionId)
        .map((c) => (
          <button key={c.id} className="branch" style={{ textAlign: 'left' }} onClick={() => onEdit(c)}>
            {c.text}
          </button>
        ))}
      <div className="row">
        <button className="btn sm primary" onClick={() => open({ k: 'interview', zone: id })}>
          {p === 0 ? 'Interview starten' : p < 100 ? 'Interview fortsetzen' : 'Antworten überarbeiten'}
        </button>
        <button className="btn sm" onClick={() => onEdit({ zone: id, id: null, text: '' })}>
          + Ast
        </button>
      </div>
    </>
  )
}

// ---------- Desktop: große Canvas zum Zoomen und Verschieben ----------

const R_ZONE = 300
const R_BOX = 590
const pos = (i: number, r: number) => {
  const a = ((-90 + i * 45) * Math.PI) / 180
  // Ellipse statt Kreis: nutzt den breiten Bildschirm besser aus
  return { x: Math.cos(a) * r * 1.45, y: Math.sin(a) * r * 0.8 }
}

function Canvas({ onPick }: { onPick: (id: ZoneId) => void }) {
  const data = useStore((s) => s.data)
  const pct = usePct()
  const ref = useRef<HTMLDivElement>(null)
  const [view, setView] = useState({ x: 0, y: 0, k: 0.5 })
  const drag = useRef<{ px: number; py: number; vx: number; vy: number; moving: boolean } | null>(null)
  const total = Math.round(ZONES.reduce((s, z) => s + pct(z.id), 0) / ZONES.length)

  // all = true: alles inklusive Äste zeigen; sonst so nah, dass die Zonen gut lesbar sind
  const fit = (all: boolean) => {
    const r = ref.current?.getBoundingClientRect()
    if (!r) return
    const [w, h] = all ? [2000, 1200] : [1500, 860]
    setView({ x: r.width / 2, y: r.height / 2, k: Math.max(0.3, Math.min(r.width / w, r.height / h)) })
  }
  useLayoutEffect(() => fit(false), [])

  const zoomAt = (cx: number, cy: number, factor: number) =>
    setView((v) => {
      const k = Math.max(0.25, Math.min(2.2, v.k * factor))
      const f = k / v.k
      return { k, x: cx - (cx - v.x) * f, y: cy - (cy - v.y) * f }
    })

  useEffect(() => {
    const el = ref.current
    if (!el) return
    const wheel = (e: WheelEvent) => {
      e.preventDefault()
      const r = el.getBoundingClientRect()
      zoomAt(e.clientX - r.left, e.clientY - r.top, Math.exp(-e.deltaY * 0.0015))
    }
    el.addEventListener('wheel', wheel, { passive: false })
    return () => el.removeEventListener('wheel', wheel)
  }, [])

  const center = () => {
    const r = ref.current!.getBoundingClientRect()
    return [r.width / 2, r.height / 2] as const
  }

  return (
    <div
      ref={ref}
      className="canvas"
      onPointerDown={(e) => (drag.current = { px: e.clientX, py: e.clientY, vx: view.x, vy: view.y, moving: false })}
      onPointerMove={(e) => {
        const d = drag.current
        if (!d) return
        const dx = e.clientX - d.px
        const dy = e.clientY - d.py
        if (!d.moving && Math.hypot(dx, dy) < 5) return
        if (!d.moving) {
          d.moving = true
          ref.current?.setPointerCapture(e.pointerId)
        }
        setView((v) => ({ ...v, x: d.vx + dx, y: d.vy + dy }))
      }}
      onPointerUp={() => (drag.current = null)}
      onPointerCancel={() => (drag.current = null)}
    >
      <div className="world" style={{ transform: `translate(${view.x}px, ${view.y}px) scale(${view.k})` }}>
        <svg className="links" viewBox="-1100 -1100 2200 2200" width={2200} height={2200}>
          {ZONES.map((z, i) => {
            const a = pos(i, R_ZONE)
            const b = pos(i, R_BOX)
            const can = zoneUnlocked(data, z.id)
            const has = data.cards.some((c) => c.zone === z.id)
            return (
              <g key={z.id} stroke={can ? z.color : 'var(--line)'} strokeWidth={3} fill="none" strokeLinecap="round">
                <path d={`M0 0 L${a.x} ${a.y}`} strokeDasharray={can ? undefined : '4 10'} />
                {can && has && <path d={`M${a.x} ${a.y} L${b.x} ${b.y}`} opacity={0.6} />}
              </g>
            )
          })}
        </svg>

        <div className="node core">
          <b>{data.profile.name}</b>
          <span className="tiny">{total} % erkundet</span>
        </div>

        {ZONES.map((z, i) => {
          const a = pos(i, R_ZONE)
          const b = pos(i, R_BOX)
          const can = zoneUnlocked(data, z.id)
          const cards = data.cards.filter((c) => c.zone === z.id)
          const p = pct(z.id)
          return (
            <div key={z.id} style={zoneStyle(z.id)}>
              <button className={'node zone' + (can ? '' : ' fog')} style={{ left: a.x, top: a.y }} onClick={() => onPick(z.id)}>
                <i>{can ? z.id : '?'}</i>
                <b>{z.name}</b>
                <span className="tiny">{can ? `${p} %` : 'Im Nebel'}</span>
              </button>
              {can && cards.length > 0 && (
                <button className="node box" style={{ left: b.x, top: b.y }} onClick={() => onPick(z.id)}>
                  {cards.slice(0, 5).map((c) => (
                    <span key={c.id} className={'leaf' + (c.questionId === 'v6' ? ' sticky' : '')}>
                      {c.text}
                    </span>
                  ))}
                  {cards.length > 5 && <span className="tiny muted">+ {cards.length - 5} weitere</span>}
                </button>
              )}
            </div>
          )
        })}
      </div>

      <div className="zoom" onPointerDown={(e) => e.stopPropagation()}>
        <button onClick={() => zoomAt(...center(), 1.25)} aria-label="Vergrößern">
          +
        </button>
        <button onClick={() => zoomAt(...center(), 0.8)} aria-label="Verkleinern">
          −
        </button>
        <button onClick={() => fit(true)} aria-label="Alles zeigen">
          ⤢
        </button>
      </div>
      <span className="canvas-hint tiny muted">Ziehen zum Verschieben · Mausrad zum Zoomen · Zone anklicken</span>
    </div>
  )
}

const useWide = () => {
  const [wide, setWide] = useState(() => window.matchMedia('(min-width: 900px)').matches)
  useEffect(() => {
    const m = window.matchMedia('(min-width: 900px)')
    const on = () => setWide(m.matches)
    m.addEventListener('change', on)
    return () => m.removeEventListener('change', on)
  }, [])
  return wide
}

export function MapView({ open }: { open: (m: Modal) => void }) {
  const data = useStore((s) => s.data)
  const { editCard, deleteCard, addCard } = useStore.getState()
  const pct = usePct()
  const wide = useWide()
  const [asList, setAsList] = useState(false)
  const [openZone, setOpenZone] = useState<ZoneId | null>(1)
  const [picked, setPicked] = useState<ZoneId | null>(null)
  const [edit, setEdit] = useState<EditTarget | null>(null)
  const [text, setText] = useState('')
  const total = Math.round(ZONES.reduce((s, z) => s + pct(z.id), 0) / ZONES.length)
  const showCanvas = wide && !asList

  const startEdit = (c: EditTarget) => {
    setPicked(null)
    setEdit(c)
    setText(c.text)
  }
  const openModal = (m: Modal) => {
    setPicked(null)
    open(m)
  }

  return (
    <div className="screen">
      <div className="col gap-l">
        <div className="narrow row between">
          <div>
            <h1>Lebens-Karte</h1>
            <p className="muted small">{total} % deiner Welt erkundet. Jede Zone, die du freilegst, gibt deinen Quests ein Warum.</p>
          </div>
          {wide && (
            <button className="btn sm" onClick={() => setAsList(!asList)}>
              {asList ? 'Als Karte' : 'Als Liste'}
            </button>
          )}
        </div>

        {neglectedZones(data.tasks, data.zonesDone, data.profile.startDate, dateKey()).map((n) => (
          <div key={n.zone} className="notice narrow" style={zoneStyle(n.zone as ZoneId)}>
            <b style={{ color: 'var(--zone)' }}>Zone {n.zone} · {zoneOf(n.zone as ZoneId).name}</b>: seit {n.days} Tagen keine Quest erledigt. Kipp eine kleine Aufgabe dafür in die Inbox, damit der Bereich nicht hinten runterfällt.
          </div>
        ))}

        {showCanvas && <Canvas onPick={setPicked} />}

        <GoalsSection open={open} />

        {!showCanvas && (
          <div className="map-grid">
            {ZONES.map((z) => {
              const p = pct(z.id)
              const can = zoneUnlocked(data, z.id)
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
                      <span className="muted small">{can ? z.desc : fogText(z.id, data.zonesDone)}</span>
                    </span>
                    {can && <span className="num small muted">{p} %</span>}
                  </button>
                  {can && (
                    <div className="bar">
                      <div style={{ width: `${p}%` }} />
                    </div>
                  )}
                  {isOpen && <ZoneDetail id={z.id} open={open} onEdit={startEdit} />}
                </div>
              )
            })}
          </div>
        )}

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

      {picked && (
        <Sheet onClose={() => setPicked(null)} zoneId={picked}>
          <div className="row between">
            <ZoneBadge id={picked} />
            <button className="x" onClick={() => setPicked(null)} aria-label="Schließen">
              ✕
            </button>
          </div>
          {zoneUnlocked(data, picked) ? (
            <>
              <p className="muted small">{zoneOf(picked).desc}</p>
              <ZoneDetail id={picked} open={openModal} onEdit={startEdit} />
            </>
          ) : (
            <p className="muted">{fogText(picked, data.zonesDone)}. Es kommt höchstens eine neue Zone pro Tag dazu, damit dich die Karte nicht erschlägt.</p>
          )}
        </Sheet>
      )}

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
