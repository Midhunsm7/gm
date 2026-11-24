import { PhysicsWorld, Impact, initPhysics } from './physics'
import { AIController } from './ai'
import { Opponent } from './opponents'
import { DT, HOME, PLAYER_MAX_SPEED } from './constants'
import { Rng } from './util'

export type Mode = 'championship' | 'survival' | 'quick'
export type Phase = 'idle' | 'ready' | 'countdown' | 'playing' | 'goal' | 'ended' | 'paused'

export interface MatchConfig {
  mode: Mode
  level: number
  opponent: Opponent
  targetScore: number
  survivalWins?: number
  difficultyMod?: number
}
export interface MatchResult {
  cfg: MatchConfig
  won: boolean
  playerScore: number
  aiScore: number
  durationMs: number
  maxDeficit: number
  maxLead: number
}

export interface EngineEvents {
  impact: Impact
  goal: { scorer: 0 | 1; score: [number, number] }
  countdown: { n: number; total: number }
  go: undefined
  matchEnd: MatchResult
  phase: Phase
  serve: { side: 0 | 1 }
}

type Listener<K extends keyof EngineEvents> = (e: EngineEvents[K]) => void

/** Framework-free match simulation: fixed-step physics, AI, scoring, phases. */
export class GameEngine {
  phys!: PhysicsWorld
  phase: Phase = 'idle'
  score: [number, number] = [0, 0]
  cfg!: MatchConfig
  ai: AIController | null = null
  playerAI: AIController | null = null
  rng: Rng
  // input
  target = { x: 0, y: HOME[0].y }
  keys = { x: 0, y: 0 }
  usingKeys = false
  playerMaxSpeed = PLAYER_MAX_SPEED
  // timing
  simTime = 0 // seconds of live play this match
  private clock = 0
  private acc = 0
  private phaseT = 0
  private cdLeft = 0
  private cdTotal = 0
  private cdT = 0
  private resumePhase: Phase = 'idle'
  private serveSide: 0 | 1 = 0
  private maxDef = 0
  private maxLead = 0
  steps = 0
  disposed = false
  private stallT = 0
  // interpolation buffers
  private prev = { puck: [0, 0], p: [[0, 0], [0, 0]] }
  private cur = { puck: [0, 0], p: [[0, 0], [0, 0]] }
  render = { puck: { x: 0, y: 0, vx: 0, vy: 0 }, pad: [{ x: 0, y: HOME[0].y }, { x: 0, y: HOME[1].y }], alpha: 0 }
  private ls: { [K in keyof EngineEvents]?: Listener<K>[] } = {}

  constructor(rng: Rng = Math.random) {
    this.rng = rng
  }

  static async create(rng?: Rng) {
    await initPhysics()
    const e = new GameEngine(rng)
    e.phys = new PhysicsWorld()
    return e
  }

  on<K extends keyof EngineEvents>(k: K, fn: Listener<K>) {
    ;(this.ls[k] ||= [] as any).push(fn as any)
    return () => { this.ls[k] = (this.ls[k] as any[]).filter((f) => f !== fn) as any }
  }
  private emit<K extends keyof EngineEvents>(k: K, e: EngineEvents[K]) {
    const a = this.ls[k] as Listener<K>[] | undefined
    if (a) for (const f of a.slice()) f(e)
  }
  private setPhase(p: Phase) { this.phase = p; this.phaseT = 0; this.emit('phase', p) }

  /** Prepare a match (puck frozen). Call begin() once the intro has played. */
  load(cfg: MatchConfig, opts: { playerAI?: Opponent } = {}) {
    this.cfg = cfg
    this.score = [0, 0]
    this.simTime = 0
    this.maxDef = 0
    this.maxLead = 0
    this.ai = new AIController(cfg.opponent.params, false, this.rng)
    this.playerAI = opts.playerAI ? new AIController(opts.playerAI.params, true, this.rng) : null
    this.serveSide = 0
    this.resetRound(0)
    this.updateRender()
    this.setPhase('ready')
  }

  begin() {
    if (this.phase !== 'ready') return
    this.startCountdown(3, 0.75)
  }

  private startCountdown(n: number, step: number) {
    this.cdLeft = n
    this.cdTotal = n
    this.cdT = step
    this.cdStep = step
    this.setPhase('countdown')
    this.emit('countdown', { n, total: n })
  }
  private cdStep = 0.75

  private resetRound(serve: 0 | 1) {
    this.serveSide = serve
    this.phys.setPaddle(0, HOME[0].x, HOME[0].y)
    this.phys.setPaddle(1, HOME[1].x, HOME[1].y)
    this.phys.freezePuck(false)
    this.phys.setPuck(0, serve === 0 ? -0.42 : 0.42)
    this.phys.freezePuck(true)
    this.target = { x: HOME[0].x, y: HOME[0].y }
    this.ai?.reset()
    this.playerAI?.reset()
    this.acc = 0
    this.snapshot(true)
    this.emit('serve', { side: serve })
  }

  setTarget(x: number, y: number) { this.target.x = x; this.target.y = y; this.usingKeys = false }

  pause() {
    if (this.phase === 'countdown' || this.phase === 'playing' || this.phase === 'goal') {
      this.resumePhase = this.phase
      this.phase = 'paused'
      this.emit('phase', 'paused')
    }
  }
  resume() {
    if (this.phase === 'paused') { this.phase = this.resumePhase; this.acc = 0; this.emit('phase', this.phase) }
  }

  private snapshot(both: boolean) {
    const p = this.phys.puckPos
    const a = this.phys.paddles[0].translation()
    const b = this.phys.paddles[1].translation()
    if (both) {
      this.prev.puck = [p.x, p.y]; this.prev.p = [[a.x, a.y], [b.x, b.y]]
    } else {
      this.prev.puck = this.cur.puck; this.prev.p = this.cur.p
    }
    this.cur.puck = [p.x, p.y]; this.cur.p = [[a.x, a.y], [b.x, b.y]]
  }

  private stepOnce() {
    const ph = this.phys
    const pp = ph.puckPos, pv = ph.puckVel
    const pa = ph.paddles[0].translation(), pb = ph.paddles[1].translation()
    // player paddle
    if (this.playerAI) {
      const o = this.playerAI.think(this.clock, { x: pp.x, y: pp.y, vx: pv.x, vy: pv.y }, pa, pb, this.score[0], this.score[1])
      ph.movePaddle(0, o.x, o.y, o.speed)
    } else if (this.usingKeys && (this.keys.x || this.keys.y)) {
      ph.movePaddle(0, pa.x + this.keys.x * 0.3, pa.y + this.keys.y * 0.3, this.playerMaxSpeed)
    } else ph.movePaddle(0, this.target.x, this.target.y, this.playerMaxSpeed)
    // AI paddle (same limits via movePaddle; speed capped by profile <= player max)
    if (this.ai) {
      const o = this.ai.think(this.clock, { x: pp.x, y: pp.y, vx: pv.x, vy: pv.y }, pb, pa, this.score[1], this.score[0])
      ph.movePaddle(1, o.x, o.y, Math.min(o.speed, PLAYER_MAX_SPEED))
    }
    const scorer = ph.step()
    this.clock += DT
    this.steps++
    this.snapshot(false)
    if (this.phase === 'playing') {
      this.simTime += DT
      // stall guard: a puck resting in the dead zone around the centre line is moved to the nearer half
      const q = ph.puckPos, qv = ph.puckVel
      if (Math.hypot(qv.x, qv.y) < 0.03 && Math.abs(q.y) < 0.2) {
        this.stallT += DT
        if (this.stallT > 3) { ph.setPuck(0, q.y <= 0 ? -0.42 : 0.42); this.stallT = 0 }
      } else this.stallT = 0
    }
    for (const im of ph.impacts) this.emit('impact', im)
    ph.impacts.length = 0
    if (scorer !== null && this.phase === 'playing') this.onGoal(scorer)
  }

  private onGoal(scorer: 0 | 1) {
    this.lastScorerV = scorer
    this.score[scorer]++ // phase flips to 'goal' immediately so a goal can never count twice
    this.maxDef = Math.max(this.maxDef, this.score[1] - this.score[0])
    this.maxLead = Math.max(this.maxLead, this.score[0] - this.score[1])
    this.setPhase('goal')
    this.emit('goal', { scorer, score: [this.score[0], this.score[1]] })
  }

  /** Advance by a real frame delta (seconds). */
  update(dtReal: number) {
    if (this.disposed) return
    const ph = this.phase
    if (ph === 'idle' || ph === 'ready' || ph === 'paused' || ph === 'ended') return
    dtReal = Math.min(dtReal, 0.1)
    this.phaseT += dtReal
    if (ph === 'countdown') {
      this.cdT -= dtReal
      if (this.cdT <= 0) {
        this.cdLeft--
        if (this.cdLeft <= 0) {
          this.phys.freezePuck(false)
          this.setPhase('playing')
          this.emit('go', undefined)
        } else {
          this.cdT += this.cdStep
          this.emit('countdown', { n: this.cdLeft, total: this.cdTotal })
        }
      }
    } else if (ph === 'goal' && this.phaseT > 1.5) {
      const [p, a] = this.score
      if (p >= this.cfg.targetScore || a >= this.cfg.targetScore) {
        this.setPhase('ended')
        this.emit('matchEnd', this.result())
        return
      }
      this.resetRound(this.lastScorer === 0 ? 1 : 0) // conceder serves
      this.startCountdown(2, 0.55)
    }
    const scale = this.phase === 'goal' && this.phaseT < 0.9 ? 0.3 : 1
    this.acc += dtReal * scale
    let n = 0
    while (this.acc >= DT && n < 16) { this.stepOnce(); this.acc -= DT; n++ }
    if (n === 16) this.acc = 0
    this.updateRender()
  }
  private get lastScorer(): 0 | 1 { return this.lastScorerV }
  private lastScorerV: 0 | 1 = 0

  private updateRender() {
    const a = this.acc / DT
    const r = this.render
    r.alpha = a
    r.puck.x = this.prev.puck[0] + (this.cur.puck[0] - this.prev.puck[0]) * a
    r.puck.y = this.prev.puck[1] + (this.cur.puck[1] - this.prev.puck[1]) * a
    const v = this.phys.puckVel
    r.puck.vx = v.x; r.puck.vy = v.y
    for (let i = 0; i < 2; i++) {
      r.pad[i].x = this.prev.p[i][0] + (this.cur.p[i][0] - this.prev.p[i][0]) * a
      r.pad[i].y = this.prev.p[i][1] + (this.cur.p[i][1] - this.prev.p[i][1]) * a
    }
  }

  result(): MatchResult {
    const [p, a] = this.score
    return { cfg: this.cfg, won: p > a, playerScore: p, aiScore: a, durationMs: Math.round(this.simTime * 1000), maxDeficit: this.maxDef, maxLead: this.maxLead }
  }

  /** Test helper: run a whole match headless at a given frame rate. */
  runToEnd(fps = 60, maxSeconds = 600): MatchResult | null {
    let res: MatchResult | null = null
    const off = this.on('matchEnd', (r) => (res = r))
    this.begin()
    const dt = 1 / fps
    for (let t = 0; t < maxSeconds && !res; t += dt) this.update(dt)
    off()
    return res
  }

  dispose() { if (this.disposed) return; this.disposed = true; this.phys.dispose() }
}
