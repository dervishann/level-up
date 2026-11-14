import { useState, type ReactNode } from 'react'
import { useStore } from '../lib/store'
import { activeCount, batchHint, CLIENT_STAGES, CONTENT_STAGES, isOverdue, LAST_STAGE, overdueDays, postedThisWeek, taxReserve, WEEKDAY_LONG } from '../lib/pipelines'
import { dateKey, parseKey, WEEKDAYS } from '../lib/date'
import type { Task } from '../lib/types'
import { Chips, zoneStyle } from '../ui'

const DAY_ORDER = [1, 2, 3, 4, 5, 6, 0]
const eur = (n: number) => n.toLocaleString('de-DE') + ' €'
const shortDate = (key: string) => parseKey(key).toLocaleDateString('de-DE', { weekday: 'short', day: 'numeric', month: 'numeric' })

/** Spalten nebeneinander (Laptop) bzw. untereinander (Handy). */
function Board({ stages, count, children }: { stages: string[]; count: (stage: number) => number; children: (stage: number) => ReactNode }) {
  return (
    <div className="board">
      {stages.map((name, i) => (
        <div key={name} className="board-col">
          <div className="row between">
            <h3>{name}</h3>
            <span className="tiny muted num">{count(i)}</span>
          </div>
          {children(i)}
          {count(i) === 0 && <div className="board-empty tiny muted">leer</div>}
        </div>
      ))}
    </div>
  )
}

function MoveButtons({ stage, onMove, onDelete }: { stage: number; onMove: (dir: 1 | -1) => void; onDelete: () => void }) {
  return (
    <div className="row" style={{ gap: 6 }}>
      <button className="mini" disabled={stage === 0} onClick={() => onMove(-1)} aria-label="Eine Spalte zurück">
        ‹
      </button>
      <button className="mini" disabled={stage === LAST_STAGE} onClick={() => onMove(1)} aria-label="Eine Spalte weiter">
        ›
      </button>
      <span className="grow" />
      <button className="mini" onClick={onDelete} aria-label="Löschen">
        ✕
      </button>
    </div>
  )
}

const questLine = (t: Task | undefined, today: string) => (t ? `▶ Quest ${t.date && t.date > today ? `am ${shortDate(t.date)}` : 'im Plan'}: ${t.title.split(':')[0]}` : undefined)

// ---------- Content ----------

function Content() {
  const data = useStore((s) => s.data)
  const { addContent, ideaToContent, startContent, moveContent, deleteContent, setBusiness } = useStore.getState()
  const [title, setTitle] = useState('')
  const [msg, setMsg] = useState('')
  const today = dateKey()
  const posted = postedThisWeek(data.content, today)
  const goal = data.profile.postGoal
  const active = activeCount(data.content)
  const hint = batchHint(data.content, data.settings.shootDay)
  const ideas = data.ideas.filter((i) => i.zone === 3 || i.zone === 6)
  const taskOf = (id: string) => data.tasks.find((t) => t.status === 'open' && t.card?.type === 'content' && t.card.id === id)

  const add = () => {
    if (!title.trim()) return
    addContent(title)
    setTitle('')
  }

  return (
    <div className="col gap-l" style={zoneStyle(3)}>
      <div className="card col">
        <div className="row between">
          <b>
            {posted} / {goal} Posts diese Woche
          </b>
          <span className="small muted">
            {active} / {data.settings.wipLimit} in Arbeit
          </span>
        </div>
        <div className="bar">
          <div style={{ width: `${Math.min(100, (posted / Math.max(1, goal)) * 100)}%` }} />
        </div>
        <div className="col" style={{ gap: 6 }}>
          <span className="tiny muted">Dreh-Tag {data.settings.shootDay !== undefined ? `· ${WEEKDAY_LONG[data.settings.shootDay]}` : '· noch keiner'}</span>
          <div className="chips">
            {DAY_ORDER.map((wd) => (
              <button key={wd} className={'chip' + (data.settings.shootDay === wd ? ' on' : '')} onClick={() => setBusiness({ shootDay: data.settings.shootDay === wd ? undefined : wd })}>
                {WEEKDAYS[wd]}
              </button>
            ))}
          </div>
        </div>
        {hint && <div className="notice">{hint}</div>}
      </div>

      <div className="row">
        <input value={title} onChange={(e) => setTitle(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && add()} placeholder="Neue Video-Idee …" />
        <button className="btn sm primary" disabled={!title.trim()} onClick={add}>
          +
        </button>
      </div>
      {msg && <div className="notice">{msg}</div>}

      <Board stages={CONTENT_STAGES} count={(s) => data.content.filter((c) => c.stage === s).length}>
        {(stage) =>
          data.content
            .filter((c) => c.stage === stage)
            .sort((a, b) => (b.postedAt ?? b.createdAt) - (a.postedAt ?? a.createdAt))
            .slice(0, stage === LAST_STAGE ? 6 : 50)
            .map((c) => (
              <div key={c.id} className="kcard">
                <div>{c.title}</div>
                {c.active && <div className="tiny muted">{questLine(taskOf(c.id), today) ?? 'in Arbeit'}</div>}
                {stage === 0 && !c.active && (
                  <button
                    className="btn sm primary"
                    onClick={() => setMsg(startContent(c.id) ? '' : `Du hast schon ${active} Stücke in Arbeit (Limit ${data.settings.wipLimit}). Bring erst eins zu Ende, sonst verzettelst du dich.`)}
                  >
                    Loslegen
                  </button>
                )}
                <MoveButtons stage={stage} onMove={(dir) => moveContent(c.id, dir)} onDelete={() => confirm(`„${c.title}“ löschen?`) && deleteContent(c.id)} />
              </div>
            ))
        }
      </Board>

      {ideas.length > 0 && (
        <div className="col" style={{ gap: 6 }}>
          <h3>Aus der Ideen-Truhe</h3>
          {ideas.map((i) => (
            <div key={i.id} className="branch">
              <span className="grow">💡 {i.text}</span>
              <button className="mini" onClick={() => ideaToContent(i.id)} aria-label="In die Pipeline">
                →
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ---------- Kunden ----------

function Clients() {
  const data = useStore((s) => s.data)
  const { addClient, moveClient, setClientAmount, clientInvoice, deleteClient } = useStore.getState()
  const [name, setName] = useState('')
  const [amount, setAmount] = useState('')
  const today = dateKey()
  const month = today.slice(0, 7)
  const open = data.clientCards.filter((c) => c.stage === 3)
  const paid = data.clientCards.filter((c) => c.paidAt && dateKey(new Date(c.paidAt)).startsWith(month))
  const sum = (list: typeof open) => list.reduce((s, c) => s + (c.amount ?? 0), 0)
  const taskOf = (id: string) => data.tasks.find((t) => t.status === 'open' && t.card?.type === 'client' && t.card.id === id)

  const add = () => {
    if (!name.trim()) return
    addClient(name, Number(amount) || undefined)
    setName('')
    setAmount('')
  }

  return (
    <div className="col gap-l" style={zoneStyle(5)}>
      <div className="card col" style={{ gap: 8 }}>
        <div className="row between">
          <span>Offene Rechnungen</span>
          <b>{eur(sum(open))}</b>
        </div>
        <div className="row between">
          <span>Bezahlt diesen Monat</span>
          <b>{eur(sum(paid))}</b>
        </div>
        <div className="row between">
          <span>Davon für die Steuer zurücklegen ({data.settings.taxRate} %)</span>
          <b style={{ color: 'var(--gold)' }}>{eur(taxReserve(sum(paid), data.settings.taxRate))}</b>
        </div>
      </div>

      <div className="row">
        <input value={name} onChange={(e) => setName(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && add()} placeholder="Neuer Lead (Name) …" />
        <input value={amount} onChange={(e) => setAmount(e.target.value)} type="number" inputMode="numeric" placeholder="€" style={{ width: 96 }} />
        <button className="btn sm primary" disabled={!name.trim()} onClick={add}>
          +
        </button>
      </div>

      <Board stages={CLIENT_STAGES} count={(s) => data.clientCards.filter((c) => c.stage === s).length}>
        {(stage) =>
          data.clientCards
            .filter((c) => c.stage === stage)
            .sort((a, b) => (b.paidAt ?? b.createdAt) - (a.paidAt ?? a.createdAt))
            .slice(0, stage === LAST_STAGE ? 6 : 50)
            .map((c) => {
              const late = isOverdue(c, today)
              const q = questLine(taskOf(c.id), today)
              return (
                <div key={c.id} className={'kcard' + (late ? ' late' : '')}>
                  <div className="row between">
                    <b>{c.name}</b>
                    <button className="tiny muted" onClick={() => { const v = prompt(`Betrag für ${c.name} in €`, String(c.amount ?? '')); if (v !== null) setClientAmount(c.id, Number(v.replace(/[^\d]/g, ''))) }}>
                      {c.amount ? eur(c.amount) : 'Betrag?'}
                    </button>
                  </div>
                  {q && <div className="tiny muted">{q}</div>}
                  {stage === 2 && !q && (
                    <button className="btn sm primary" onClick={() => clientInvoice(c.id)}>
                      Fertig → Rechnung schreiben
                    </button>
                  )}
                  {stage === 3 && (
                    <>
                      <div className="tiny" style={{ color: late ? 'var(--danger)' : 'var(--muted)' }}>
                        Rechnung vom {c.invoiceDate ? shortDate(c.invoiceDate) : '?'}
                        {late ? ` · überfällig seit ${overdueDays(c, today)} Tagen` : ''}
                      </div>
                      <button className="btn sm good" onClick={() => moveClient(c.id, 1)}>
                        Bezahlt ✓
                      </button>
                    </>
                  )}
                  <MoveButtons stage={stage} onMove={(dir) => moveClient(c.id, dir)} onDelete={() => confirm(`„${c.name}“ löschen?`) && deleteClient(c.id)} />
                </div>
              )
            })
        }
      </Board>
    </div>
  )
}

// ---------- Routinen & Regeln ----------

function Routines() {
  const data = useStore((s) => s.data)
  const { updateRecurring, setBusiness, addTaxDate, deleteTaxDate } = useStore.getState()
  const [title, setTitle] = useState('')
  const [date, setDate] = useState('')

  return (
    <div className="col gap-l" style={zoneStyle(4)}>
      <div className="col" style={{ gap: 10 }}>
        <h3>Jede Woche automatisch im Plan</h3>
        {data.recurring.map((r) => (
          <div key={r.id} className="card col" style={{ ...zoneStyle(r.zone), opacity: r.active ? 1 : 0.55 }}>
            <div className="row between">
              <b>{r.title}</b>
              <button className={'chip' + (r.active ? ' on' : '')} onClick={() => updateRecurring(r.id, { active: !r.active })}>
                {r.active ? 'An' : 'Aus'}
              </button>
            </div>
            <div className="chips">
              {DAY_ORDER.map((wd) => (
                <button key={wd} className={'chip' + (r.weekday === wd ? ' on' : '')} onClick={() => updateRecurring(r.id, { weekday: wd })}>
                  {WEEKDAYS[wd]}
                </button>
              ))}
            </div>
            <span className="tiny muted">{r.minutes} Min · kommt jeden {WEEKDAY_LONG[r.weekday]}</span>
          </div>
        ))}
      </div>

      <div className="card col">
        <Chips label="Steuer-Rücklage von jeder Einnahme" options={[20, 25, 30, 35, 40].map((v) => ({ v, label: `${v} %` }))} value={data.settings.taxRate} onChange={(v) => setBusiness({ taxRate: v })} />
        <p className="tiny muted">Sobald ein Kunde auf „Bezahlt“ steht, bekommst du eine Quest mit dem Betrag, den du zur Seite legst. Den richtigen Prozentsatz kennt dein Steuerberater.</p>
      </div>

      <div className="card col">
        <Chips label="Max. Videos gleichzeitig in Arbeit" options={[2, 3, 4, 5].map((v) => ({ v, label: String(v) }))} value={data.settings.wipLimit} onChange={(v) => setBusiness({ wipLimit: v })} />
      </div>

      <div className="card col">
        <h3>Steuer-Termine</h3>
        <p className="tiny muted">7 Tage vorher landet automatisch eine Quest im Plan.</p>
        {data.taxDates
          .slice()
          .sort((a, b) => a.date.localeCompare(b.date))
          .map((t) => (
            <div key={t.id} className="row small">
              <span className="grow">
                {t.title} · {parseKey(t.date).toLocaleDateString('de-DE')}
              </span>
              <button className="mini" onClick={() => deleteTaxDate(t.id)} aria-label="Löschen">
                ✕
              </button>
            </div>
          ))}
        <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="z. B. Umsatzsteuer-Voranmeldung Q4" />
        <div className="row">
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          <button
            className="btn sm primary"
            disabled={!title.trim() || !date}
            onClick={() => {
              addTaxDate(title, date)
              setTitle('')
              setDate('')
            }}
          >
            +
          </button>
        </div>
      </div>
    </div>
  )
}

export function Business() {
  const [tab, setTab] = useState<'content' | 'clients' | 'rules'>('content')
  return (
    <div className="screen">
      <div className="col gap-l">
        <div className="row between" style={{ flexWrap: 'wrap' }}>
          <h1>Business</h1>
          <div className="seg">
            {(
              [
                ['content', 'Content'],
                ['clients', 'Kunden'],
                ['rules', 'Routinen'],
              ] as const
            ).map(([id, label]) => (
              <button key={id} className={tab === id ? 'on' : ''} onClick={() => setTab(id)}>
                {label}
              </button>
            ))}
          </div>
        </div>
        {tab === 'content' && <Content />}
        {tab === 'clients' && <Clients />}
        {tab === 'rules' && (
          <div className="narrow">
            <Routines />
          </div>
        )}
      </div>
    </div>
  )
}
