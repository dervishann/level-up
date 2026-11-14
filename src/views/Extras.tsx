import { useState } from 'react'
import { useStore } from '../lib/store'
import { FREEZE_COST } from '../lib/xp'
import { estimateFactor } from '../lib/planner'
import { weekStart } from '../lib/pipelines'
import { addDays, dateKey, WEEKDAYS, weekdayOf } from '../lib/date'
import { ZONES } from '../lib/zones'
import { Chips, zoneStyle } from '../ui'

// ---------- Reward-Shop ----------

export function Shop() {
  const data = useStore((s) => s.data)
  const { buyReward, addReward, deleteReward, buyFreeze } = useStore.getState()
  const [title, setTitle] = useState('')
  const [cost, setCost] = useState(30)
  const [msg, setMsg] = useState('')
  const coins = data.char.coins
  const freezeBlocked = data.freezes >= 1 ? 'Du hast schon einen auf Vorrat' : data.freezeWeek === weekStart(dateKey()) ? 'Diese Woche schon gekauft' : coins < FREEZE_COST ? `Noch ${FREEZE_COST - coins} Coins` : ''

  return (
    <div className="col gap-l">
      <div className="card row between">
        <span>Dein Guthaben</span>
        <b style={{ fontSize: 22 }}>🪙 {coins}</b>
      </div>
      {msg && <div className="notice">{msg}</div>}

      <div className="col" style={{ gap: 8 }}>
        <h3>Belohnungen</h3>
        {data.rewards.length === 0 && <p className="muted small">Noch keine Belohnung. Leg unten eine an, auf die du wirklich Lust hast.</p>}
        {data.rewards
          .slice()
          .sort((a, b) => a.cost - b.cost)
          .map((r) => {
            const can = coins >= r.cost
            return (
              <div key={r.id} className="card row">
                <div className="grow">
                  <div>{r.title}</div>
                  <div className="tiny muted">{can ? `${r.cost} Coins` : `${r.cost} Coins · noch ${r.cost - coins}`}</div>
                </div>
                <button
                  className="btn sm primary"
                  disabled={!can}
                  onClick={() => {
                    if (!confirm(`„${r.title}“ für ${r.cost} Coins einlösen?`)) return
                    if (buyReward(r.id)) setMsg(`Eingelöst: ${r.title}. Hast du dir verdient. Genieß es ohne schlechtes Gewissen.`)
                  }}
                >
                  Einlösen
                </button>
                <button className="mini" onClick={() => confirm(`„${r.title}“ aus dem Shop entfernen?`) && deleteReward(r.id)} aria-label="Entfernen">
                  ✕
                </button>
              </div>
            )
          })}
      </div>

      <div className="card col">
        <div className="row">
          <div className="grow">
            <div>🧊 Streak-Freeze {data.freezes > 0 && <span className="tag main">1 auf Vorrat</span>}</div>
            <div className="tiny muted">Rettet deinen Streak an einem verpassten Tag. Max. 1 pro Woche. {FREEZE_COST} Coins.</div>
          </div>
          <button className="btn sm" disabled={!!freezeBlocked} onClick={() => buyFreeze() && setMsg('Streak-Freeze gekauft. Er wird automatisch eingesetzt, wenn du einen Tag verpasst.')}>
            Kaufen
          </button>
        </div>
        {freezeBlocked && <span className="tiny muted">{freezeBlocked}</span>}
      </div>

      <div className="card col">
        <h3>Neue Belohnung</h3>
        <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="z. B. Kinoabend" />
        <Chips options={[15, 30, 60, 120, 200].map((v) => ({ v, label: `${v} Coins` }))} value={cost} onChange={setCost} />
        <p className="tiny muted">Richtwert: An einem guten Tag verdienst du 15 bis 25 Coins. Klein = 15 bis 30, groß = 100 bis 200.</p>
        <button
          className="btn"
          disabled={!title.trim()}
          onClick={() => {
            addReward(title, cost)
            setTitle('')
          }}
        >
          Hinzufügen
        </button>
      </div>

      {data.purchases.length > 0 && (
        <div className="col" style={{ gap: 6 }}>
          <h3>Zuletzt eingelöst</h3>
          {data.purchases.slice(0, 5).map((p) => (
            <div key={p.id} className="row between small muted">
              <span>{p.title}</span>
              <span>
                {new Date(p.at).toLocaleDateString('de-DE')} · {p.cost} Coins
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ---------- Statistik (Woche) ----------

export function Stats() {
  const data = useStore((s) => s.data)
  const today = dateKey()
  const start = weekStart(today)
  const days = Array.from({ length: 7 }, (_, i) => addDays(start, i))
  const doneThisWeek = data.tasks.filter((t) => t.status === 'done' && t.doneAt && dateKey(new Date(t.doneAt)) >= start)
  const xpByDay = days.map((d) => data.days[d]?.xp ?? 0)
  const maxXp = Math.max(50, ...xpByDay)
  const focusMin = days.reduce((s, d) => s + (data.days[d]?.focusMin ?? 0), 0)
  const mains = days.reduce((s, d) => s + (data.days[d]?.mainsDone ?? 0), 0)
  const shutdowns = days.filter((d) => data.days[d]?.shutdownDone).length
  const byZone = ZONES.map((z) => ({ z, min: doneThisWeek.filter((t) => t.zone === z.id).reduce((s, t) => s + (t.actualMinutes || t.minutes), 0) })).filter((x) => x.min > 0)
  const maxZone = Math.max(1, ...byZone.map((x) => x.min))
  const timed = data.tasks.filter((t) => t.status === 'done' && t.actualMinutes >= 5 && t.minutes > 0).slice(-20)
  const factor = estimateFactor(data.tasks)
  const hours = (m: number) => (m >= 60 ? `${(m / 60).toLocaleString('de-DE', { maximumFractionDigits: 1 })} Std` : `${m} Min`)

  const tiles: [string, string][] = [
    ['Quests erledigt', String(doneThisWeek.length)],
    ['Main Quests', String(mains)],
    ['Fokus-Zeit', hours(focusMin)],
    ['Shutdowns', `${shutdowns} / 7`],
    ['XP diese Woche', String(xpByDay.reduce((a, b) => a + b, 0))],
    ['Streak', `${data.char.streak} Tage`],
  ]

  return (
    <div className="col gap-l">
      <h3>Diese Woche</h3>
      <div className="tiles">
        {tiles.map(([label, value]) => (
          <div key={label} className="card">
            <div className="tiny muted">{label}</div>
            <b style={{ fontSize: 22 }}>{value}</b>
          </div>
        ))}
      </div>

      <div className="card col">
        <h3>XP pro Tag</h3>
        <div className="bars">
          {days.map((d, i) => (
            <div key={d} className="col" style={{ gap: 4, alignItems: 'center', flex: 1 }}>
              <span className="tiny muted num">{xpByDay[i] || ''}</span>
              <div className="vbar">
                <div style={{ height: `${(xpByDay[i] / maxXp) * 100}%`, opacity: d === today ? 1 : 0.6 }} />
              </div>
              <span className="tiny" style={{ fontWeight: d === today ? 700 : 400 }}>
                {WEEKDAYS[weekdayOf(d)]}
              </span>
            </div>
          ))}
        </div>
      </div>

      <div className="card col">
        <h3>Zeit pro Zone</h3>
        {byZone.length === 0 && <p className="muted small">Noch nichts erledigt diese Woche.</p>}
        {byZone
          .sort((a, b) => b.min - a.min)
          .map(({ z, min }) => (
            <div key={z.id} className="col" style={{ gap: 4, ...zoneStyle(z.id) }}>
              <div className="row between small">
                <span>
                  <b style={{ color: 'var(--zone)' }}>{z.id}</b> {z.name}
                </span>
                <span className="muted num">{hours(min)}</span>
              </div>
              <div className="bar">
                <div style={{ width: `${(min / maxZone) * 100}%` }} />
              </div>
            </div>
          ))}
      </div>
      <div className="card col">
        <h3>Zeitschätzung</h3>
        {timed.length < 5 ? (
          <p className="muted small">Noch zu wenig Daten. Sobald du 5 Aufgaben mit dem Timer erledigt hast ({timed.length} bisher), lernt der Plan, wie lange du wirklich brauchst.</p>
        ) : (
          <p className="small">
            Du brauchst im Schnitt <b>{Math.round((timed.reduce((a, t) => a + t.actualMinutes, 0) / timed.reduce((a, t) => a + t.minutes, 0)) * 100)} %</b> der geschätzten Zeit. Dein Tagesplan rechnet deshalb mit Faktor{' '}
            <b>{factor.toLocaleString('de-DE')}</b>.
          </p>
        )}
      </div>
      <p className="tiny muted center">Heatmap und der Wochenbericht am Sonntag kommen noch.</p>
    </div>
  )
}

// ---------- Wenn-Dann-Pläne ----------

const WHEN = ['ich nach dem Mittagessen aufs Handy will', 'ich eine Aufgabe vor mir herschiebe', 'ich morgens nicht aus dem Bett komme', 'ich abends noch arbeiten will', 'ich nicht weiß, womit ich anfangen soll']
const THEN = ['starte ich den 5-Minuten-Timer', 'lege ich das Handy in einen anderen Raum', 'mache ich nur den ersten Mini-Schritt', 'stehe ich auf und trinke ein Glas Wasser', 'öffne ich die App und mache, was oben steht']

export function IfThen() {
  const rules = useStore((s) => s.data.ifThen)
  const { addIfThen, deleteIfThen } = useStore.getState()
  const [when, setWhen] = useState('')
  const [then, setThen] = useState('')
  return (
    <div className="card col">
      <h3>Wenn-Dann-Pläne</h3>
      <p className="tiny muted">Leg vorher fest, was du in deinen typischen Kipp-Momenten tust. Die App zeigt dir die Regel, wenn du eine Aufgabe verschieben willst.</p>
      {rules.map((r) => (
        <div key={r.id} className="branch">
          <span className="grow">
            <b>Wenn</b> {r.when}, <b>dann</b> {r.then}.
          </span>
          <button className="mini" onClick={() => deleteIfThen(r.id)} aria-label="Löschen">
            ✕
          </button>
        </div>
      ))}
      <Chips label="Wenn …" stack options={WHEN.map((v) => ({ v, label: v }))} value={when} onChange={setWhen} />
      <input value={when} onChange={(e) => setWhen(e.target.value)} placeholder="Eigene Situation …" />
      <Chips label="dann …" stack options={THEN.map((v) => ({ v, label: v }))} value={then} onChange={setThen} />
      <input value={then} onChange={(e) => setThen(e.target.value)} placeholder="Eigene Reaktion …" />
      <button
        className="btn primary"
        disabled={!when.trim() || !then.trim()}
        onClick={() => {
          addIfThen(when, then)
          setWhen('')
          setThen('')
        }}
      >
        Regel speichern
      </button>
    </div>
  )
}
