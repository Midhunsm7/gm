import RAPIER from '@dimforge/rapier2d-compat'
import { TABLE, PUCK_R, PADDLE_R, DT, PUCK_MAX_SPEED, PADDLE_ACCEL, PADDLE_GAIN } from './constants'
import { clamp } from './util'

let ready: Promise<void> | null = null
export const initPhysics = () => (ready ??= RAPIER.init())

export type ImpactKind = 'paddle0' | 'paddle1' | 'wall'
export interface Impact { kind: ImpactKind; intensity: number; x: number; y: number }

export class PhysicsWorld {
  world: RAPIER.World
  puck: RAPIER.RigidBody
  paddles: RAPIER.RigidBody[] = []
  impacts: Impact[] = []
  respawned = false
  private queue = new RAPIER.EventQueue(true)
  private puckH: number
  private padH: number[] = []
  private frozen = false

  constructor() {
    this.world = new RAPIER.World({ x: 0, y: 0 })
    this.world.timestep = DT
    this.world.integrationParameters.numSolverIterations = 8
    const { W, L, goalW, wallT, pocket } = TABLE
    const wall = (hx: number, hy: number, x: number, y: number) =>
      this.world.createCollider(RAPIER.ColliderDesc.cuboid(hx, hy).setTranslation(x, y).setRestitution(0.95).setFriction(0))
    const sideHalfLen = L / 2 + wallT + pocket
    for (const s of [-1, 1]) {
      wall(wallT / 2, sideHalfLen, s * (W / 2 + wallT / 2), 0) // long side walls
      for (const e of [-1, 1]) {
        const hw = (W / 2 + wallT - goalW / 2) / 2
        wall(hw, wallT / 2, s * (goalW / 2 + hw), e * (L / 2 + wallT / 2)) // end wall segments beside goals
        wall(0.01, pocket / 2, s * (goalW / 2 + 0.01), e * (L / 2 + wallT + pocket / 2)) // goal pocket sides
      }
    }
    for (const e of [-1, 1]) wall(goalW / 2 + 0.02, 0.01, 0, e * (L / 2 + wallT + pocket + 0.01)) // pocket backs

    this.puck = this.world.createRigidBody(
      RAPIER.RigidBodyDesc.dynamic().setTranslation(0, 0).setLinearDamping(0.12).setCcdEnabled(true).lockRotations(),
    )
    const pc = this.world.createCollider(
      RAPIER.ColliderDesc.ball(PUCK_R).setDensity(1 / (Math.PI * PUCK_R * PUCK_R)).setRestitution(0.95).setFriction(0)
        .setActiveEvents(RAPIER.ActiveEvents.COLLISION_EVENTS),
      this.puck,
    )
    this.puckH = pc.handle
    for (let i = 0; i < 2; i++) {
      const b = this.world.createRigidBody(RAPIER.RigidBodyDesc.kinematicVelocityBased().setTranslation(0, i ? 0.75 : -0.75))
      const c = this.world.createCollider(RAPIER.ColliderDesc.ball(PADDLE_R).setRestitution(0.55).setFriction(0), b)
      this.paddles.push(b)
      this.padH.push(c.handle)
    }
  }

  paddleBounds(i: number) {
    const x1 = TABLE.W / 2 - PADDLE_R
    return i === 0
      ? { x0: -x1, x1, y0: -TABLE.L / 2 + PADDLE_R, y1: -PADDLE_R - 0.004 }
      : { x0: -x1, x1, y0: PADDLE_R + 0.004, y1: TABLE.L / 2 - PADDLE_R }
  }

  /** Same limits for everyone: speed cap, acceleration cap, stay in own half. */
  movePaddle(i: number, tx: number, ty: number, maxSpeed: number) {
    const b = this.paddles[i]
    const p = b.translation()
    const v = b.linvel()
    const L = this.paddleBounds(i)
    tx = clamp(tx, L.x0, L.x1)
    ty = clamp(ty, L.y0, L.y1)
    let dx = (tx - p.x) * PADDLE_GAIN
    let dy = (ty - p.y) * PADDLE_GAIN
    const m = Math.hypot(dx, dy)
    if (m > maxSpeed) { dx *= maxSpeed / m; dy *= maxSpeed / m }
    let ax = dx - v.x
    let ay = dy - v.y
    const am = Math.hypot(ax, ay)
    const amax = PADDLE_ACCEL * DT
    if (am > amax) { ax *= amax / am; ay *= amax / am }
    let nvx = v.x + ax
    let nvy = v.y + ay
    nvx = (clamp(p.x + nvx * DT, L.x0, L.x1) - p.x) / DT
    nvy = (clamp(p.y + nvy * DT, L.y0, L.y1) - p.y) / DT
    b.setLinvel({ x: nvx, y: nvy }, true)
  }

  setPaddle(i: number, x: number, y: number) {
    this.paddles[i].setTranslation({ x, y }, true)
    this.paddles[i].setLinvel({ x: 0, y: 0 }, true)
  }

  setPuck(x: number, y: number, vx = 0, vy = 0) {
    this.puck.setTranslation({ x, y }, true)
    this.puck.setLinvel({ x: vx, y: vy }, true)
  }

  /** Freeze the puck (countdown) so paddles can still move without disturbing it. */
  freezePuck(f: boolean) {
    if (f === this.frozen) return
    this.frozen = f
    this.puck.setBodyType(f ? RAPIER.RigidBodyType.Fixed : RAPIER.RigidBodyType.Dynamic, true)
    if (!f) this.puck.setLinvel({ x: 0, y: 0 }, true)
  }

  /** One fixed step. Returns scorer index (0 player, 1 AI) when the puck crosses a goal line. */
  step(): 0 | 1 | null {
    const pv = this.puck.linvel()
    const pvx = pv.x, pvy = pv.y
    this.world.step(this.queue)
    this.respawned = false
    let t = this.puck.translation()
    let v = this.puck.linvel()
    if (!this.frozen) {
      this.queue.drainCollisionEvents((h1, h2, started) => {
        if (!started) return
        const o = h1 === this.puckH ? h2 : h1
        const intensity = Math.hypot(v.x - pvx, v.y - pvy)
        if (intensity < 0.12) return
        const kind: ImpactKind = o === this.padH[0] ? 'paddle0' : o === this.padH[1] ? 'paddle1' : 'wall'
        this.impacts.push({ kind, intensity, x: t.x, y: t.y })
      })
    } else this.queue.drainCollisionEvents(() => {})

    if (this.frozen) return null
    // speed cap
    const sp = Math.hypot(v.x, v.y)
    if (!Number.isFinite(sp) || !Number.isFinite(t.x) || !Number.isFinite(t.y)) {
      this.setPuck(0, 0)
      this.respawned = true
      return null
    }
    if (sp > PUCK_MAX_SPEED) {
      this.puck.setLinvel({ x: (v.x / sp) * PUCK_MAX_SPEED, y: (v.y / sp) * PUCK_MAX_SPEED }, true)
      v = this.puck.linvel()
    }
    // safety net against tunnelling/squeezing: keep the puck inside the legal volume
    const inGoalMouth = Math.abs(t.x) < TABLE.goalW / 2 - 0.005
    const xMax = TABLE.W / 2 - PUCK_R
    const yLimit = inGoalMouth ? TABLE.L / 2 + TABLE.pocket + TABLE.wallT - PUCK_R : TABLE.L / 2 - PUCK_R
    let nx = t.x, ny = t.y, nvx = v.x, nvy = v.y, fix = false
    if (Math.abs(nx) > xMax + 0.004 && Math.abs(nx) < xMax + 0.3) { nx = Math.sign(nx) * xMax; nvx = -nvx * 0.8; fix = true }
    if (Math.abs(ny) > yLimit + 0.004 && Math.abs(ny) < yLimit + 0.3) { ny = Math.sign(ny) * yLimit; nvy = -nvy * 0.8; fix = true }
    if (Math.abs(nx) >= xMax + 0.3 || Math.abs(ny) >= yLimit + 0.3) {
      // escaped completely (should never happen): respawn at centre
      this.setPuck(0, 0)
      this.respawned = true
      return null
    }
    if (fix) {
      this.puck.setTranslation({ x: nx, y: ny }, true)
      this.puck.setLinvel({ x: nvx, y: nvy }, true)
      t = { x: nx, y: ny }
    }
    if (inGoalMouth && Math.abs(t.y) > TABLE.L / 2 + 0.005) return t.y < 0 ? 1 : 0
    return null
  }

  get puckPos() { return this.puck.translation() }
  get puckVel() { return this.puck.linvel() }
  dispose() { this.world.free() }
}
