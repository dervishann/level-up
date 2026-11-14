import { useState } from 'react'
import { useStore } from '../lib/store'
import { childrenOf, depthOf, MAX_DEPTH, moneyDrafts, moneyPlan, nextUnclear, parseMoney, pathTo, progress, type NodeDraft } from '../lib/goals'
import type { Goal, GoalNode } from '../lib/types'
import type { Modal } from '../App'
import { Chips, Overlay, Sheet, ZoneBadge, buzz, zoneStyle } from '../ui'

const eur = (n: number) => n.toLocaleString('de-DE') + ' €'

// ---------- Baum-Ansicht einer Quest-Kette ----------

function Tree({ goal, parentId, depth = 0, onDelete }: { goal: Goal; parentId?: string; depth?: number; onDelete?: (n: GoalNode) => void }) {
  const nodes = useStore((s) => s.data.nodes)
  const kids = childrenOf(nodes, goal.id, parentId)
  if (!kids.length) return null
  return (
    <div className="col" style={{ gap: 6, marginLeft: depth ? 14 : 0, borderLeft: depth ? '2px solid var(--line)' : 'none', paddingLeft: depth ? 10 : 0 }}>
      {kids.map((n) => {
        const isLeaf = childrenOf(nodes, goal.id, n.id).length === 0
        const state = n.done ? '✓' : !isLeaf ? '▸' : n.taskId ? '▶' : n.minutes !== undefined ? '🔒' : '?'
        return (
          <div key={n.id} className="col" style={{ gap: 6 }}>
            <div className="row small" style={{ alignItems: 'flex-start', opacity: n.done ? 0.5 : 1 }}>
              <span style={{ width: 20, flex: 'none', textAlign: 'center' }}>{state}</span>
              <span className="grow" style={{ fontWeight: isLeaf ? 400 : 600, textDecoration: n.done ? 'line-through' : 'none' }}>
                {n.title}
                {isLeaf && n.minutes !== undefined && !n.done && <span className="muted tiny"> · {n.minutes} Min{n.taskId ? ' · im Plan' : ' · kommt danach'}</span>}
                {isLeaf && n.minutes === undefined && !n.done && <span className="muted tiny"> · noch zu groß</span>}
              </span>
              {onDelete && !n.done && (
                <button className="muted" style={{ padding: '0 6px' }} onClick={() => onDelete(n)} aria-label="Entfernen">
                  ✕
                </button>
              )}
            </div>
            <Tree goal={goal} parentId={n.id} depth={depth + 1} onDelete={onDelete} />
          </div>
        )
      })}
    </div>
  )
}

// ---------- Ziele-Bereich (auf der Karte) ----------

export function GoalsSection({ open }: { open: (m: Modal) => void }) {
  const goals = useStore((s) => s.data.goals)
  const nodes = useStore((s) => s.data.nodes)
  const { addGoal, deleteGoal } = useStore.getState()
  const [adding, setAdding] = useState(false)
  const [title, setTitle] = useState('')
  const [openId, setOpenId] = useState<string | null>(null)

  const create = () => {
    if (!title.trim()) return
    const id = addGoal(title)
    setTitle('')
    setAdding(false)
    open({ k: 'breakdown', goalId: id })
  }

  return (
    <div className="narrow col" style={{ gap: 10 }}>
      <div className="row between">
        <h3>Ziele & Quest-Ketten</h3>
        <button className="btn sm" onClick={() => setAdding(true)}>
          + Ziel
        </button>
      </div>
      {goals.length === 0 && <p className="muted small">Noch kein Ziel. Tipp auf „+ Ziel“, z. B. „10K im Monat“. Ich frage dann so lange nach, bis klar ist, was du heute dafür tun kannst.</p>}
      {goals.map((g) => {
        const p = progress(nodes, g.id)
        const unclear = nextUnclear(nodes, g.id)
        const isOpen = openId === g.id
        return (
          <div key={g.id} className="card col" style={{ ...zoneStyle(g.zone), borderLeft: '5px solid var(--zone)' }}>
            <button className="row" style={{ textAlign: 'left', width: '100%' }} onClick={() => setOpenId(isOpen ? null : g.id)}>
              <span className="grow">
                <b>🎯 {g.title}</b>
                <br />
                <span className="muted small">{p.total === 0 ? 'Noch nicht zerlegt' : `${p.done} von ${p.total} Schritten erledigt${unclear ? ' · es gibt noch unklare Schritte' : ''}`}</span>
              </span>
            </button>
            {p.total > 0 && (
              <div className="bar">
                <div style={{ width: `${(p.done / p.total) * 100}%` }} />
              </div>
            )}
            {isOpen && <Tree goal={g} />}
            <div className="row">
              <button className="btn sm primary" onClick={() => open({ k: 'breakdown', goalId: g.id })}>
                {p.total === 0 ? 'Zerlegen starten' : unclear ? 'Weiter zerlegen' : 'Ansehen & erweitern'}
              </button>
              {isOpen && (
                <button className="btn sm ghost danger" onClick={() => confirm(`Ziel „${g.title}“ mit allen Schritten löschen?`) && deleteGoal(g.id)}>
                  Löschen
                </button>
              )}
            </div>
          </div>
        )
      })}

      {adding && (
        <Sheet onClose={() => setAdding(false)}>
          <h2>Neues Ziel</h2>
          <p className="muted small">Schreib es so groß hin, wie es ist. Klein machen wir es gleich zusammen.</p>
          <input value={title} onChange={(e) => setTitle(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && create()} autoFocus placeholder="z. B. 10K im Monat" />
          <div className="chips">
            {['10K im Monat', '10.000 Follower', '5 feste Kunden', 'Website fertig'].map((ex) => (
              <button key={ex} className="chip" onClick={() => setTitle(ex)}>
                {ex}
              </button>
            ))}
          </div>
          <button className="btn primary" disabled={!title.trim()} onClick={create}>
            Zerlegen starten
          </button>
        </Sheet>
      )}
    </div>
  )
}

// ---------- Geld-Ziel rückwärts rechnen ----------

function MoneyWizard({ goal, onDone, onSkip }: { goal: Goal; onDone: (drafts: NodeDraft[]) => void; onSkip: () => void }) {
  const [step, setStep] = useState(0)
  const [target, setTarget] = useState(parseMoney(goal.title) ?? 5000)
  const [price, setPrice] = useState(0)
  const [have, setHave] = useState(0)
  const [talks, setTalks] = useState(5)
  const [contacts, setContacts] = useState(10)
  const [weeks, setWeeks] = useState(12)
  const input = { target, price: price || 1, have, talksPerCustomer: talks, contactsPerTalk: contacts, weeks }
  const p = moneyPlan(input)

  const numInput = (value: number, set: (n: number) => void) => (
    <input type="number" inputMode="numeric" value={value || ''} onChange={(e) => set(Math.max(0, Number(e.target.value)))} placeholder="Eigener Betrag in €" />
  )

  const screens = [
    {
      q: 'Wie viel willst du pro Monat verdienen?',
      hint: 'Umsatz, nicht Gewinn. Du kannst das später jederzeit ändern.',
      body: (
        <>
          <Chips options={[3000, 5000, 10000, 20000].map((v) => ({ v, label: eur(v) }))} value={target} onChange={setTarget} />
          {numInput(target, setTarget)}
        </>
      ),
      ok: target > 0,
    },
    {
      q: 'Was zahlt dir ein Kunde im Schnitt pro Monat?',
      hint: 'Wenn du es nicht weißt: Was willst du verlangen?',
      body: (
        <>
          <Chips options={[500, 1000, 2500, 5000].map((v) => ({ v, label: eur(v) }))} value={price} onChange={setPrice} />
          {numInput(price, setPrice)}
          {price > 0 && (
            <div className="notice">
              {eur(target)} ÷ {eur(price)} = <b>{p.customers} Kunden</b>
            </div>
          )}
        </>
      ),
      ok: price > 0,
    },
    {
      q: `Wie viele Kunden zu ${eur(price)} hast du schon?`,
      body: <Chips options={[0, 1, 2, 3, 4, 5].map((v) => ({ v, label: String(v) }))} value={have} onChange={setHave} />,
      ok: true,
    },
    {
      q: 'Von wie vielen Erstgesprächen wird einer dein Kunde?',
      hint: 'Ehrlich schätzen. Wenn du keine Ahnung hast, nimm „1 von 5“.',
      body: <Chips stack options={[2, 3, 5, 10].map((v) => ({ v, label: `1 von ${v}` }))} value={talks} onChange={setTalks} />,
      ok: true,
    },
    {
      q: 'Wie viele Leute musst du anschreiben, bis ein Gespräch zustande kommt?',
      hint: 'Kaltakquise liegt oft bei 1 von 10 bis 1 von 20.',
      body: <Chips stack options={[5, 10, 20, 50].map((v) => ({ v, label: `${v} Kontakte für 1 Gespräch` }))} value={contacts} onChange={setContacts} />,
      ok: true,
    },
    {
      q: 'Bis wann willst du da sein?',
      body: <Chips options={[4, 8, 12, 24].map((v) => ({ v, label: `${v} Wochen` }))} value={weeks} onChange={setWeeks} />,
      ok: true,
    },
  ]

  if (step === screens.length) {
    return (
      <>
        <div className="col">
          <h1 style={{ fontSize: 24 }}>Deine Rechnung</h1>
          <p className="muted small">Aus „{goal.title}“ wird eine Zahl, die du pro Woche abarbeiten kannst.</p>
        </div>
        <div className="card col" style={{ gap: 8 }}>
          <div className="row between">
            <span>Ziel</span>
            <b>{eur(target)} / Monat</b>
          </div>
          <div className="row between">
            <span>Kunden nötig</span>
            <b>
              {p.customers} × {eur(price)}
            </b>
          </div>
          <div className="row between">
            <span>Fehlen noch</span>
            <b>{p.missing}</b>
          </div>
          <div className="row between">
            <span>Erstgespräche</span>
            <b>ca. {p.talks}</b>
          </div>
          <div className="row between">
            <span>Kontakte gesamt</span>
            <b>ca. {p.contacts}</b>
          </div>
          <div className="row between" style={{ borderTop: '1px solid var(--line)', paddingTop: 8 }}>
            <span>Das heißt pro Woche</span>
            <b style={{ color: 'var(--gold)' }}>{p.perWeek} Leute anschreiben</b>
          </div>
        </div>
        {p.perWeek > 50 && <div className="notice">Das sind sehr viele Kontakte pro Woche. Höherer Preis oder mehr Zeit machen es realistischer. Geh ruhig zurück und dreh an den Zahlen.</div>}
        <div className="foot">
          <button className="btn primary big" onClick={() => onDone(moneyDrafts(input))}>
            Daraus Quest-Kette bauen
          </button>
          <button className="btn ghost" onClick={() => setStep(step - 1)}>
            Zurück
          </button>
        </div>
      </>
    )
  }

  const s = screens[step]
  return (
    <>
      <div className="progress">
        {screens.map((_, i) => (
          <i key={i} className={i <= step ? 'on' : ''} />
        ))}
      </div>
      <div className="col">
        <h1 style={{ fontSize: 24 }}>{s.q}</h1>
        {s.hint && <p className="muted small">{s.hint}</p>}
      </div>
      {s.body}
      <div className="foot">
        <button className="btn primary big" disabled={!s.ok} onClick={() => setStep(step + 1)}>
          Weiter
        </button>
        {step > 0 ? (
          <button className="btn ghost" onClick={() => setStep(step - 1)}>
            Zurück
          </button>
        ) : (
          <button className="btn ghost" onClick={onSkip}>
            Lieber frei zerlegen
          </button>
        )}
      </div>
    </>
  )
}

// ---------- Zerleger: fragt, bis jeder Schritt in eine Sitzung passt ----------

const TOP_EXAMPLES = (title: string): string[] => {
  const t = title.toLowerCase()
  if (/follower|abonnent|reichweite|views/.test(t)) return ['Posting-Rhythmus festlegen', 'Content-Säulen definieren', '10 Videos vorproduzieren', 'Profil und Bio optimieren']
  if (/kunde|auftrag|akquise/.test(t)) return ['Angebot klar formulieren', 'Liste mit Wunschkunden', 'Jede Woche Leute anschreiben', 'Erstgespräche führen']
  if (/website|seite|shop|kurs|produkt/.test(t)) return ['Inhalt und Aufbau festlegen', 'Erste Version bauen', 'Feedback von 3 Leuten holen', 'Veröffentlichen']
  return ['Herausfinden, was genau nötig ist', 'Erste Version fertig haben', 'Feedback einholen', 'Abschließen']
}
const SUB_EXAMPLES = ['Recherchieren, was ich dafür brauche', 'Unterlagen und Material zusammensuchen', 'Erste Rohversion machen', 'Jemanden fragen, der es schon kann', 'Fertig machen und abschicken']

type Mode = { k: 'auto' } | { k: 'split'; parentId?: string } | { k: 'time'; nodeId: string } | { k: 'tree' }

export function Breakdown({ goalId, onClose }: { goalId: string; onClose: () => void }) {
  const goal = useStore((s) => s.data.goals.find((g) => g.id === goalId))
  const nodes = useStore((s) => s.data.nodes)
  const { addNodes, setNodeReady, researchNode, deleteNode, finishBreakdown } = useStore.getState()
  const [mode, setMode] = useState<Mode>({ k: 'auto' })
  const [skipMoney, setSkipMoney] = useState(false)
  const [list, setList] = useState<string[]>([])
  const [own, setOwn] = useState('')

  if (!goal) return null
  const top = childrenOf(nodes, goalId)
  const unclear = nextUnclear(nodes, goalId)
  const close = () => {
    finishBreakdown(goalId)
    onClose()
  }
  const auto = () => {
    setList([])
    setOwn('')
    setMode({ k: 'auto' })
  }

  const head = (crumbs: string[]) => (
    <div className="col" style={{ gap: 8 }}>
      <div className="row between">
        <ZoneBadge id={goal.zone} />
        <button className="x" onClick={close} aria-label="Schließen">
          ✕
        </button>
      </div>
      <p className="tiny muted">🎯 {[goal.title, ...crumbs].join('  ›  ')}</p>
    </div>
  )

  // 1) Geld-Ziel: erst rechnen
  if (top.length === 0 && !skipMoney && parseMoney(goal.title) !== undefined && mode.k === 'auto') {
    return (
      <Overlay zoneId={goal.zone}>
        {head([])}
        <MoneyWizard
          goal={goal}
          onSkip={() => setSkipMoney(true)}
          onDone={(drafts) => {
            buzz()
            addNodes(goalId, undefined, drafts)
            auto()
          }}
        />
      </Overlay>
    )
  }

  // 2) Etwas in Teile zerlegen
  const splitParent = mode.k === 'split' ? mode.parentId : top.length === 0 ? undefined : null
  if (splitParent !== null) {
    const parent = splitParent ? nodes.find((n) => n.id === splitParent) : undefined
    const examples = (parent ? SUB_EXAMPLES : TOP_EXAMPLES(goal.title)).filter((e) => !list.includes(e))
    const add = (t: string) => {
      const v = t.trim()
      if (v && !list.includes(v)) setList([...list, v])
      setOwn('')
    }
    const all = own.trim() && !list.includes(own.trim()) ? [...list, own.trim()] : list
    return (
      <Overlay zoneId={goal.zone}>
        {head(parent ? pathTo(nodes, parent).map((n) => n.title) : [])}
        <div className="col">
          <h1 style={{ fontSize: 24 }}>{parent ? `Was sind die Schritte zu „${parent.title}“?` : `Was muss wahr sein, damit du „${goal.title}“ erreichst?`}</h1>
          <p className="muted small">{parent ? '2 bis 5 Schritte, in der Reihenfolge, in der du sie machen würdest.' : '2 bis 4 Zwischenziele. Denk in Ergebnissen („Angebot steht“), nicht in Tätigkeiten.'}</p>
        </div>
        {list.length > 0 && (
          <div className="col" style={{ gap: 6 }}>
            {list.map((t, i) => (
              <div key={t} className="branch">
                <b className="muted">{i + 1}.</b>
                <span className="grow">{t}</span>
                <button className="muted" onClick={() => setList(list.filter((x) => x !== t))} aria-label="Entfernen">
                  ✕
                </button>
              </div>
            ))}
          </div>
        )}
        <div className="row">
          <input value={own} onChange={(e) => setOwn(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && add(own)} placeholder={list.length ? 'Nächster Schritt …' : 'Erster Schritt …'} />
          <button className="btn sm" disabled={!own.trim()} onClick={() => add(own)}>
            +
          </button>
        </div>
        <div className="col" style={{ gap: 6 }}>
          <h3>Vorschläge</h3>
          <div className="chips">
            {examples.map((e) => (
              <button key={e} className="chip" onClick={() => add(e)}>
                + {e}
              </button>
            ))}
          </div>
        </div>
        <div className="foot">
          <button
            className="btn primary big"
            disabled={!all.length}
            onClick={() => {
              buzz()
              addNodes(goalId, parent?.id, all.map((title) => ({ title })))
              auto()
            }}
          >
            Weiter
          </button>
          {top.length > 0 && (
            <button className="btn ghost" onClick={auto}>
              Abbrechen
            </button>
          )}
        </div>
      </Overlay>
    )
  }

  // 3) Dauer festlegen → wird zur Quest
  if (mode.k === 'time') {
    const n = nodes.find((x) => x.id === mode.nodeId)
    if (n)
      return (
        <Overlay zoneId={goal.zone}>
          {head(pathTo(nodes, n).map((x) => x.title))}
          <div className="col">
            <h1 style={{ fontSize: 24 }}>Wie lange brauchst du für „{n.title}“?</h1>
            <p className="muted small">Schätz lieber großzügig. Die meisten unterschätzen um ein Drittel.</p>
          </div>
          <div className="chips stack">
            {[10, 25, 45, 60, 90].map((m) => (
              <button
                key={m}
                className="chip"
                onClick={() => {
                  buzz()
                  setNodeReady(n.id, m)
                  auto()
                }}
              >
                {m} Minuten
              </button>
            ))}
          </div>
          <div className="foot">
            <button className="btn ghost" onClick={auto}>
              Zurück
            </button>
          </div>
        </Overlay>
      )
  }

  // 4) Nächsten unklaren Schritt prüfen
  if (unclear && mode.k === 'auto') {
    const deep = depthOf(nodes, unclear) >= MAX_DEPTH
    const left = nodes.filter((n) => n.goalId === goalId && !n.done && n.minutes === undefined && childrenOf(nodes, goalId, n.id).length === 0).length
    return (
      <Overlay zoneId={goal.zone}>
        {head(pathTo(nodes, unclear).slice(0, -1).map((n) => n.title))}
        <p className="tiny muted">Noch {left} unklare{left === 1 ? 'r' : ''} Schritt{left === 1 ? '' : 'e'}</p>
        <div className="card" style={{ borderLeft: '5px solid var(--zone)' }}>
          <h2>{unclear.title}</h2>
        </div>
        <div className="col">
          <h1 style={{ fontSize: 22 }}>Schaffst du das in einer Sitzung (max. 90 Min) und weißt genau, womit du anfängst?</h1>
          {deep && <p className="muted small">Kleiner wird es nicht mehr. Leg eine Dauer fest und fang an.</p>}
        </div>
        <div className="foot">
          <button className="btn good big" onClick={() => setMode({ k: 'time', nodeId: unclear.id })}>
            Ja, das ist eine Quest
          </button>
          {!deep && (
            <button className="btn big" onClick={() => setMode({ k: 'split', parentId: unclear.id })}>
              Nein, zu groß → zerlegen
            </button>
          )}
          {!deep && (
            <button
              className="btn"
              onClick={() => {
                researchNode(unclear.id)
                auto()
              }}
            >
              Ich weiß nicht, wie das geht
            </button>
          )}
          <button className="btn ghost" onClick={() => setMode({ k: 'tree' })}>
            Überblick ansehen
          </button>
        </div>
      </Overlay>
    )
  }

  // 5) Überblick
  const p = progress(nodes, goalId)
  return (
    <Overlay zoneId={goal.zone}>
      {head([])}
      <div className="col">
        <h1 style={{ fontSize: 24 }}>{unclear ? 'Deine Quest-Kette bisher' : 'Alles klar. Die Kette steht.'}</h1>
        <p className="muted small">
          {p.total} Schritte, {p.done} erledigt. ▶ liegt in deinem Plan, 🔒 wird freigeschaltet, sobald du einen Schritt abhakst. So hast du nie mehr als zwei auf einmal vor dir.
        </p>
      </div>
      <div className="card">
        <Tree goal={goal} onDelete={(n) => confirm(`„${n.title}“ entfernen?`) && deleteNode(n.id)} />
      </div>
      <div className="foot">
        {unclear ? (
          <button className="btn primary big" onClick={auto}>
            Weiter zerlegen
          </button>
        ) : (
          <button className="btn primary big" onClick={close}>
            Fertig
          </button>
        )}
        <button className="btn" onClick={() => setMode({ k: 'split', parentId: undefined })}>
          + Weiteres Zwischenziel
        </button>
        {unclear && (
          <button className="btn ghost" onClick={close}>
            Später weitermachen
          </button>
        )}
      </div>
    </Overlay>
  )
}
