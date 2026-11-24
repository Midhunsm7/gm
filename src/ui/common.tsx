import { ReactNode } from 'react'
import { motion } from 'framer-motion'
import { audio } from '../audio'
import { buzz } from '../haptics'
import { Screen, useStore } from '../store'
import { Backdrop, BackdropTone } from './Backdrop'

export function Btn({ children, onClick, variant = 'primary', disabled, small, className = '', accent }: {
  children: ReactNode; onClick?: () => void; variant?: 'primary' | 'ghost' | 'danger' | 'gold'; disabled?: boolean; small?: boolean; className?: string; accent?: string
}) {
  return (
    <button className={`btn ${variant} ${small ? 'small' : ''} ${className}`} disabled={disabled} style={accent ? { ['--a' as string]: accent } : undefined}
      onClick={() => { audio.play('ui'); buzz('ui'); onClick?.() }}>
      {children}
    </button>
  )
}

export function Page({ title, children, back = 'menu', right, theme, icon }: { title: string; children: ReactNode; back?: Screen; right?: ReactNode; theme?: BackdropTone; icon?: string }) {
  const go = useStore((s) => s.go)
  return (
    <div className={`screen ${theme ? `themed theme-${theme}` : ''}`}>
      {theme && <Backdrop tone={theme} />}
      <motion.header className="page-head" initial={{ opacity: 0, y: -18 }} animate={{ opacity: 1, y: 0 }} transition={{ type: 'spring', stiffness: 260, damping: 20 }}>
        <button className="icon-btn" aria-label="Back" onClick={() => { audio.play('ui'); go(back) }}>‹</button>
        {icon && <span className="head-icon" aria-hidden>{icon}</span>}
        <h2>{title}</h2>
        <div className="grow" />
        {right}
      </motion.header>
      <div className="page-body">{children}</div>
    </div>
  )
}

export function Toggle({ label, value, onChange, hint, disabled }: { label: string; value: boolean; onChange: (v: boolean) => void; hint?: string; disabled?: boolean }) {
  return (
    <label className={`row toggle ${disabled ? 'dim' : ''}`}>
      <span><b>{label}</b>{hint && <small>{hint}</small>}</span>
      <input type="checkbox" checked={value} disabled={disabled} onChange={(e) => { audio.play('ui'); onChange(e.target.checked) }} />
      <i className="switch" aria-hidden />
    </label>
  )
}

export function Slider({ label, value, onChange, min = 0, max = 1, step = 0.01, fmt }: {
  label: string; value: number; onChange: (v: number) => void; min?: number; max?: number; step?: number; fmt?: (v: number) => string
}) {
  return (
    <label className="row slider">
      <span><b>{label}</b></span>
      <input type="range" min={min} max={max} step={step} value={value} onChange={(e) => onChange(parseFloat(e.target.value))} />
      <em>{fmt ? fmt(value) : `${Math.round(value * 100)}%`}</em>
    </label>
  )
}

export function Pips({ n, max = 10, color = 'var(--cyan)', anim }: { n: number; max?: number; color?: string; anim?: boolean }) {
  return (
    <span className={`pips ${anim ? 'anim' : ''}`} aria-label={`Difficulty ${n} of ${max}`}>
      {Array.from({ length: max }, (_, i) => <i key={i} style={{ ...(i < n ? { background: color, boxShadow: `0 0 6px ${color}` } : null), ['--i' as string]: i }} />)}
    </span>
  )
}

/** Pill-style option picker; the highlight slides between options with a CSS transition (no shared-layout animation, which can stall page exits). */
export function Segmented<T extends string | number>({ options, value, onChange }: {
  id?: string; options: { value: T; label: ReactNode; color?: string }[]; value: T; onChange: (v: T) => void
}) {
  const idx = Math.max(0, options.findIndex((o) => o.value === value))
  return (
    <div className="segmented" role="radiogroup" style={{ ['--n' as string]: options.length, ['--i' as string]: idx }}>
      <span className="seg-pill" aria-hidden style={{ ['--c' as string]: options[idx]?.color ?? 'var(--cyan)' }} />
      {options.map((o) => {
        const on = o.value === value
        return (
          <motion.button key={String(o.value)} role="radio" aria-checked={on} className={`seg-btn ${on ? 'on' : ''}`} style={{ ['--c' as string]: o.color ?? 'var(--cyan)' }}
            whileTap={{ scale: 0.92 }} whileHover={{ y: -2 }}
            onClick={() => { audio.play('ui'); buzz('ui'); onChange(o.value) }}>
            <span className="seg-label">{o.label}</span>
          </motion.button>
        )
      })}
    </div>
  )
}

export function Modal({ children, onClose }: { children: ReactNode; onClose?: () => void }) {
  return (
    <motion.div className="modal-wrap" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose}>
      <motion.div className="modal" initial={{ scale: 0.9, y: 20 }} animate={{ scale: 1, y: 0 }} onClick={(e) => e.stopPropagation()}>
        {children}
      </motion.div>
    </motion.div>
  )
}
