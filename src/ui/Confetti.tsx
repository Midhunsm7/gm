import { useEffect, useRef } from 'react'

/** Lightweight canvas confetti (pooled pieces, stops itself, cleans up its loop). */
export function Confetti({ durationMs = 4200, big = false }: { durationMs?: number; big?: boolean }) {
  const ref = useRef<HTMLCanvasElement>(null)
  useEffect(() => {
    const cv = ref.current
    if (!cv) return
    const ctx = cv.getContext('2d')
    if (!ctx) return
    const dpr = Math.min(2, window.devicePixelRatio || 1)
    const resize = () => { cv.width = cv.clientWidth * dpr; cv.height = cv.clientHeight * dpr }
    resize()
    window.addEventListener('resize', resize)
    const cols = ['#3df5ff', '#ff3d8b', '#ffd166', '#7bd88f', '#b388ff', '#ffffff']
    const N = big ? 220 : 130
    const pieces = Array.from({ length: N }, (_, i) => ({
      x: Math.random() * cv.width, y: -Math.random() * cv.height * 0.6, vx: (Math.random() - 0.5) * 2.2 * dpr, vy: (2 + Math.random() * 3.5) * dpr,
      w: (6 + Math.random() * 7) * dpr, h: (4 + Math.random() * 6) * dpr, a: Math.random() * 6, va: (Math.random() - 0.5) * 0.3, c: cols[i % cols.length],
    }))
    const t0 = performance.now()
    let raf = 0
    const tick = (now: number) => {
      const t = now - t0
      ctx.clearRect(0, 0, cv.width, cv.height)
      const fade = t > durationMs - 800 ? Math.max(0, (durationMs - t) / 800) : 1
      ctx.globalAlpha = fade
      for (const p of pieces) {
        p.x += p.vx; p.y += p.vy; p.a += p.va; p.vx += Math.sin(p.a) * 0.03
        ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.a); ctx.fillStyle = p.c; ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h); ctx.restore()
      }
      if (t < durationMs) raf = requestAnimationFrame(tick)
      else ctx.clearRect(0, 0, cv.width, cv.height)
    }
    raf = requestAnimationFrame(tick)
    return () => { cancelAnimationFrame(raf); window.removeEventListener('resize', resize) }
  }, [durationMs, big])
  return <canvas ref={ref} className="confetti" aria-hidden />
}
