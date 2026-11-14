import { useRef, useState } from 'react'
import { useStore } from '../lib/store'
import { demoData } from '../lib/demo'
import { dateKey } from '../lib/date'
import { levelInfo, STAT_LABEL } from '../lib/xp'
import type { AppData, StatKey } from '../lib/types'
import { Chips } from '../ui'
import { TrainingEditor } from './Onboarding'
import { XpBar } from './Now'

const STAT_COLOR: Record<StatKey, string> = { fokus: '#8b5cf6', staerke: '#ef4444', business: '#3b82f6', reichweite: '#06b6d4', disziplin: '#eab308', klarheit: '#ec4899' }

export function Me() {
  const data = useStore((s) => s.data)
  const { setTheme, updateProfile, markBackup, importData, reset, ensureToday } = useStore.getState()
  const file = useRef<HTMLInputElement>(null)
  const [msg, setMsg] = useState('')
  const [showFormula, setShowFormula] = useState(false)
  const li = levelInfo(data.char.xp)
  const maxStat = Math.max(100, ...Object.values(data.char.stats))

  const exportJson = () => {
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = `level-up-backup-${dateKey()}.json`
    a.click()
    URL.revokeObjectURL(a.href)
    markBackup()
    setMsg('Backup gespeichert. Leg die Datei z. B. in iCloud Drive ab.')
  }

  const importJson = async (f?: File) => {
    if (!f) return
    try {
      const parsed = JSON.parse(await f.text()) as AppData
      if (parsed.version !== 1 || !parsed.profile || !Array.isArray(parsed.tasks)) throw new Error('format')
      if (!confirm('Aktuelle Daten durch das Backup ersetzen?')) return
      importData(parsed)
      ensureToday()
      setMsg('Backup eingespielt.')
    } catch {
      setMsg('Das ist keine gültige Level-Up-Backup-Datei.')
    }
  }

  return (
    <div className="screen">
      <div className="narrow col gap-l">
        <div className="card col">
          <div className="row">
            <div style={{ width: 64, height: 64, borderRadius: 18, background: 'linear-gradient(135deg,#8b5cf6,#eab308)', display: 'grid', placeItems: 'center', fontSize: 28, fontWeight: 800, color: '#fff' }}>{li.level}</div>
            <div className="grow">
              <h2>{data.profile.name}</h2>
              <span className="muted">{li.title}</span>
            </div>
          </div>
          <XpBar />
          <div className="statline" style={{ flexWrap: 'wrap' }}>
            <span>
              🔥 Streak <b className="num">{data.char.streak}</b>
            </span>
            <span>
              Rekord <b className="num">{data.char.bestStreak}</b>
            </span>
            <span>
              🪙 <b className="num">{data.char.coins}</b> Coins
            </span>
          </div>
        </div>

        <div className="card col">
          <h3>Stats</h3>
          {(Object.keys(STAT_LABEL) as StatKey[]).map((k) => (
            <div key={k} className="col" style={{ gap: 4, ['--zone' as string]: STAT_COLOR[k] }}>
              <div className="row between small">
                <span>{STAT_LABEL[k]}</span>
                <span className="muted num">{data.char.stats[k]}</span>
              </div>
              <div className="bar">
                <div style={{ width: `${(data.char.stats[k] / maxStat) * 100}%` }} />
              </div>
            </div>
          ))}
        </div>

        <div className="card col">
          <h3>Rhythmus</h3>
          <Chips label="Aufstehen" options={['06:00', '06:30', '07:00'].map((v) => ({ v, label: v }))} value={data.profile.wake} onChange={(v) => updateProfile({ wake: v })} />
          <Chips label="Schlafen" options={['22:00', '22:30', '23:00'].map((v) => ({ v, label: v }))} value={data.profile.sleep} onChange={(v) => updateProfile({ sleep: v })} />
        </div>

        <div className="col">
          <h3>Training</h3>
          <TrainingEditor value={data.profile.trainings} onChange={(t) => updateProfile({ trainings: t })} />
        </div>

        <div className="card col">
          <h3>XP-Formel</h3>
          <button className="btn sm" style={{ alignSelf: 'flex-start' }} onClick={() => setShowFormula(!showFormula)}>
            {showFormula ? 'Ausblenden' : 'Anzeigen'}
          </button>
          {showFormula && (
            <div className="small col" style={{ gap: 8 }}>
              <p>
                <b>Quest-XP</b> = Minuten × 0,5 × Schwierigkeit × Keinen-Bock-Faktor
              </p>
              <p className="muted">Schwierigkeit: leicht ×1 · mittel ×1,25 · schwer ×1,5</p>
              <p className="muted">Keinen Bock: geht klar ×1 · ungern ×1,3 · schiebe ich ewig ×1,6</p>
              <p className="muted">Boni: Main Quest +10 · Frosch (unangenehmste Main Quest zuerst) +15 · Streak +1 % pro Tag (max. 20 %) · Comeback +25</p>
              <p className="muted">Anfangen +5 · Daily Quest +5 · Check-in +5 · Mahlzeit +5 · Training +20 · Shutdown +20 · Karten-Antwort +10 · Zone komplett +50 · Ziel zerlegt/Schritt geklärt +3 · Ziel komplett erreicht +100</p>
              <p className="muted">Level: von Level n auf n+1 brauchst du 100 + (n − 1) × 50 XP. Coins: 1 Coin pro 10 XP. XP gehen nie verloren.</p>
            </div>
          )}
        </div>

        <div className="card col">
          <h3>Aussehen</h3>
          <Chips options={[{ v: 'dark', label: 'Dunkel' }, { v: 'light', label: 'Hell' }]} value={data.settings.theme} onChange={(v) => setTheme(v as 'dark' | 'light')} />
        </div>

        <div className="card col">
          <h3>Backup</h3>
          <p className="small muted">
            Deine Daten liegen nur auf diesem Gerät, bis in Phase 2 der Sync kommt. Sichere sie einmal pro Woche.
            {data.settings.lastBackupAt ? ` Letztes Backup: ${new Date(data.settings.lastBackupAt).toLocaleDateString('de-DE')}.` : ' Noch kein Backup.'}
          </p>
          <button className="btn" onClick={exportJson}>
            Backup exportieren (JSON)
          </button>
          <button className="btn" onClick={() => file.current?.click()}>
            Backup importieren
          </button>
          <input ref={file} type="file" accept="application/json,.json" hidden onChange={(e) => importJson(e.target.files?.[0])} />
          {msg && <p className="small">{msg}</p>}
        </div>

        <div className="card col">
          <h3>Demo & Reset</h3>
          <button
            className="btn"
            onClick={() => {
              if (!confirm('Beispieldaten laden? Deine aktuellen Daten werden ersetzt (vorher Backup machen).')) return
              importData(demoData())
              ensureToday()
            }}
          >
            Demo-Modus: Beispieldaten laden
          </button>
          <button className="btn danger" onClick={() => confirm('Wirklich ALLES löschen und von vorn anfangen?') && reset()}>
            Alles zurücksetzen
          </button>
        </div>
        <p className="tiny muted center">Level Up · Phase 1 · keine Tracker, keine Analytics, alles bleibt auf deinem Gerät</p>
      </div>
    </div>
  )
}
