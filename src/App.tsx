import { useEffect, useMemo, useState } from 'react'
import { todayLog, useStore } from './lib/store'
import { currentBlock } from './lib/planner'
import type { ZoneId } from './lib/types'
import { Onboarding } from './views/Onboarding'
import { Now } from './views/Now'
import { Plan } from './views/Plan'
import { Interview, MapView } from './views/MapView'
import { Me } from './views/Me'
import { Breakdown } from './views/Goals'
import { Business } from './views/Business'
import { LifeDump } from './views/LifeDump'
import { Checkin, InboxSheet, LaterSheet, Panic, Shutdown, SortOverlay, Timer } from './views/Flows'

export type Modal =
  | null
  | { k: 'inbox' }
  | { k: 'sort' }
  | { k: 'checkin' }
  | { k: 'shutdown' }
  | { k: 'panic' }
  | { k: 'interview'; zone: ZoneId }
  | { k: 'timer'; taskId: string; minutes: number }
  | { k: 'later'; taskId: string }
  | { k: 'breakdown'; goalId: string }
  | { k: 'dump'; text?: string; inboxIds?: string[] }

type Tab = 'now' | 'plan' | 'biz' | 'map' | 'me'
const TABS: { id: Tab; ico: string; label: string }[] = [
  { id: 'now', ico: '⚡', label: 'Jetzt' },
  { id: 'plan', ico: '🗓️', label: 'Plan' },
  { id: 'biz', ico: '💼', label: 'Business' },
  { id: 'map', ico: '🗺️', label: 'Karte' },
  { id: 'me', ico: '🛡️', label: 'Ich' },
]

const COLORS = ['#8b5cf6', '#ec4899', '#f97316', '#22c55e', '#3b82f6', '#06b6d4', '#ef4444', '#eab308']

function Feedback() {
  const fx = useStore((s) => s.fx)
  const clearFx = useStore((s) => s.clearFx)
  const [level, setLevel] = useState<{ n: number; title: string } | null>(null)
  const [loot, setLoot] = useState<{ id: number; text: string } | null>(null)

  useEffect(() => {
    if (!fx) return
    if (fx.levelUp) setLevel({ n: fx.levelUp, title: fx.title ?? '' })
    if (fx.loot) setLoot({ id: fx.id, text: fx.loot.coins ? `+${fx.loot.coins} Coins` : `+${fx.loot.xp} XP` })
    const t = setTimeout(clearFx, 2200)
    return () => clearTimeout(t)
  }, [fx, clearFx])

  const confetti = useMemo(
    () =>
      Array.from({ length: 60 }, (_, i) => ({
        left: `${Math.random() * 100}%`,
        background: COLORS[i % COLORS.length],
        animationDuration: `${1.6 + Math.random() * 1.8}s`,
        animationDelay: `${Math.random() * 0.5}s`,
      })),
    [level],
  )

  return (
    <>
      {fx && (
        <div className="toast" key={fx.id}>
          <span>+{fx.xp} XP</span> · {fx.label}
        </div>
      )}
      {loot && (
        <div className="loot" key={loot.id} onAnimationEnd={(e) => e.target === e.currentTarget && setLoot(null)}>
          <div className="chest">🎁</div>
          <b>Loot-Truhe!</b>
          <span>{loot.text}</span>
        </div>
      )}
      {level && (
        <>
          <div className="levelup" onClick={() => setLevel(null)}>
            <div className="col">
              <h3>Level Up!</h3>
              <div className="big">Level {level.n}</div>
              <h2>{level.title}</h2>
              <p className="muted small">Tippen zum Weitermachen</p>
            </div>
          </div>
          <div className="confetti">
            {confetti.map((c, i) => (
              <i key={i} style={c} />
            ))}
          </div>
        </>
      )}
    </>
  )
}

export default function App() {
  const onboarded = useStore((s) => s.data.profile.onboarded)
  const theme = useStore((s) => s.data.settings.theme)
  const inboxCount = useStore((s) => s.data.inbox.length)
  const ensureToday = useStore((s) => s.ensureToday)
  const [tab, setTab] = useState<Tab>('now')
  const [modal, setModal] = useState<Modal>(null)
  const [, tick] = useState(0)

  useEffect(() => {
    document.documentElement.dataset.theme = theme
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', theme === 'dark' ? '#0e0f14' : '#f4f5f9')
  }, [theme])

  // Tageswechsel prüfen: beim Start, beim Zurückkommen in die App und jede Minute.
  useEffect(() => {
    const check = () => {
      ensureToday()
      tick((n) => n + 1)
    }
    check()
    const i = setInterval(check, 60000)
    const vis = () => document.visibilityState === 'visible' && check()
    document.addEventListener('visibilitychange', vis)
    return () => {
      clearInterval(i)
      document.removeEventListener('visibilitychange', vis)
    }
  }, [ensureToday, onboarded])

  const close = () => setModal(null)

  if (!onboarded) return <Onboarding onDone={() => setModal({ k: 'interview', zone: 1 })} />

  const panicStep = () => {
    const d = useStore.getState().data
    const cur = currentBlock(d.plans[d.lastDate], todayLog(d).blocksDone)
    const t = cur?.taskId ? d.tasks.find((x) => x.id === cur.taskId) : undefined
    return t ? t.steps[Math.min(t.stepsDone, t.steps.length - 1)] : cur?.title
  }

  return (
    <div className="app">
      {tab === 'now' && <Now open={setModal} />}
      {tab === 'plan' && <Plan open={setModal} />}
      {tab === 'biz' && <Business />}
      {tab === 'map' && <MapView open={setModal} />}
      {tab === 'me' && <Me />}

      <button className="fab" onClick={() => setModal({ k: 'inbox' })} aria-label="In die Inbox schreiben">
        +{inboxCount > 0 && <span className="badge">{inboxCount}</span>}
      </button>

      <nav className="tabs">
        {TABS.map((t) => (
          <button key={t.id} className={tab === t.id ? 'on' : ''} onClick={() => setTab(t.id)}>
            <span className="ico">{t.ico}</span>
            {t.label}
          </button>
        ))}
      </nav>

      {modal?.k === 'inbox' && <InboxSheet onClose={close} onSort={() => setModal({ k: 'sort' })} onDump={() => setModal({ k: 'dump' })} />}
      {modal?.k === 'sort' && <SortOverlay onClose={close} onBreakdown={(goalId) => setModal({ k: 'breakdown', goalId })} onDump={(text, inboxIds) => setModal({ k: 'dump', text, inboxIds })} />}
      {modal?.k === 'dump' && <LifeDump onClose={close} initialText={modal.text} inboxIds={modal.inboxIds} />}
      {modal?.k === 'checkin' && <Checkin onClose={close} />}
      {modal?.k === 'shutdown' && <Shutdown onClose={close} />}
      {modal?.k === 'panic' && <Panic onClose={close} small={panicStep()} />}
      {modal?.k === 'interview' && <Interview zone={modal.zone} onClose={close} />}
      {modal?.k === 'timer' && <Timer taskId={modal.taskId} minutes={modal.minutes} onClose={close} />}
      {modal?.k === 'later' && <LaterSheet taskId={modal.taskId} onClose={close} />}

      {modal?.k === 'breakdown' && <Breakdown goalId={modal.goalId} onClose={close} />}

      <Feedback />
    </div>
  )
}
