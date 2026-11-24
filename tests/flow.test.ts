import { describe, it, expect } from 'vitest'
import { championshipConfig, survivalConfig, quickConfig, newRun, extendRun, resultKind, survivalRank, nextChampionshipLevel, championshipTarget } from '../src/core/flow'
import { difficultyRating } from '../src/core/opponents'
import { applyMatch, defaultSave, finishSurvivalRun, MatchOutcome } from '../src/core/progress'
import type { MatchResult } from '../src/core/engine'

const res = (cfg: MatchResult['cfg'], won: boolean, p = 5, a = 2): MatchResult =>
  ({ cfg, won, playerScore: won ? p : a, aiScore: won ? a : p, durationMs: 60000, maxDeficit: 0, maxLead: 3 })

describe('match configuration', () => {
  it('builds championship configs for all 12 levels with a larger final', () => {
    for (let l = 1; l <= 12; l++) expect(championshipConfig(l).opponent.level).toBe(l)
    expect(championshipTarget(12)).toBe(7)
    expect(championshipTarget(5)).toBe(5)
    expect(championshipConfig(99).level).toBe(12)
  })
  it('survival difficulty rating never decreases as wins accumulate and ends harder than it starts', () => {
    let prev = 0
    let prevReaction = Infinity
    for (let w = 0; w < 30; w++) {
      const p = survivalConfig(w).opponent.params
      const rating = difficultyRating(p)
      expect(rating).toBeGreaterThanOrEqual(prev)
      expect(p.reaction).toBeLessThanOrEqual(prevReaction + 1e-9) // perception delay only ever shrinks
      expect(p.speed).toBeLessThanOrEqual(3.2) // never beyond the player's physical limit
      prev = rating
      prevReaction = p.reaction
    }
    expect(difficultyRating(survivalConfig(29).opponent.params)).toBeGreaterThan(difficultyRating(survivalConfig(0).opponent.params))
  })
  it('quick config carries the difficulty modifier so records stay fair', () => {
    const c = quickConfig({ opponent: 4, target: 7, difficulty: 1 })
    expect(c.mode).toBe('quick')
    expect(c.targetScore).toBe(7)
    expect(c.difficultyMod).toBe(1)
  })
  it('knows the next championship level', () => {
    expect(nextChampionshipLevel(3)).toBe(4)
    expect(nextChampionshipLevel(12)).toBeNull()
  })
})

describe('survival run flow', () => {
  it('accumulates wins and goals, and a loss ends the run on the board', () => {
    let save = defaultSave()
    save.championshipCompleted = true
    let run = newRun()
    for (let w = 0; w < 6; w++) {
      const r = res(survivalConfig(w), true)
      run = extendRun(run, r)
      const o = applyMatch(save, r, run)
      save = o.save
      if (run.wins === 5) expect(o.milestone).toBe(5)
      else expect(o.milestone).toBeNull()
    }
    expect(run.wins).toBe(6)
    const lost = res(survivalConfig(6), false)
    run = extendRun(run, lost)
    const o = applyMatch(save, lost, run)
    const fin = finishSurvivalRun(o.save, run)
    expect(fin.save.survRuns).toHaveLength(1)
    expect(fin.entry.streak).toBe(6)
    expect(survivalRank(fin.save, fin.entry.id)).toBe(1)
  })
  it('chooses the right result presentation', () => {
    const save = defaultSave()
    const q = res(quickConfig(save.quick), true)
    expect(resultKind(q, applyMatch(save, q))).toBe('quick')
    const c = res(championshipConfig(1), false)
    expect(resultKind(c, applyMatch(save, c))).toBe('championship-defeat')
    const w = res(championshipConfig(1), true)
    expect(resultKind(w, applyMatch(save, w))).toBe('championship-win')
    const fake = { milestone: 10 } as MatchOutcome
    expect(resultKind(res(survivalConfig(9), true), fake)).toBe('survival-milestone')
    expect(resultKind(res(survivalConfig(9), false), fake)).toBe('survival-end')
  })
})
