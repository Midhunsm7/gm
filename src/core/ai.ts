import { TABLE, PUCK_R, PADDLE_R, DT } from './constants'
import { AIParams } from './opponents'
import { clamp, lerp, Rng } from './util'

interface Obs { t: number; x: number; y: number; vx: number; vy: number }
export interface AIOutput { x: number; y: number; speed: number; mode: 'defend' | 'attack' | 'strike' | 'recover' }

const HALF = TABLE.W / 2 - PUCK_R
const GOAL_Y = TABLE.L / 2

/** x of a puck travelling with (x, vx) after t seconds, reflecting off side walls. */
export function foldX(x: number, vx: number, t: number) {
  const span = HALF * 2
  let u = x + HALF + vx * t
  u = ((u % (2 * span)) + 2 * span) % (2 * span)
  if (u > span) u = 2 * span - u
  return u - HALF
}

/**
 * Decision engine. Works in a local frame in which the AI defends y = +L/2 and attacks toward y = -L/2
 * (mirror = true flips world coords so it can also drive the player's side in simulations).
 * It outputs a *target*; the physics layer applies the same speed/acceleration limits as the player.
 */
export class AIController {
  private hist: Obs[] = []
  private noiseX = 0
  private noiseT = 0
  private aimX = 0
  private aimErr = 0
  private aimBank = false
  private aimT = -1
  private lanes: number[] = []
  private lastCrossY = 0
  private episode = 0
  mode: AIOutput['mode'] = 'defend'
  constructor(public p: AIParams, private mirror: boolean, private rng: Rng = Math.random) {}

  reset() { this.hist.length = 0; this.aimT = -1; this.episode = 0 }

  think(t: number, puckW: { x: number; y: number; vx: number; vy: number }, meW: { x: number; y: number },
        oppW: { x: number; y: number }, myScore: number, oppScore: number): AIOutput {
    const s = this.mirror ? -1 : 1
    const p = this.p
    const me = { x: meW.x * s, y: meW.y * s }
    const opp = { x: oppW.x * s, y: oppW.y * s }
    this.hist.push({ t, x: puckW.x * s, y: puckW.y * s, vx: puckW.vx * s, vy: puckW.vy * s })
    if (this.hist.length > 90) this.hist.shift()

    // --- perception: delayed + noisy, compensated by prediction skill
    let o = this.hist[0]
    for (let i = this.hist.length - 1; i >= 0; i--) if (this.hist[i].t <= t - p.reaction) { o = this.hist[i]; break }
    if (t - this.noiseT > 0.12) { this.noiseT = t; this.noiseX = (this.rng() - 0.5) * 2 * (1 - p.predict) * 0.1 }
    const lag = t - o.t
    const pk = { x: o.x + o.vx * lag * p.predict + this.noiseX, y: o.y + o.vy * lag * p.predict, vx: o.vx, vy: o.vy }
    pk.x = clamp(pk.x, -HALF, HALF)
    const speed = Math.hypot(pk.vx, pk.vy)

    // learn the player's shot lanes when the puck crosses the centre line toward us
    if (o.vy > 0.3 && this.lastCrossY < 0 && o.y >= 0) { this.lanes.push(o.x); if (this.lanes.length > 8) this.lanes.shift() }
    this.lastCrossY = o.y
    const laneBias = this.lanes.length ? this.lanes.reduce((a, b) => a + b, 0) / this.lanes.length : 0

    // adaptive aggression: chase more when behind, settle when ahead
    const aggr = clamp(p.aggression + (oppScore - myScore) * 0.05 * (0.3 + p.adapt), 0.05, 1)
    const out = (x: number, y: number, sp: number, m: AIOutput['mode']): AIOutput => {
      this.mode = m
      return { x: x * s, y: y * s, speed: Math.min(sp, p.speed), mode: m }
    }

    const yEngage = -0.02 + (1 - aggr) * 0.2
    const vAtk = 0.6 + aggr * 1.8 + p.predict * 0.5
    const threat = pk.vy > 1.4 && pk.y > -0.2
    const canAttack = pk.y > yEngage && (speed < vAtk || pk.vy < 0.2) && !threat

    // puck got behind us and is heading to goal: emergency recovery
    if (pk.y > me.y + PADDLE_R * 0.8 && pk.vy > 0.2 && pk.y > 0.3 && !canAttack) {
      const tg = (GOAL_Y - pk.y) / Math.max(pk.vy, 0.1)
      return out(foldX(pk.x, pk.vx, tg), GOAL_Y - PADDLE_R, p.speed, 'recover')
    }

    if (canAttack) {
      if (this.aimT < 0 || t - this.aimT > 0.6 || this.mode === 'defend') this.chooseAim(t, pk.x, opp.x, p)
      const ax = this.aimX
      let dx = ax - pk.x, dy = -GOAL_Y - pk.y
      let m = Math.hypot(dx, dy)
      dx /= m; dy /= m
      const c = Math.cos(this.aimErr), sn = Math.sin(this.aimErr)
      let D = { x: dx * c - dy * sn, y: dx * sn + dy * c }
      const gap = PADDLE_R + PUCK_R + 0.04
      let A = { x: pk.x - D.x * gap, y: pk.y - D.y * gap }
      const Ac = { x: clamp(A.x, -(TABLE.W / 2 - PADDLE_R), TABLE.W / 2 - PADDLE_R), y: clamp(A.y, PADDLE_R + 0.004, GOAL_Y - PADDLE_R) }
      if (Math.hypot(A.x - Ac.x, A.y - Ac.y) > 0.02) { // cannot get behind it: shoot along the reachable line
        const ex = pk.x - Ac.x, ey = pk.y - Ac.y
        m = Math.hypot(ex, ey) || 1
        D = { x: ex / m, y: ey / m }
        A = Ac
      }
      const w = { x: me.x - pk.x, y: me.y - pk.y }
      const proj = w.x * D.x + w.y * D.y
      const perp = D.x * w.y - D.y * w.x
      if (proj < -(PADDLE_R + PUCK_R) * 0.85 && Math.abs(perp) < 0.055) {
        return out(pk.x + D.x * 0.3, pk.y + D.y * 0.3, p.speed * (0.55 + 0.45 * p.power), 'strike')
      }
      if (proj > -0.1 && Math.abs(perp) < 0.16) { // swing around the puck
        const side = perp >= 0 ? 1 : -1
        return out(pk.x - D.y * side * 0.2 - D.x * 0.12, pk.y + D.x * side * 0.2 - D.y * 0.12, p.speed, 'attack')
      }
      return out(A.x, A.y, p.speed, 'attack')
    }
    this.aimT = -1

    // --- defence / positioning
    const yLine = GOAL_Y - 0.2 - (1 - p.defense) * 0.12
    if (pk.vy > 0.35) { // incoming: intercept at predicted point
      const tt = Math.max(0, (yLine - pk.y) / pk.vy)
      const naive = pk.x
      const px = lerp(naive, foldX(pk.x, pk.vx, tt), p.predict)
      return out(px, yLine, p.speed, 'defend')
    }
    // idle: cover goal angle between puck and goal centre, creep forward if aggressive
    const bias = laneBias * 0.5 * p.adapt
    const gx = 0, gy = GOAL_Y + 0.15
    const ex = pk.x - gx, ey = pk.y - gy
    const m = Math.hypot(ex, ey) || 1
    const d = lerp(0.5, 0.3, p.defense)
    const coverX = gx + (ex / m) * d * 1.4
    const coverY = gy + (ey / m) * d
    const forwardY = lerp(0.85, 0.5, aggr)
    const ty = clamp(lerp(coverY, forwardY, 0.5 + 0.3 * aggr * (1 - p.defense)), 0.3, GOAL_Y - PADDLE_R)
    const tx = lerp(pk.x * 0.55, coverX, p.defense) + bias
    return out(tx, ty, p.speed * 0.9, 'defend')
  }

  private chooseAim(t: number, puckX: number, oppX: number, p: AIParams) {
    this.aimT = t
    this.episode++
    const gw = TABLE.goalW / 2 - PUCK_R - 0.03
    const smart = this.rng() < p.aim
    let target = smart ? (oppX > 0 ? -1 : 1) * gw * (0.5 + 0.5 * this.rng()) : (this.rng() * 2 - 1) * gw
    this.aimBank = this.rng() < p.bank
    if (this.aimBank) { // mirror the aim point across the wall on the far side from the puck
      const wallX = puckX >= 0 ? -HALF : HALF
      target = 2 * wallX - target
    }
    this.aimX = target
    this.aimErr = (this.rng() - 0.5) * 2 * (1 - p.aim) * 0.3
  }
}
