import type { MatchConfig, MatchResult } from './engine'
import { getOpponent, quickOpponent, survivalOpponent } from './opponents'
import type { MatchOutcome, QuickSettings, SaveData } from './progress'
import { clamp } from './util'

/** Pure helpers that decide *what* match to play next and *how* to present its result. No UI, no storage. */

export const SURVIVAL_TARGET = 5
export const championshipTarget = (level: number) => (level >= 12 ? 7 : 5)

export function championshipConfig(level: number): MatchConfig {
  const l = clamp(Math.round(level), 1, 12)
  return { mode: 'championship', level: l, opponent: getOpponent(l), targetScore: championshipTarget(l) }
}

export function survivalConfig(wins: number): MatchConfig {
  const o = survivalOpponent(wins)
  return { mode: 'survival', level: o.level, opponent: o, targetScore: SURVIVAL_TARGET, survivalWins: wins }
}

export function quickConfig(q: QuickSettings): MatchConfig {
  return { mode: 'quick', level: q.opponent, opponent: quickOpponent(q.opponent, q.difficulty), targetScore: q.target, difficultyMod: q.difficulty }
}

export interface SurvRun { wins: number; goalsFor: number; goalsAgainst: number; timeMs: number }
export const newRun = (): SurvRun => ({ wins: 0, goalsFor: 0, goalsAgainst: 0, timeMs: 0 })
export const extendRun = (run: SurvRun, r: MatchResult): SurvRun => ({
  wins: run.wins + (r.won ? 1 : 0),
  goalsFor: run.goalsFor + r.playerScore,
  goalsAgainst: run.goalsAgainst + r.aiScore,
  timeMs: run.timeMs + r.durationMs,
})

export type ResultKind = 'championship-win' | 'championship-defeat' | 'survival-win' | 'survival-milestone' | 'survival-end' | 'quick'

export function resultKind(r: MatchResult, o: MatchOutcome): ResultKind {
  if (r.cfg.mode === 'quick') return 'quick'
  if (r.cfg.mode === 'championship') return r.won ? 'championship-win' : 'championship-defeat'
  if (!r.won) return 'survival-end'
  return o.milestone ? 'survival-milestone' : 'survival-win'
}

/** 1-based position of a finished survival run on the local score board. */
export function survivalRank(save: SaveData, id: string): number {
  const i = [...save.survRuns].sort((a, b) => b.score - a.score).findIndex((e) => e.id === id)
  return i < 0 ? 0 : i + 1
}

export const nextChampionshipLevel = (level: number): number | null => (level < 12 ? level + 1 : null)
