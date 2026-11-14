import { useState } from 'react'
import { todayLog, useStore } from '../lib/store'
import { behindBy, currentBlock, nextBlocks } from '../lib/planner'
import { dateKey, fmt, niceDate, nowMin } from '../lib/date'
import { levelInfo } from '../lib/xp'
import type { Modal } from '../App'
import { ZoneBadge, buzz, zoneStyle } from '../ui'

export const isZoneQuest = (title: string): number | null => {
  const m = /^Zone (\d) erkunden/.exec(title)
  return m ? Number(m[1]) : null
}

export function XpBar() {
  const char = useStore((s) => s.data.char)
  const li = levelInfo(char.xp)
  return (
    <div className="col" style={{ gap: 6 }}>
      <div className="row between small">
        <span>
          <b>Level {li.level}</b> <span className="muted">· {li.title}</span>
        </span>
        <span className="muted num">
          {li.into} / {li.need} XP
        </span>
      </div>
      <div className="bar gold">
        <div style={{ width: `${(li.into / li.need) * 100}%` }} />
      </div>
    </div>
  )
}

const NONE: string[] = []

export function Dailies() {
  const dailies = useStore((s) => s.data.dailies)
  const done = useStore((s) => s.data.days[dateKey()]?.dailiesDone) ?? NONE
  const toggle = useStore((s) => s.toggleDaily)
  return (
    <div className="col" style={{ gap: 8 }}>
      <h3>Daily Quests</h3>
      {dailies.map((d) => {
        const on = done.includes(d.id)
        return (
          <button
            key={d.id}
            className="row card"
            style={{ ...zoneStyle(d.zone), padding: '12px 14px', textAlign: 'left', opacity: on ? 0.55 : 1 }}
            onClick={() => {
              buzz()
              toggle(d.id)
            }}
          >
            <span className={'check' + (on ? ' on' : '')}>✓</span>
            <span className="grow" style={{ textDecoration: on ? 'line-through' : 'none' }}>
              {d.title}
            </span>
          </button>
        )
      })}
    </div>
  )
}

export function Now({ open }: { open: (m: Modal) => void }) {
  const data = useStore((s) => s.data)
  const { completeTask, doneBlock, replan, startTask } = useStore.getState()
  const [note, setNote] = useState('')
  const [msg, setMsg] = useState('')

  const today = dateKey()
  const log = todayLog(data)
  const plan = data.plans[today]
  const cur = currentBlock(plan, log.blocksDone)
  const next = nextBlocks(plan, log.blocksDone, 2)
  const behind = behindBy(plan, log.blocksDone, nowMin())
  const task = cur?.taskId ? data.tasks.find((t) => t.id === cur.taskId) : undefined
  const zoneQuest = task ? isZoneQuest(task.title) : null
  const breakdownId = task?.breakdownGoalId
  const chainNode = task?.goalNodeId ? data.nodes.find((n) => n.id === task.goalNodeId) : undefined
  const chainGoal = chainNode ? data.goals.find((g) => g.id === chainNode.goalId) : undefined
  const step = task ? task.steps[Math.min(task.stepsDone, task.steps.length - 1)] : undefined
  const backupDue = data.profile.startDate < today && Date.now() - (data.settings.lastBackupAt ?? 0) > 7 * 86400000 && Object.keys(data.days).length > 6

  const doReplan = () => {
    const moved = replan()
    setMsg(moved ? `Plan angepasst. ${moved} Aufgabe${moved > 1 ? 'n' : ''} auf morgen geschoben. Alles gut.` : 'Plan angepasst. Weiter geht’s.')
  }

  const start = (minutes: number) => {
    if (!task) return
    buzz()
    startTask(task.id)
    if (zoneQuest) return open({ k: 'interview', zone: zoneQuest as 1 })
    if (breakdownId) return open({ k: 'breakdown', goalId: breakdownId })
    open({ k: 'timer', taskId: task.id, minutes })
  }

  return (
    <div className="screen">
      <div className="narrow col gap-l">
        <div className="row between">
          <div>
            <h2>Hey {data.profile.name}</h2>
            <p className="muted small">{niceDate(today)}</p>
          </div>
          <div className="statline">
            <span>
              🔥 <b className="num">{data.char.streak}</b>
            </span>
            <span>
              🪙 <b className="num">{data.char.coins}</b>
            </span>
          </div>
        </div>

        {data.char.comebackPending && (
          <div className="notice">
            <b>Comeback-Quest:</b> Schön, dass du wieder da bist. Die nächste erledigte Quest gibt +25 Bonus-XP.
          </div>
        )}

        {!log.checkinDone ? (
          <div className="hero" style={zoneStyle(8)}>
            <div className="time">Jetzt</div>
            <h1>Morgen-Check-in</h1>
            <p className="muted" style={{ marginBottom: 16 }}>
              Zwei Antipper, dann steht dein Tag.
            </p>
            <button className="btn primary big" onClick={() => open({ k: 'checkin' })}>
              Check-in starten
            </button>
          </div>
        ) : cur ? (
          <div className="hero col" style={zoneStyle(cur.zone)}>
            <div className="row between" style={{ flexWrap: 'wrap' }}>
              <span className="time num">
                {fmt(cur.start)} – {fmt(cur.end)}
              </span>
              <span className="row" style={{ gap: 6 }}>
                {cur.frog && <span className="tag frog">🐸 Frosch</span>}
                {cur.main && <span className="tag main">Main Quest</span>}
                {log.minimal && <span className="tag">Minimal-Tag</span>}
              </span>
            </div>
            <h1 style={{ margin: 0 }}>{cur.title}</h1>
            {cur.zone && <ZoneBadge id={cur.zone} />}
            {chainGoal && <p className="small muted">🎯 Schritt für dein Ziel: <b>{chainGoal.title}</b></p>}

            {task && step && (
              <div className="step">
                <b>{task.stepsDone === 0 ? 'Erster Mini-Schritt (2 Min)' : `Schritt ${Math.min(task.stepsDone + 1, task.steps.length)} von ${task.steps.length}`}</b>
                {step}
              </div>
            )}

            {task ? (
              <>
                <button className="btn primary big" onClick={() => start(Math.min(cur.end - cur.start, data.settings.focusMinutes))}>
                  {zoneQuest ? 'Interview starten' : breakdownId ? 'Zerlegen starten' : task.startedAt ? 'Weitermachen' : 'Starten'}
                </button>
                {!zoneQuest && !breakdownId && (
                  <div className="row">
                    <button className="btn" onClick={() => start(5)}>
                      Nur 5 Minuten
                    </button>
                    <button
                      className="btn good"
                      onClick={() => {
                        buzz([10, 40, 20])
                        completeTask(task.id)
                      }}
                    >
                      Erledigt
                    </button>
                  </div>
                )}
                <button className="btn ghost sm" style={{ alignSelf: 'center' }} onClick={() => open({ k: 'later', taskId: task.id })}>
                  Später
                </button>
              </>
            ) : cur.type === 'shutdown' ? (
              <button className="btn primary big" onClick={() => open({ k: 'shutdown' })}>
                Shutdown starten
              </button>
            ) : (
              <>
                {cur.type === 'training' && <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Kurze Notiz (optional)" />}
                <button
                  className="btn good big"
                  onClick={() => {
                    buzz([10, 40, 20])
                    doneBlock(cur.id, note || undefined)
                    setNote('')
                  }}
                >
                  Erledigt
                </button>
              </>
            )}
          </div>
        ) : (
          <div className="hero center" style={zoneStyle(8)}>
            <h1>{log.shutdownDone ? 'Feierabend.' : 'Alles geschafft!'}</h1>
            <p className="muted" style={{ margin: '8px 0 16px' }}>
              {log.shutdownDone ? 'Bildschirm aus. Morgen steht dein Plan schon.' : 'Der Rest des Tages ist Puffer. Fehlt nur noch der Shutdown.'}
            </p>
            {!log.shutdownDone && (
              <button className="btn primary big" onClick={() => open({ k: 'shutdown' })}>
                Shutdown starten
              </button>
            )}
          </div>
        )}

        {log.checkinDone && behind >= 15 && (
          <div className="notice col">
            <span>Du bist {behind} Minuten hinter dem Plan. Kein Drama, das lässt sich umbauen.</span>
            <button className="btn sm" onClick={doReplan}>
              Plan neu berechnen
            </button>
          </div>
        )}
        {msg && <p className="muted small center">{msg}</p>}

        {log.checkinDone && next.length > 0 && (
          <div className="col" style={{ gap: 6 }}>
            <h3>Danach</h3>
            {next.map((b) => (
              <div key={b.id} className="row small" style={zoneStyle(b.zone)}>
                <span className="muted num" style={{ width: 44 }}>
                  {fmt(b.start)}
                </span>
                <i style={{ width: 8, height: 8, borderRadius: 4, background: 'var(--zone)', flex: 'none' }} />
                <span>{b.title}</span>
              </div>
            ))}
          </div>
        )}

        <XpBar />
        <Dailies />

        {backupDue && (
          <div className="notice">
            Dein letztes Backup ist über eine Woche her. Unter <b>Ich → Backup</b> dauert das 5 Sekunden.
          </div>
        )}

        <button className="btn ghost" onClick={() => open({ k: 'panic' })}>
          Alles zu viel
        </button>
      </div>
    </div>
  )
}
