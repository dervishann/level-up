import { useEffect, useMemo, useRef, useState } from 'react'
import { todayLog, useStore } from '../lib/store'
import { pickMains } from '../lib/planner'
import { addDays, dateKey } from '../lib/date'
import { LATER_REASONS, looksLikeIdea, REFLECTION_CHIPS, suggestDread, suggestKind, suggestMinutes, suggestZone } from '../lib/suggest'
import { ZONES } from '../lib/zones'
import type { InboxItem, Level3, ZoneId } from '../lib/types'
import { Chips, Overlay, Progress, Scale, Sheet, ZoneBadge, buzz, zoneStyle } from '../ui'

// ---------- Inbox: alles reinkippen ----------

export function InboxSheet({ onClose, onSort, onDump }: { onClose: () => void; onSort: () => void; onDump: () => void }) {
  const add = useStore((s) => s.addInbox)
  const count = useStore((s) => s.data.inbox.length)
  const [text, setText] = useState('')
  const ref = useRef<HTMLTextAreaElement>(null)
  useEffect(() => ref.current?.focus(), [])
  const save = () => {
    if (!text.trim()) return
    add(text)
    setText('')
    buzz()
    ref.current?.focus()
  }
  return (
    <Sheet onClose={onClose}>
      <div className="row between">
        <h2>Raus aus dem Kopf</h2>
        <button className="x" onClick={onClose} aria-label="Schließen">
          ✕
        </button>
      </div>
      <textarea ref={ref} value={text} onChange={(e) => setText(e.target.value)} placeholder="Aufgabe, Idee, Termin, Gedanke … Eine Zeile pro Sache. Sortiert wird später." />
      <button className="btn primary" disabled={!text.trim()} onClick={save}>
        Rein damit
      </button>
      <button className="btn" onClick={onDump}>
        🧠 Life Dump: alles auf einmal rausschreiben
      </button>
      {count > 0 && (
        <button className="btn ghost" onClick={onSort}>
          {count} in der Inbox · jetzt sortieren
        </button>
      )}
    </Sheet>
  )
}

// ---------- Inbox sortieren: App schlägt vor, du bestätigst ----------

type When = 'heute' | 'morgen' | 'irgendwann'

export function SortItem({ item, onBreakdown }: { item: InboxItem; onBreakdown?: (goalId: string) => void }) {
  const { inboxToTask, inboxToIdea, inboxToGoal, removeInbox } = useStore.getState()
  const [zone, setZone] = useState<ZoneId>(() => suggestZone(item.text))
  const [minutes, setMinutes] = useState(() => suggestMinutes(item.text))
  const [priority, setPriority] = useState<Level3>(2)
  const [dread, setDread] = useState<Level3>(() => suggestDread(item.text))
  const [when, setWhen] = useState<When>('morgen')
  const idea = looksLikeIdea(item.text)
  const today = dateKey()

  const asTask = () => {
    buzz()
    inboxToTask(item.id, {
      title: item.text,
      zone,
      minutes,
      priority,
      dread,
      kind: suggestKind(item.text, minutes),
      date: when === 'heute' ? today : when === 'morgen' ? addDays(today, 1) : undefined,
    })
  }

  return (
    <div className="col gap-l" style={zoneStyle(zone)}>
      <div className="card" style={{ borderLeft: '5px solid var(--zone)' }}>
        <h2>{item.text}</h2>
      </div>
      <div className="col" style={{ gap: 6 }}>
        <h3>Zone</h3>
        <div className="chips">
          {ZONES.map((z) => (
            <button key={z.id} className={'chip' + (zone === z.id ? ' on' : '')} style={zoneStyle(z.id)} onClick={() => setZone(z.id)}>
              <b style={{ color: z.color }}>{z.id}</b> {z.short}
            </button>
          ))}
        </div>
      </div>
      <Chips label="Dauer" options={[10, 25, 45, 60, 90].map((v) => ({ v, label: `${v} Min` }))} value={minutes} onChange={setMinutes} />
      <Chips label="Wann" options={(['heute', 'morgen', 'irgendwann'] as When[]).map((v) => ({ v, label: v[0].toUpperCase() + v.slice(1) }))} value={when} onChange={setWhen} />
      <Chips label="Wichtigkeit" options={[{ v: 1 as Level3, label: 'Kann warten' }, { v: 2 as Level3, label: 'Normal' }, { v: 3 as Level3, label: 'Wichtig' }]} value={priority} onChange={setPriority} />
      <Chips label="Keinen Bock? (mehr XP)" options={[{ v: 1 as Level3, label: 'Geht klar' }, { v: 2 as Level3, label: 'Ungern' }, { v: 3 as Level3, label: 'Schiebe ich ewig' }]} value={dread} onChange={setDread} />
      <div className="col">
        {idea ? (
          <>
            <button className="btn primary" onClick={() => inboxToIdea(item.id, zone)}>
              Idee → in die Ideen-Truhe
            </button>
            <button className="btn" onClick={asTask}>
              Doch als Aufgabe speichern
            </button>
          </>
        ) : (
          <>
            <button className="btn primary" onClick={asTask}>
              Passt, als Aufgabe speichern
            </button>
            <button className="btn" onClick={() => inboxToIdea(item.id, zone)}>
              Ist nur eine Idee → Ideen-Truhe
            </button>
          </>
        )}
        {onBreakdown && (
          <button className="btn" onClick={() => onBreakdown(inboxToGoal(item.id))}>
            Zu groß für eine Sitzung → als Ziel zerlegen
          </button>
        )}
        <button className="btn ghost danger" onClick={() => removeInbox(item.id)}>
          Löschen
        </button>
      </div>
    </div>
  )
}

export function SortOverlay({ onClose, onBreakdown, onDump }: { onClose: () => void; onBreakdown?: (goalId: string) => void; onDump?: (text: string, inboxIds: string[]) => void }) {
  const inbox = useStore((s) => s.data.inbox)
  const item = inbox[0]
  return (
    <Overlay>
      <div className="row between">
        <h3>Inbox sortieren · noch {inbox.length}</h3>
        {onDump && inbox.length > 1 && (
          <button className="btn sm" onClick={() => onDump(inbox.map((i) => i.text).join('\n'), inbox.map((i) => i.id))}>
            Alle auf einmal
          </button>
        )}
        <button className="x" onClick={onClose} aria-label="Schließen">
          ✕
        </button>
      </div>
      {item ? (
        <SortItem key={item.id} item={item} onBreakdown={onBreakdown} />
      ) : (
        <>
          <div className="center col" style={{ marginTop: 60 }}>
            <h1>Inbox leer.</h1>
            <p className="muted">Kopf frei.</p>
          </div>
          <div className="foot">
            <button className="btn primary" onClick={onClose}>
              Fertig
            </button>
          </div>
        </>
      )}
    </Overlay>
  )
}

// ---------- Morgen-Check-in ----------

export function Checkin({ onClose }: { onClose: () => void }) {
  const checkin = useStore((s) => s.checkin)
  const data = useStore((s) => s.data)
  const [energy, setEnergy] = useState(0)
  const [sleep, setSleep] = useState(0)
  const [minimal, setMinimal] = useState<boolean | null>(null)
  const [stage, setStage] = useState(0)
  const today = dateKey()
  const low = energy > 0 && energy <= 2
  const useMinimal = minimal ?? low
  const mains = useMemo(
    () => pickMains(data.tasks.filter((t) => t.status === 'open' && t.date && t.date <= today), today, useMinimal ? 1 : 3),
    [data.tasks, today, useMinimal],
  )

  if (stage === 1) {
    return (
      <Overlay zoneId={8}>
        <div className="col">
          <h1>{useMinimal ? 'Heute nur das Nötigste' : 'Deine Main Quests heute'}</h1>
          <p className="muted">{useMinimal ? 'Eine Quest, Bewegung, Essen, Shutdown. Das hält deinen Streak.' : 'Wenn die erledigt sind, war der Tag gut. Alles andere ist Bonus.'}</p>
        </div>
        {mains.length === 0 && <p className="muted">Noch keine Aufgaben. Tipp auf das Plus und kipp alles in die Inbox.</p>}
        {mains.map((t, i) => (
          <div key={t.id} className="card col" style={{ ...zoneStyle(t.zone), borderLeft: '5px solid var(--zone)', gap: 6 }}>
            <span className="tag main" style={{ alignSelf: 'flex-start' }}>
              Main Quest {i + 1}
            </span>
            <h2>{t.title}</h2>
            <ZoneBadge id={t.zone} />
          </div>
        ))}
        <div className="foot">
          <button className="btn primary big" onClick={onClose}>
            Los geht’s
          </button>
        </div>
      </Overlay>
    )
  }

  return (
    <Overlay zoneId={8}>
      <div className="col">
        <h1>Guten Morgen, {data.profile.name}</h1>
        <p className="muted">Zwei Antipper, mehr nicht.</p>
      </div>
      <div className="col">
        <h3>Wie viel Energie hast du? (1 = leer, 5 = voll)</h3>
        <Scale value={energy} onChange={setEnergy} />
      </div>
      <div className="col">
        <h3>Wie hast du geschlafen?</h3>
        <Scale value={sleep} onChange={setSleep} />
      </div>
      {low && (
        <div className="notice col">
          <span>Wenig Energie heute. Vorschlag: ein Minimal-Tag. Nur 1 Main Quest plus Basics, dein Streak bleibt trotzdem.</span>
          <Chips options={[{ v: 'ja', label: 'Minimal-Tag' }, { v: 'nein', label: 'Normaler Tag' }]} value={useMinimal ? 'ja' : 'nein'} onChange={(v) => setMinimal(v === 'ja')} />
        </div>
      )}
      <div className="foot">
        <button
          className="btn primary big"
          disabled={!energy || !sleep}
          onClick={() => {
            checkin(energy, sleep, useMinimal)
            setStage(1)
          }}
        >
          Weiter
        </button>
        <button className="btn ghost" onClick={onClose}>
          Später
        </button>
      </div>
    </Overlay>
  )
}

// ---------- Abend-Shutdown ----------

export function Shutdown({ onClose }: { onClose: () => void }) {
  const data = useStore((s) => s.data)
  const finish = useStore((s) => s.finishShutdown)
  const [stage, setStage] = useState(0)
  const [reflection, setReflection] = useState('')
  const today = dateKey()
  const tomorrow = addDays(today, 1)
  const log = todayLog(data)
  const open = data.tasks.filter((t) => t.status === 'open' && t.date && t.date <= tomorrow)
  const doneToday = data.tasks.filter((t) => t.status === 'done' && t.doneAt && dateKey(new Date(t.doneAt)) === today)
  const suggested = useMemo(() => pickMains(open, tomorrow, 3).map((t) => t.id), [stage]) // eslint-disable-line react-hooks/exhaustive-deps
  const [mains, setMains] = useState<string[] | null>(null)
  const chosen = mains ?? suggested
  const inbox = data.inbox
  const stages = 5

  const toggleMain = (id: string) => {
    if (chosen.includes(id)) return setMains(chosen.filter((x) => x !== id))
    if (chosen.length >= 3) return
    setMains([...chosen, id])
  }

  const head = (
    <>
      <div className="row between">
        <h3>Abend-Shutdown</h3>
        <button className="x" onClick={onClose} aria-label="Schließen">
          ✕
        </button>
      </div>
      <Progress n={stage + 1} of={stages} />
    </>
  )

  if (stage === 0)
    return (
      <Overlay zoneId={8}>
        {head}
        <div className="col">
          <h1>Dein Tag</h1>
          <p className="muted">
            {doneToday.length} Quest{doneToday.length === 1 ? '' : 's'} erledigt · {log.xp} XP gesammelt
          </p>
        </div>
        {doneToday.map((t) => (
          <div key={t.id} className="small">
            ✓ {t.title}
          </div>
        ))}
        {open.filter((t) => t.date! <= today).length > 0 && (
          <div className="card col" style={{ gap: 6 }}>
            <h3>Offen geblieben → wandert auf morgen</h3>
            {open
              .filter((t) => t.date! <= today)
              .map((t) => (
                <div key={t.id} className="small muted">
                  {t.title}
                </div>
              ))}
            <p className="tiny muted">Kein Vorwurf. Morgen wird neu geplant.</p>
          </div>
        )}
        <div className="foot">
          <button className="btn primary big" onClick={() => setStage(1)}>
            Weiter
          </button>
        </div>
      </Overlay>
    )

  if (stage === 1)
    return (
      <Overlay zoneId={8}>
        {head}
        {inbox.length > 0 ? (
          <>
            <h3>Inbox leeren · noch {inbox.length}</h3>
            <SortItem key={inbox[0].id} item={inbox[0]} />
          </>
        ) : (
          <>
            <div className="col center" style={{ marginTop: 40 }}>
              <h1>Inbox leer.</h1>
              <p className="muted">Nichts mehr im Kopf, was nicht aufgeschrieben ist.</p>
            </div>
            <div className="foot">
              <button className="btn primary big" onClick={() => setStage(2)}>
                Weiter
              </button>
            </div>
          </>
        )}
      </Overlay>
    )

  if (stage === 2)
    return (
      <Overlay zoneId={8}>
        {head}
        <div className="col">
          <h1>3 Main Quests für morgen</h1>
          <p className="muted">Mein Vorschlag ist markiert. Tipp an, um zu ändern (max. 3).</p>
        </div>
        <div className="col" style={{ gap: 8 }}>
          {open.length === 0 && <p className="muted">Keine offenen Aufgaben. Morgen früh kannst du neue in die Inbox kippen.</p>}
          {open.map((t) => (
            <button key={t.id} className={'chip' + (chosen.includes(t.id) ? ' on' : '')} style={{ ...zoneStyle(t.zone), borderRadius: 14, width: '100%' }} onClick={() => toggleMain(t.id)}>
              <b style={{ color: 'var(--zone)' }}>{t.zone}</b> {t.title} <span className="muted tiny">· {t.minutes} Min</span>
            </button>
          ))}
        </div>
        <div className="foot">
          <button className="btn primary big" onClick={() => setStage(3)}>
            Weiter
          </button>
        </div>
      </Overlay>
    )

  if (stage === 3)
    return (
      <Overlay zoneId={8}>
        {head}
        <div className="col">
          <h1>Was lief heute gut?</h1>
          <p className="muted">Ein Satz reicht. Oder tipp etwas an.</p>
        </div>
        <Chips options={REFLECTION_CHIPS.map((v) => ({ v, label: v }))} value={reflection} onChange={setReflection} />
        <input value={reflection} onChange={(e) => setReflection(e.target.value)} placeholder="In deinen Worten …" />
        <div className="foot">
          <button
            className="btn primary big"
            onClick={() => {
              buzz([10, 40, 20])
              finish(chosen, reflection)
              setStage(4)
            }}
          >
            Tag abschließen
          </button>
        </div>
      </Overlay>
    )

  return (
    <Overlay zoneId={8}>
      <div className="col center" style={{ marginTop: 80 }}>
        <div style={{ fontSize: 64 }}>🌙</div>
        <h1>Tag abgeschlossen.</h1>
        <p className="muted">Dein Plan für morgen steht. Bildschirm aus, Handy weg.</p>
      </div>
      <div className="foot">
        <button className="btn" onClick={onClose}>
          Gute Nacht
        </button>
      </div>
    </Overlay>
  )
}

// ---------- "Später" mit Grund ----------

export function LaterSheet({ taskId, onClose }: { taskId: string; onClose: () => void }) {
  const later = useStore((s) => s.laterTask)
  const rules = useStore((s) => s.data.ifThen)
  return (
    <Sheet onClose={onClose}>
      <h2>Okay, später. Woran liegt’s?</h2>
      {rules.length > 0 && (
        <div className="notice col" style={{ gap: 4 }}>
          <b>Kurz vorher: deine eigene Regel</b>
          {rules.slice(0, 3).map((r) => (
            <span key={r.id}>
              Wenn {r.when}, dann {r.then}.
            </span>
          ))}
        </div>
      )}
      <p className="muted small">Hilft mir, besser für dich zu planen. Die Aufgabe wandert auf morgen.</p>
      <div className="chips stack">
        {LATER_REASONS.map((r) => (
          <button
            key={r}
            className="chip"
            onClick={() => {
              later(taskId, r)
              onClose()
            }}
          >
            {r}
          </button>
        ))}
      </div>
      <button className="btn ghost" onClick={onClose}>
        Doch jetzt machen
      </button>
    </Sheet>
  )
}

// ---------- Timer (5 Minuten / Fokus) ----------

const mmss = (sec: number) => `${String(Math.floor(sec / 60)).padStart(2, '0')}:${String(sec % 60).padStart(2, '0')}`

export function Timer({ taskId, minutes, onClose }: { taskId: string; minutes: number; onClose: () => void }) {
  const task = useStore((s) => s.data.tasks.find((t) => t.id === taskId))
  const focusMinutes = useStore((s) => s.data.settings.focusMinutes)
  const { addWork, completeTask, stepDone, phoneAway } = useStore.getState()
  const [startedAt, setStartedAt] = useState(() => Date.now())
  // Vor Deep-Work-Blöcken: optionale Vor-Quest "Handy weg"
  const [prep, setPrep] = useState(() => minutes >= 15 && useStore.getState().data.tasks.find((t) => t.id === taskId)?.kind === 'deep')
  const sessionDone = useRef(false)
  const [endsAt, setEndsAt] = useState(() => Date.now() + minutes * 60000)
  const [, tick] = useState(0)
  const rang = useRef(false)

  useEffect(() => {
    const i = setInterval(() => tick((n) => n + 1), 500)
    return () => clearInterval(i)
  }, [])

  const left = Math.max(0, Math.ceil((endsAt - Date.now()) / 1000))
  const over = left === 0
  if (over && !rang.current && !prep) {
    rang.current = true
    sessionDone.current = true
    buzz([200, 100, 200])
  }

  const stop = (done: boolean) => {
    const worked = Math.max(1, Math.round((Math.min(Date.now(), endsAt) - startedAt) / 60000))
    addWork(taskId, worked, sessionDone.current)
    if (done) completeTask(taskId)
    onClose()
  }

  if (!task) return null

  if (prep) {
    const go = (away: boolean) => {
      if (away) phoneAway()
      setStartedAt(Date.now())
      setEndsAt(Date.now() + minutes * 60000)
      setPrep(false)
    }
    return (
      <Overlay zoneId={task.zone}>
        <div className="col center" style={{ marginTop: 60 }}>
          <div style={{ fontSize: 64 }}>📵</div>
          <h1>Erst das Handy weg.</h1>
          <p className="muted">Leg es in einen anderen Raum oder stell „Nicht stören“ an. Dann {minutes} Minuten nur diese eine Sache.</p>
        </div>
        <div className="foot">
          <button className="btn primary big" onClick={() => go(true)}>
            Handy ist weg · Start
          </button>
          <button className="btn ghost" onClick={() => go(false)}>
            Ohne das starten
          </button>
        </div>
      </Overlay>
    )
  }
  const step = task.steps[Math.min(task.stepsDone, task.steps.length - 1)]
  const hasMoreSteps = task.stepsDone < task.steps.length - 1

  return (
    <Overlay zoneId={task.zone}>
      <div className="center" style={{ marginTop: 20 }}>
        <ZoneBadge id={task.zone} />
      </div>
      <h1 className="center">{task.title}</h1>
      <div className="timer">{mmss(left)}</div>
      {over ? (
        <p className="center muted">Zeit um. Du hast angefangen, das war der schwerste Teil.</p>
      ) : (
        step && (
          <div className="step">
            <b>Jetzt nur das</b>
            {step}
            {hasMoreSteps && (
              <button className="btn sm" style={{ marginTop: 10 }} onClick={() => stepDone(taskId)}>
                Schritt geschafft → nächster
              </button>
            )}
          </div>
        )
      )}
      <div className="foot">
        {over && (
          <button
            className="btn primary big"
            onClick={() => {
              rang.current = false
              setEndsAt(Date.now() + focusMinutes * 60000)
            }}
          >
            Weitermachen (+{focusMinutes} Min)
          </button>
        )}
        <button className="btn good big" onClick={() => stop(true)}>
          Aufgabe erledigt
        </button>
        <button className="btn ghost" onClick={() => stop(false)}>
          {over ? 'Für jetzt reicht’s' : 'Aufhören (zählt trotzdem)'}
        </button>
      </div>
    </Overlay>
  )
}

// ---------- Notfall: "Alles zu viel" ----------

export function Panic({ onClose, small }: { onClose: () => void; small?: string }) {
  const [sec, setSec] = useState(120)
  useEffect(() => {
    const i = setInterval(() => setSec((s) => Math.max(0, s - 1)), 1000)
    return () => clearInterval(i)
  }, [])
  const phase = (120 - sec) % 10 < 4 ? 'Einatmen' : 'Ausatmen'
  return (
    <Overlay>
      <div className="col center" style={{ marginTop: 30 }}>
        <h1>Stopp. Alles andere ist gerade egal.</h1>
        <p className="muted">Zwei Minuten atmen. 4 Sekunden ein, 6 Sekunden aus.</p>
      </div>
      <div className="breath">{sec > 0 ? phase : 'Gut gemacht'}</div>
      <p className="center muted num">{mmss(sec)}</p>
      {small && (
        <div className="step">
          <b>Danach nur diese eine kleine Sache</b>
          {small}
        </div>
      )}
      <div className="foot">
        <button className="btn" onClick={onClose}>
          {sec > 0 ? 'Zurück' : 'Okay, weiter'}
        </button>
      </div>
    </Overlay>
  )
}
