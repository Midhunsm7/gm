import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { PointerEvent as ReactPointerEvent } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { GameEngine, MatchConfig, Phase } from '../core/engine'
import { clamp } from '../core/util'
import { useStore } from '../store'
import { audio } from '../audio'
import { buzz } from '../haptics'
import { Arena, ArenaApi } from './Arena'
import { Intro } from '../ui/Intro'
import { Btn } from '../ui/common'
import { Loading } from '../ui/Loading'
import { SettingsPanel } from '../ui/Settings'

const KEYMAP: Record<string, [number, number]> = {
  KeyW: [0, 1], ArrowUp: [0, 1], KeyS: [0, -1], ArrowDown: [0, -1], KeyA: [-1, 0], ArrowLeft: [-1, 0], KeyD: [1, 0], ArrowRight: [1, 0],
}

export function GameView({ cfg }: { cfg: MatchConfig }) {
  const settings = useStore((s) => s.save.settings)
  const run = useStore((s) => s.run)
  const finishMatch = useStore((s) => s.finishMatch)
  const restart = useStore((s) => s.restartMatch)
  const quit = useStore((s) => s.quitToMenu)
  const updateSettings = useStore((s) => s.updateSettings)
  const results = useStore((s) => s.results)

  const [engine, setEngine] = useState<GameEngine | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [intro, setIntro] = useState(true)
  const [score, setScore] = useState<[number, number]>([0, 0])
  const [phase, setPhase] = useState<Phase>('idle')
  const [count, setCount] = useState<number | null>(null)
  const [goal, setGoal] = useState<{ scorer: 0 | 1; n: number } | null>(null)
  const [showSettings, setShowSettings] = useState(false)
  const api = useMemo<ArenaApi>(() => ({ toTable: null }), [])
  const eng = useRef<GameEngine | null>(null)
  const began = useRef(false)
  // pointer tracking: rx/ry = last raw pointer position, tx/ty = paddle target (always inside the playable area)
  const ptr = useRef<{ rx: number; ry: number; tx: number; ty: number } | null>(null)
  const cfgRef = useRef(cfg)
  const setRef = useRef(settings)
  setRef.current = settings

  // ---- engine lifecycle (one engine per mounted match)
  useEffect(() => {
    let dead = false
    const offs: (() => void)[] = []
    GameEngine.create().then((e) => {
      if (dead) { e.dispose(); return }
      eng.current = e
      offs.push(
        e.on('impact', (im) => {
          const k = clamp(im.intensity / 5, 0, 1)
          audio.play(im.kind === 'wall' ? 'wall' : 'paddle', k)
          if (im.kind === 'paddle0' && im.intensity > 0.6) buzz('paddle', k)
          else if (im.kind === 'wall' && im.intensity > 1.4) buzz('wall', k)
        }),
        e.on('goal', (g) => {
          setScore(g.score)
          setGoal({ scorer: g.scorer, n: g.score[0] + g.score[1] })
          audio.play(g.scorer === 0 ? 'goalFor' : 'goalAgainst')
          buzz(g.scorer === 0 ? 'goalFor' : 'goalAgainst')
          window.setTimeout(() => setGoal(null), 1400)
        }),
        e.on('countdown', (c) => { setCount(c.n); audio.play('count') }),
        e.on('go', () => { setCount(0); audio.play('go'); window.setTimeout(() => setCount(null), 650) }),
        e.on('phase', (p) => setPhase(p)),
        e.on('matchEnd', (r) => finishMatch(r)),
      )
      e.load(cfgRef.current)
      setEngine(e)
    }).catch((err) => { if (!dead) setError(String(err?.message ?? err)) })
    return () => { dead = true; offs.forEach((f) => f()); eng.current?.dispose(); eng.current = null }
  }, [finishMatch])

  const startPlay = useCallback(() => {
    if (began.current || !eng.current) return
    began.current = true
    setIntro(false)
    eng.current.begin()
  }, [])
  // auto-continue once the engine is ready and the intro is dismissed is handled by Intro's onDone
  const introDone = useCallback(() => { if (eng.current) startPlay(); else setIntro(false) }, [startPlay])
  useEffect(() => { if (engine && !intro && !began.current) startPlay() }, [engine, intro, startPlay])

  // ---- pause when the app is hidden / loses focus
  const doPause = useCallback(() => { eng.current?.pause() }, [])
  useEffect(() => {
    const vis = () => { if (document.hidden) doPause() }
    document.addEventListener('visibilitychange', vis)
    window.addEventListener('pagehide', doPause)
    return () => { document.removeEventListener('visibilitychange', vis); window.removeEventListener('pagehide', doPause) }
  }, [doPause])

  // ---- keep the screen awake while playing
  useEffect(() => {
    let lock: { release(): Promise<void> } | null = null
    const get = async () => { try { lock = await (navigator as unknown as { wakeLock?: { request(t: 'screen'): Promise<{ release(): Promise<void> }> } }).wakeLock?.request('screen') ?? null } catch { /* optional */ } }
    void get()
    const vis = () => { if (!document.hidden) void get() }
    document.addEventListener('visibilitychange', vis)
    return () => { document.removeEventListener('visibilitychange', vis); void lock?.release() }
  }, [])

  // ---- keyboard
  useEffect(() => {
    const down = new Set<string>()
    const apply = () => {
      const e = eng.current
      if (!e) return
      let x = 0, y = 0
      down.forEach((c) => { const m = KEYMAP[c]; if (m) { x += m[0]; y += m[1] } })
      e.keys.x = clamp(x, -1, 1); e.keys.y = clamp(y, -1, 1)
      if (x || y) { e.usingKeys = true; ptr.current = null }
      else if (e.usingKeys) { e.target = { x: e.render.pad[0].x, y: e.render.pad[0].y }; e.usingKeys = false }
    }
    const kd = (ev: KeyboardEvent) => {
      audio.unlock()
      if (ev.code === 'Escape' || ev.code === 'KeyP') { ev.preventDefault(); const e = eng.current; if (e?.phase === 'paused') e.resume(); else e?.pause(); return }
      if (KEYMAP[ev.code]) { ev.preventDefault(); down.add(ev.code); apply() }
    }
    const ku = (ev: KeyboardEvent) => { if (KEYMAP[ev.code]) { down.delete(ev.code); apply() } }
    const blur = () => { down.clear(); apply() }
    window.addEventListener('keydown', kd)
    window.addEventListener('keyup', ku)
    window.addEventListener('blur', blur)
    return () => { window.removeEventListener('keydown', kd); window.removeEventListener('keyup', ku); window.removeEventListener('blur', blur) }
  }, [])

  // ---- mouse / touch / pen: direct paddle control inside the player's half (clamped by the physics layer)
  const onPointer = (ev: ReactPointerEvent<HTMLDivElement>) => {
    const e = eng.current
    if (!e || !api.toTable) return
    if (ev.pointerType !== 'mouse' && ev.type === 'pointermove' && ev.buttons === 0) return
    if (ev.type === 'pointerdown') { audio.unlock(); try { ev.currentTarget.setPointerCapture(ev.pointerId) } catch { /* ignore */ } }
    if (e.phase === 'paused' || e.phase === 'ended') { ptr.current = null; return }
    const p = api.toTable(ev.clientX, ev.clientY)
    if (!p) return
    const off = ev.pointerType === 'mouse' ? 0 : setRef.current.touchOffset
    const rx = p.x, ry = p.y + off
    const b = e.phys.paddleBounds(0)
    let st = ptr.current
    if (!st || ev.type === 'pointerdown') {
      st = ptr.current = { rx, ry, tx: clamp(rx, b.x0, b.x1), ty: clamp(ry, b.y0, b.y1) }
    } else {
      // Follow pointer *movement*, so overshooting the table edge never builds up a dead zone:
      // reversing direction moves the paddle immediately. While the pointer is inside the playable
      // area the target eases back onto it (no visible jump).
      let tx = st.tx + (rx - st.rx)
      let ty = st.ty + (ry - st.ry)
      if (rx >= b.x0 && rx <= b.x1) tx += (rx - tx) * 0.15
      if (ry >= b.y0 && ry <= b.y1) ty += (ry - ty) * 0.15
      st.tx = clamp(tx, b.x0, b.x1); st.ty = clamp(ty, b.y0, b.y1); st.rx = rx; st.ry = ry
    }
    e.setTarget(st.tx, st.ty)
  }

  const paused = phase === 'paused' && !results
  const label = cfg.mode === 'championship' ? `LEVEL ${cfg.level}` : cfg.mode === 'survival' ? `STREAK ${run?.wins ?? cfg.survivalWins ?? 0}` : 'QUICK MATCH'
  const o = cfg.opponent

  if (error) return <div className="screen center"><h2>Couldn't start the arena</h2><p className="hint">{error}</p><Btn onClick={quit}>Back to menu</Btn></div>

  return (
    <div className="game" style={{ ['--c' as string]: o.color }}>
      <div className="arena" onPointerDown={onPointer} onPointerMove={onPointer}>
        {engine ? <Arena engine={engine} api={api} oppColor={o.color} shake={settings.shake} quality={settings.quality} playerColor={settings.paddleColor} puckColor={settings.puckColor} light={settings.theme === 'light'} /> : <Loading label="Loading arena" />}
      </div>

      {!results && (
        <div className="hud">
          <div className="hud-left">
            <button className="icon-btn" aria-label="Pause" onClick={() => { audio.unlock(); eng.current?.pause() }}>❚❚</button>
            <button className="icon-btn" aria-label={settings.mute ? 'Unmute' : 'Mute'} onClick={() => updateSettings({ mute: !settings.mute })}>{settings.mute ? '🔇' : '🔊'}</button>
          </div>
          <div className="hud-score">
            <div className="names"><span className="you">YOU</span><span className="opp">{o.name}</span></div>
            <div className="nums">
              <motion.b key={`p${score[0]}`} initial={{ scale: 1.7 }} animate={{ scale: 1 }}>{score[0]}</motion.b>
              <span>:</span>
              <motion.b key={`a${score[1]}`} initial={{ scale: 1.7 }} animate={{ scale: 1 }}>{score[1]}</motion.b>
            </div>
          </div>
          <div className="hud-right"><b>{label}</b><small>FIRST TO {cfg.targetScore}</small></div>
        </div>
      )}

      <AnimatePresence>
        {count !== null && !paused && <motion.div key={`c${count}`} className="countdown" initial={{ scale: 2.2, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ opacity: 0, scale: 0.6 }}>{count === 0 ? 'GO!' : count}</motion.div>}
        {goal && (
          <motion.div key={`g${goal.n}`} className={`goal-flash ${goal.scorer === 0 ? 'mine' : 'theirs'}`} initial={{ scale: 0.3, opacity: 0, rotate: -8 }} animate={{ scale: [0.3, 1.25, 1], opacity: 1, rotate: 0 }} exit={{ opacity: 0, scale: 1.4 }}>
            GOAL!<small>{goal.scorer === 0 ? 'You scored' : `${o.name} scores`}</small>
          </motion.div>
        )}
        {intro && engine && <Intro key="intro" cfg={cfg} onDone={introDone} />}
        {paused && (
          <motion.div key="pause" className="pause" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <div className="pause-card">
              <h2>PAUSED</h2>
              {showSettings ? (
                <>
                  <SettingsPanel showDanger={false} />
                  <div className="actions"><Btn small onClick={() => setShowSettings(false)}>Back</Btn></div>
                </>
              ) : (
                <div className="menu-list">
                  <Btn onClick={() => eng.current?.resume()}>Resume</Btn>
                  <Btn variant="ghost" onClick={restart}>Restart match</Btn>
                  <Btn variant="ghost" onClick={() => setShowSettings(true)}>Settings</Btn>
                  <Btn variant="danger" onClick={quit}>Return to menu</Btn>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
