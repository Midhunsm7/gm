import { useMemo } from 'react'

const PALETTES = {
  default: ['#3df5ff', '#ff3d8b', '#ffd166', '#b388ff'],
  gold: ['#ffd166', '#b388ff', '#3df5ff', '#ff8a5c'],
  pink: ['#ff3d8b', '#3df5ff', '#ffd166', '#ff8a5c'],
}
export type BackdropTone = keyof typeof PALETTES

/** Pure-CSS animated background: drifting colour blobs, a moving retro grid floor and rising neon sparks. */
export function Backdrop({ tone = 'default' }: { tone?: BackdropTone }) {
  const palette = PALETTES[tone]
  const sparks = useMemo(
    () => Array.from({ length: 18 }, (_, i) => ({
      left: (i * 37 + 11) % 100,
      size: 3 + (i % 4) * 2,
      dur: 9 + (i % 5) * 2.2,
      delay: -(i * 1.37),
      color: palette[i % palette.length],
    })),
    [palette],
  )
  return (
    <div className={`backdrop tone-${tone}`} aria-hidden>
      <i className="blob b1" />
      <i className="blob b2" />
      <i className="blob b3" />
      <div className="bd-floor"><div className="bd-grid" /></div>
      {sparks.map((s, i) => (
        <i key={i} className="spark" style={{ left: `${s.left}%`, width: s.size, height: s.size, background: s.color, boxShadow: `0 0 ${s.size * 3}px ${s.color}`, animationDuration: `${s.dur}s`, animationDelay: `${s.delay}s` }} />
      ))}
    </div>
  )
}
