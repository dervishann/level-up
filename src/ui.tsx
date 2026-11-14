import type { CSSProperties, ReactNode } from 'react'
import type { ZoneId } from './lib/types'
import { zone } from './lib/zones'

export const zoneStyle = (id?: ZoneId): CSSProperties => (id ? ({ '--zone': zone(id).color } as CSSProperties) : {})

export function ZoneBadge({ id }: { id: ZoneId }) {
  const z = zone(id)
  return (
    <span className="zbadge" style={zoneStyle(id)}>
      <i>{z.id}</i>
      {z.name}
    </span>
  )
}

export function Chips<T extends string | number>({
  options,
  value,
  onChange,
  stack,
  label,
}: {
  options: { v: T; label: ReactNode }[]
  value: T | T[]
  onChange: (v: T) => void
  stack?: boolean
  label?: string
}) {
  const on = (v: T) => (Array.isArray(value) ? value.includes(v) : value === v)
  return (
    <div className="col" style={{ gap: 6 }}>
      {label && <h3>{label}</h3>}
      <div className={'chips' + (stack ? ' stack' : '')}>
        {options.map((o) => (
          <button key={String(o.v)} className={'chip' + (on(o.v) ? ' on' : '')} onClick={() => onChange(o.v)}>
            {o.label}
          </button>
        ))}
      </div>
    </div>
  )
}

export function Overlay({ children, zoneId }: { children: ReactNode; zoneId?: ZoneId }) {
  return (
    <div className="overlay" style={zoneStyle(zoneId)}>
      <div className="narrow">{children}</div>
    </div>
  )
}

export function Sheet({ children, onClose, zoneId }: { children: ReactNode; onClose: () => void; zoneId?: ZoneId }) {
  return (
    <div className="scrim" onClick={onClose}>
      <div className="sheet" style={zoneStyle(zoneId)} onClick={(e) => e.stopPropagation()}>
        {children}
      </div>
    </div>
  )
}

export function Progress({ n, of }: { n: number; of: number }) {
  return (
    <div className="progress">
      {Array.from({ length: of }, (_, i) => (
        <i key={i} className={i < n ? 'on' : ''} />
      ))}
    </div>
  )
}

export function Scale({ value, onChange }: { value: number; onChange: (n: number) => void }) {
  return (
    <div className="scale">
      {[1, 2, 3, 4, 5].map((n) => (
        <button key={n} className={value === n ? 'on' : ''} onClick={() => onChange(n)}>
          {n}
        </button>
      ))}
    </div>
  )
}

export const buzz = (ms: number | number[] = 12) => {
  try {
    navigator.vibrate?.(ms)
  } catch {
    /* iPhone kann das nicht – egal */
  }
}
