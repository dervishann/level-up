import { useState } from 'react'
import { useStore } from '../lib/store'
import { demoData } from '../lib/demo'
import { REWARD_SUGGESTIONS } from '../lib/suggest'
import { uid, WEEKDAYS } from '../lib/date'
import type { Training } from '../lib/types'
import { Chips, Overlay, Progress } from '../ui'

const DAY_ORDER = [1, 2, 3, 4, 5, 6, 0]

export function TrainingEditor({ value, onChange }: { value: Training[]; onChange: (t: Training[]) => void }) {
  const part = (type: 'gym' | 'ringen', label: string, minutes: number, defTime: string) => {
    const mine = value.filter((t) => t.type === type)
    const time = mine[0]?.time ?? defTime
    const toggle = (wd: number) => {
      const has = mine.some((t) => t.weekday === wd)
      onChange(has ? value.filter((t) => !(t.type === type && t.weekday === wd)) : [...value, { id: uid(), type, weekday: wd, time, minutes }])
    }
    const setTime = (v: string) => onChange(value.map((t) => (t.type === type ? { ...t, time: v } : t)))
    return (
      <div className="card col" style={{ ['--zone' as string]: '#ef4444' }}>
        <div className="row between">
          <b>{label}</b>
          <span className="muted small">{mine.length}× pro Woche</span>
        </div>
        <Chips options={DAY_ORDER.map((wd) => ({ v: wd, label: WEEKDAYS[wd] }))} value={mine.map((t) => t.weekday)} onChange={toggle} />
        <label className="row small muted">
          Uhrzeit
          <input type="time" value={time} onChange={(e) => setTime(e.target.value)} style={{ width: 130 }} />
        </label>
      </div>
    )
  }
  return (
    <div className="col">
      {part('gym', 'Gym', 75, '17:00')}
      {part('ringen', 'Ringen', 90, '19:00')}
    </div>
  )
}

export function Onboarding({ onDone }: { onDone: () => void }) {
  const finish = useStore((s) => s.finishOnboarding)
  const importData = useStore((s) => s.importData)
  const ensureToday = useStore((s) => s.ensureToday)
  const [step, setStep] = useState(0)
  const [name, setName] = useState('')
  const [wake, setWake] = useState('06:30')
  const [sleep, setSleep] = useState('22:30')
  const [trainings, setTrainings] = useState<Training[]>([])
  const [postGoal, setPostGoal] = useState(3)
  const [clients, setClients] = useState('')
  const [rewards, setRewards] = useState<string[]>(REWARD_SUGGESTIONS.slice(0, 4).map((r) => r.title))

  const next = () => {
    if (step < 3) return setStep(step + 1)
    finish({
      name,
      wake,
      sleep,
      trainings,
      postGoal,
      clients: clients.split(',').map((c) => c.trim()).filter(Boolean),
      rewards: REWARD_SUGGESTIONS.filter((r) => rewards.includes(r.title)).map((r) => ({ id: uid(), ...r })),
    })
    onDone()
  }

  const demo = () => {
    importData(demoData())
    ensureToday()
  }

  return (
    <Overlay>
      <Progress n={step + 1} of={4} />
      {step === 0 && (
        <>
          <div className="col">
            <h1>Level Up</h1>
            <p className="muted">Dein Leben als RPG. Vier kurze Schritte, dann hast du deinen ersten Tagesplan.</p>
          </div>
          <div className="col">
            <h3>Wie heißt dein Charakter?</h3>
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Dein Name" autoComplete="off" />
          </div>
          <Chips label="Aufstehen" options={['06:00', '06:30', '07:00'].map((v) => ({ v, label: v }))} value={wake} onChange={setWake} />
          <Chips label="Schlafen" options={['22:00', '22:30', '23:00'].map((v) => ({ v, label: v }))} value={sleep} onChange={setSleep} />
        </>
      )}
      {step === 1 && (
        <>
          <div className="col">
            <h1>Training</h1>
            <p className="muted">Deine Trainingszeiten werden feste Anker im Tagesplan. Tipp die Tage an.</p>
          </div>
          <TrainingEditor value={trainings} onChange={setTrainings} />
        </>
      )}
      {step === 2 && (
        <>
          <div className="col">
            <h1>Business</h1>
            <p className="muted">Nur grob. Alles lässt sich später ändern.</p>
          </div>
          <Chips label="Posting-Ziel pro Woche" options={[2, 3, 5, 7].map((v) => ({ v, label: `${v} Videos` }))} value={postGoal} onChange={setPostGoal} />
          <div className="col">
            <h3>Aktuelle Kunden (optional, mit Komma getrennt)</h3>
            <input value={clients} onChange={(e) => setClients(e.target.value)} placeholder="z. B. Studio Nord, Café Mila" autoComplete="off" />
          </div>
        </>
      )}
      {step === 3 && (
        <>
          <div className="col">
            <h1>Belohnungen</h1>
            <p className="muted">Mit Quests verdienst du Coins. Wofür willst du sie ausgeben? (Der Shop kommt in Phase 2, die Coins sammelst du ab heute.)</p>
          </div>
          <Chips
            stack
            options={REWARD_SUGGESTIONS.map((r) => ({ v: r.title, label: `${r.title} · ${r.cost} Coins` }))}
            value={rewards}
            onChange={(v) => setRewards(rewards.includes(v) ? rewards.filter((x) => x !== v) : [...rewards, v])}
          />
        </>
      )}
      <div className="foot">
        <button className="btn primary big" onClick={next}>
          {step < 3 ? 'Weiter' : 'Los geht’s: Zone 1 erkunden'}
        </button>
        {step > 0 ? (
          <button className="btn ghost" onClick={() => setStep(step - 1)}>
            Zurück
          </button>
        ) : (
          <button className="btn ghost" onClick={demo}>
            Erst mal mit Beispieldaten ausprobieren
          </button>
        )}
      </div>
    </Overlay>
  )
}
