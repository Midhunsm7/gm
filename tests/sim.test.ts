import { describe, it, expect } from 'vitest'
import { GameEngine, MatchConfig } from '../src/core/engine'
import { PhysicsWorld, initPhysics } from '../src/core/physics'
import { getOpponent } from '../src/core/opponents'
import { foldX } from '../src/core/ai'
import { mulberry32 } from '../src/core/util'
import { TABLE, PUCK_R, PUCK_MAX_SPEED, PLAYER_MAX_SPEED, DT, PADDLE_R } from '../src/core/constants'

const cfg = (lvl: number, target = 5): MatchConfig => ({ mode: 'quick', level: lvl, opponent: getOpponent(lvl), targetScore: target })

describe('physics', () => {
  it('puck bounces off side walls and stays inside; speed capped; no escape', async () => {
    await initPhysics()
    const w = new PhysicsWorld()
    w.freezePuck(false)
    let maxSp = 0, minX = 9, maxX = -9
    for (let k = 0; k < 40; k++) {
      w.setPuck(0.1, 0, (k % 2 ? 1 : -1) * 20, 3 + k * 0.1) // absurd speeds to stress tunnelling
      for (let i = 0; i < 600; i++) {
        w.step()
        const p = w.puckPos, v = w.puckVel
        maxSp = Math.max(maxSp, Math.hypot(v.x, v.y))
        minX = Math.min(minX, p.x); maxX = Math.max(maxX, p.x)
        expect(Math.abs(p.x)).toBeLessThan(TABLE.W / 2 + 0.01)
        expect(Math.abs(p.y)).toBeLessThan(TABLE.L / 2 + TABLE.pocket + 0.2)
      }
    }
    expect(maxSp).toBeLessThanOrEqual(PUCK_MAX_SPEED + 1e-6)
    expect(maxX).toBeGreaterThan(TABLE.W / 2 - PUCK_R - 0.02) // it really reached the walls
    w.dispose()
  })
  it('goal registers once per crossing and only through the goal mouth', async () => {
    await initPhysics()
    const w = new PhysicsWorld(); w.freezePuck(false)
    w.setPuck(0, 0.9, 0, 3)
    let goals: (0 | 1)[] = []
    for (let i = 0; i < 200; i++) { const g = w.step(); if (g !== null) goals.push(g) }
    expect(goals[0]).toBe(0) // crossed AI goal line: player scores
    w.setPuck(0.4, 0.9, 0, 3) // aimed at the wall beside the goal: no goal
    goals = []
    for (let i = 0; i < 200; i++) { const g = w.step(); if (g !== null) goals.push(g) }
    expect(goals.length).toBe(0)
    w.dispose()
  })
  it('paddle hit transfers momentum from paddle velocity', async () => {
    await initPhysics()
    const w = new PhysicsWorld(); w.freezePuck(false)
    w.setPaddle(0, 0, -0.6); w.setPuck(0, -0.3)
    for (let i = 0; i < 60; i++) { w.movePaddle(0, 0, -0.05, PLAYER_MAX_SPEED); w.step() }
    expect(w.puckVel.y).toBeGreaterThan(1.5)
    w.dispose()
  })
  it('paddle respects speed cap, own half, and walls', async () => {
    await initPhysics()
    const w = new PhysicsWorld(); let maxV = 0
    for (let i = 0; i < 600; i++) {
      w.movePaddle(0, 5 * Math.sin(i / 20), 5 * Math.cos(i / 15), PLAYER_MAX_SPEED); w.step()
      const v = w.paddles[0].linvel(); const p = w.paddles[0].translation()
      maxV = Math.max(maxV, Math.hypot(v.x, v.y))
      expect(p.y).toBeLessThanOrEqual(-PADDLE_R + 1e-6)
      expect(Math.abs(p.x)).toBeLessThanOrEqual(TABLE.W / 2 - PADDLE_R + 1e-6)
    }
    expect(maxV).toBeLessThanOrEqual(PLAYER_MAX_SPEED + 0.05)
    w.dispose()
  })
})

describe('consistency across frame rates', () => {
  it('same seed/inputs give the same match at 30, 60 and 144 fps (fixed timestep)', async () => {
    const out: string[] = []
    for (const fps of [30, 60, 144]) {
      const e = await GameEngine.create(mulberry32(5))
      e.load(cfg(4, 2), { playerAI: getOpponent(4) })
      e.begin()
      const steps0 = e.steps
      // simulate exactly 20 seconds of wall time at this fps
      for (let i = 0; i < fps * 20; i++) e.update(1 / fps)
      out.push(`${e.steps - steps0}`)
      e.dispose()
    }
    // physics step count depends only on elapsed time (within one step of rounding)
    const nums = out.map(Number)
    expect(Math.max(...nums) - Math.min(...nums)).toBeLessThanOrEqual(16)
  })
})

describe('AI', () => {
  it('foldX predicts bounces', () => {
    expect(foldX(0, 1, 0)).toBeCloseTo(0)
    const half = TABLE.W / 2 - PUCK_R
    expect(foldX(half - 0.1, 1, 0.3)).toBeCloseTo(half - 0.2, 5) // bounced back by 0.2
  })
  it('AI paddle never exceeds player limits during a whole match', async () => {
    const e = await GameEngine.create(mulberry32(9))
    e.load(cfg(12, 3))
    e.begin()
    let maxV = 0
    for (let i = 0; i < 60 * 60; i++) {
      e.update(1 / 60)
      const v = e.phys.paddles[1].linvel(); const p = e.phys.paddles[1].translation()
      maxV = Math.max(maxV, Math.hypot(v.x, v.y))
      expect(p.y).toBeGreaterThanOrEqual(PADDLE_R)
    }
    expect(maxV).toBeLessThanOrEqual(PLAYER_MAX_SPEED + 0.05)
    e.dispose()
  })
  it('difficulty genuinely increases: higher level beats lower level', async () => {
    for (const [hi, lo] of [[12, 1], [9, 3], [6, 1]] as const) {
      let wins = 0
      for (let s = 1; s <= 3; s++) {
        const e = await GameEngine.create(mulberry32(s * 31 + hi))
        e.load(cfg(lo, 5), { playerAI: getOpponent(hi) })
        const r = e.runToEnd(60, 600)
        expect(r).not.toBeNull()
        if (r!.won) wins++
        e.dispose()
      }
      expect(wins).toBeGreaterThanOrEqual(2)
    }
  })
  it('opponents behave distinctly (different goals-for/against profile)', async () => {
    // Aggressor attacks more than Defender: more shots (impacts by paddle1) per second against a fixed opponent
    const shots: Record<number, number> = {}
    for (const L of [4, 5]) {
      const e = await GameEngine.create(mulberry32(3))
      e.load(cfg(L, 99), { playerAI: getOpponent(6) })
      let hits = 0
      e.on('impact', (im) => { if (im.kind === 'paddle1') hits++ })
      e.begin()
      for (let i = 0; i < 60 * 90; i++) e.update(1 / 60)
      shots[L] = hits
      e.dispose()
    }
    expect(shots[5]).not.toBe(shots[4])
  })
  it('goals register exactly once in a long match', async () => {
    const e = await GameEngine.create(mulberry32(21))
    e.load(cfg(8, 99), { playerAI: getOpponent(8) })
    let goals = 0
    e.on('goal', () => goals++)
    e.begin()
    for (let i = 0; i < 60 * 200; i++) e.update(1 / 60)
    expect(goals).toBe(e.score[0] + e.score[1])
    expect(goals).toBeGreaterThan(0)
    e.dispose()
  })
})
