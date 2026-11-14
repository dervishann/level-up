import { Fragment, useState } from 'react'
import { todayLog, useStore } from '../lib/store'
import { currentBlock } from '../lib/planner'
import { addDays, dateKey, fmt } from '../lib/date'
import type { Block } from '../lib/types'
import { planToIcs } from '../lib/ics'
import type { Modal } from '../App'
import { buzz, zoneStyle } from '../ui'

export function Plan({ open }: { open: (m: Modal) => void }) {
  const data = useStore((s) => s.data)
  const { completeTask, doneBlock, replan, deleteTask } = useStore.getState()
  const [msg, setMsg] = useState('')
  const today = dateKey()
  const tomorrow = addDays(today, 1)
  const log = todayLog(data)
  const plan = data.plans[today]
  const cur = currentBlock(plan, log.blocksDone)
  const planned = new Set((plan?.blocks ?? []).map((b) => b.taskId))
  const loose = data.tasks.filter((t) => t.status === 'open' && !planned.has(t.id))
  const doneToday = data.tasks.filter((t) => t.status === 'done' && t.doneAt && dateKey(new Date(t.doneAt)) === today)

  const check = (b: Block) => {
    if (log.blocksDone.includes(b.id)) return
    buzz()
    if (b.type === 'shutdown') return open({ k: 'shutdown' })
    if (b.id === 'routine-morning' && !log.checkinDone) return open({ k: 'checkin' })
    if (b.taskId) return completeTask(b.taskId)
    doneBlock(b.id)
  }

  // Tagesplan (heute + morgen, falls schon geplant) als .ics-Datei: teilen auf dem Handy, Download am Laptop.
  const exportCalendar = async () => {
    const now = new Date().getHours() * 60 + new Date().getMinutes()
    const plans = [plan && { ...plan, blocks: plan.blocks.filter((b) => !log.blocksDone.includes(b.id) && b.end > now) }, data.plans[tomorrow]].filter((p): p is NonNullable<typeof p> => !!p)
    const file = new File([planToIcs(plans)], `level-up-${today}.ics`, { type: 'text/calendar' })
    try {
      if (navigator.canShare?.({ files: [file] })) {
        await navigator.share({ files: [file], title: 'Level Up Tagesplan' })
        return setMsg('Wähle im Teilen-Menü „Kalender“, um die Termine zu übernehmen.')
      }
    } catch {
      return // Teilen abgebrochen
    }
    const a = document.createElement('a')
    a.href = URL.createObjectURL(file)
    a.download = file.name
    a.click()
    URL.revokeObjectURL(a.href)
    setMsg('Datei geladen. Ein Doppelklick öffnet sie in deinem Kalender.')
  }

  const when = (d?: string) => (!d ? 'irgendwann' : d <= today ? 'heute, nicht eingeplant' : d === tomorrow ? 'morgen' : d)

  return (
    <div className="screen">
      <div className="narrow col gap-l">
        <div className="row between">
          <div>
            <h1>Tagesplan</h1>
            <p className="muted small">
              {plan ? `${Math.round(plan.plannedRatio * 100)} % der freien Zeit verplant, der Rest ist Puffer` : 'Noch kein Plan'}
              {log.minimal ? ' · Minimal-Tag' : ''}
            </p>
          </div>
        </div>

        <div className="tl">
          {plan?.blocks.map((b, i) => {
            const done = log.blocksDone.includes(b.id)
            const prev = plan.blocks[i - 1]
            const gap = prev ? b.start - prev.end : 0
            return (
              <Fragment key={b.id}>
                {gap >= 20 && <div className="tl-gap">Puffer · {gap} Min</div>}
                <div className={'tl-item' + (done ? ' done' : '') + (cur?.id === b.id ? ' cur' : '') + (b.type === 'break' ? ' brk' : '')} style={zoneStyle(b.zone)}>
                  <div className="tl-time num">{fmt(b.start)}</div>
                  <div className="tl-body">
                    {b.type === 'break' ? (
                      <span>Pause · {b.end - b.start} Min</span>
                    ) : (
                      <>
                        <button className={'check' + (done ? ' on' : '')} onClick={() => check(b)} aria-label="Abhaken">
                          ✓
                        </button>
                        <div className="grow">
                          <div className="tl-title">{b.title}</div>
                          <div className="tiny muted">
                            {b.end - b.start} Min{b.frog ? ' · 🐸 Frosch' : b.main ? ' · Main Quest' : ''}
                          </div>
                        </div>
                      </>
                    )}
                  </div>
                </div>
              </Fragment>
            )
          })}
        </div>

        <button className="btn" onClick={exportCalendar}>
          In meinen Kalender exportieren
        </button>

        <button
          className="btn"
          onClick={() => {
            const moved = replan()
            setMsg(moved ? `${moved} Aufgabe${moved > 1 ? 'n' : ''} auf morgen geschoben. Der Rest passt jetzt.` : 'Plan ab jetzt neu gebaut.')
          }}
        >
          Plan neu berechnen
        </button>
        {msg && <p className="muted small center">{msg}</p>}

        {loose.length > 0 && (
          <div className="col" style={{ gap: 8 }}>
            <h3>Nicht eingeplant</h3>
            {loose.map((t) => (
              <div key={t.id} className="card row" style={{ ...zoneStyle(t.zone), padding: '10px 14px', borderLeft: '4px solid var(--zone)' }}>
                <div className="grow">
                  <div>{t.title}</div>
                  <div className="tiny muted">
                    {t.minutes} Min · {when(t.date)}
                  </div>
                </div>
                <button className="btn sm ghost" onClick={() => completeTask(t.id)}>
                  ✓
                </button>
                <button className="btn sm ghost danger" onClick={() => confirm(`„${t.title}“ löschen?`) && deleteTask(t.id)}>
                  ✕
                </button>
              </div>
            ))}
          </div>
        )}

        {doneToday.length > 0 && (
          <div className="col" style={{ gap: 6 }}>
            <h3>Heute erledigt</h3>
            {doneToday.map((t) => (
              <div key={t.id} className="small muted">
                ✓ {t.title}
              </div>
            ))}
          </div>
        )}

        {data.inbox.length > 0 && (
          <button className="btn" onClick={() => open({ k: 'sort' })}>
            Inbox sortieren ({data.inbox.length})
          </button>
        )}
      </div>
    </div>
  )
}
