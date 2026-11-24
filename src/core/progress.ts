import { MatchResult } from './engine'
import { MILESTONES } from './constants'
import { DEFAULT_PADDLE, DEFAULT_PUCK, ThemeMode, isHex } from './appearance'

export interface Settings {
  master: number; music: number; sfx: number; mute: boolean; musicOn: boolean
  haptics: boolean; shake: boolean; touchOffset: number; quality: 'high' | 'low'
  theme: ThemeMode; paddleColor: string; puckColor: string
}
export interface QuickSettings { opponent: number; target: number; difficulty: number }
export interface LevelRecord { wins: number; plays: number; bestMargin: number; bestTimeMs: number; bestScore: string; date: string }
export interface ChampRun { active: boolean; startedAt: string; levels: Record<string, boolean>; losses: number; goalsFor: number; goalsAgainst: number; timeMs: number }
export interface ChampEntry { id: string; date: string; timeMs: number; goalsFor: number; goalsAgainst: number; losses: number }
export interface SurvEntry { id: string; date: string; streak: number; score: number; goalsFor: number; goalsAgainst: number; timeMs: number }
export interface Stats {
  matches: number; wins: number; losses: number; goalsFor: number; goalsAgainst: number; playTimeMs: number
  winStreak: number; bestWinStreak: number; bestWinStreakDate: string
}
export interface SaveData {
  version: number
  unlocked: number
  championshipCompleted: boolean
  completed: Record<string, LevelRecord>
  champRun: ChampRun
  champRuns: ChampEntry[]
  survRuns: SurvEntry[]
  survival: { bestStreak: number; bestStreakDate: string; totalWins: number; totalGoals: number; runs: number }
  stats: Stats
  achievements: Record<string, string>
  settings: Settings
  quick: QuickSettings
  updatedAt: string
}

export const SAVE_VERSION = 1
export const defaultSave = (): SaveData => ({
  version: SAVE_VERSION,
  unlocked: 1,
  championshipCompleted: false,
  completed: {},
  champRun: { active: false, startedAt: '', levels: {}, losses: 0, goalsFor: 0, goalsAgainst: 0, timeMs: 0 },
  champRuns: [],
  survRuns: [],
  survival: { bestStreak: 0, bestStreakDate: '', totalWins: 0, totalGoals: 0, runs: 0 },
  stats: { matches: 0, wins: 0, losses: 0, goalsFor: 0, goalsAgainst: 0, playTimeMs: 0, winStreak: 0, bestWinStreak: 0, bestWinStreakDate: '' },
  achievements: {},
  settings: { master: 0.8, music: 0.5, sfx: 0.9, mute: false, musicOn: true, haptics: true, shake: true, touchOffset: 0.12, quality: 'high', theme: 'dark', paddleColor: DEFAULT_PADDLE, puckColor: DEFAULT_PUCK },
  quick: { opponent: 1, target: 5, difficulty: 0 },
  updatedAt: '',
})

/** Defensive merge of untrusted data onto defaults (used for corrupted-save recovery). */
function coerce(def: any, raw: any): any {
  if (Array.isArray(def)) return Array.isArray(raw) ? raw.filter((x) => x && typeof x === 'object') : []
  if (def && typeof def === 'object') {
    const isDict = Object.keys(def).length === 0
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return isDict ? {} : coerce(def, {})
    if (isDict) return { ...raw }
    const out: any = {}
    for (const k of Object.keys(def)) out[k] = coerce(def[k], raw[k])
    return out
  }
  if (typeof def === 'number') return typeof raw === 'number' && Number.isFinite(raw) ? raw : def
  if (typeof def === 'boolean') return typeof raw === 'boolean' ? raw : def
  if (typeof def === 'string') return typeof raw === 'string' ? raw : def
  return def
}
const n = (v: unknown) => typeof v === 'number' && Number.isFinite(v)

export function validateSave(raw: unknown): SaveData | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null
  const r = raw as any
  if (!n(r.version) || r.version < 1 || r.version > SAVE_VERSION) return null
  const s: SaveData = coerce(defaultSave(), raw)
  s.version = SAVE_VERSION
  s.unlocked = Math.round(Math.min(12, Math.max(1, s.unlocked)))
  for (const k of ['master', 'music', 'sfx'] as const) s.settings[k] = Math.min(1, Math.max(0, s.settings[k]))
  s.settings.touchOffset = Math.min(0.3, Math.max(0, s.settings.touchOffset))
  if (s.settings.quality !== 'low') s.settings.quality = 'high'
  if (s.settings.theme !== 'light') s.settings.theme = 'dark'
  s.settings.paddleColor = isHex(s.settings.paddleColor) ? s.settings.paddleColor.toLowerCase() : DEFAULT_PADDLE
  s.settings.puckColor = isHex(s.settings.puckColor) ? s.settings.puckColor.toLowerCase() : DEFAULT_PUCK
  s.quick.opponent = Math.min(12, Math.max(1, Math.round(s.quick.opponent)))
  s.quick.difficulty = Math.min(1, Math.max(-1, Math.round(s.quick.difficulty)))
  if (![3, 5, 7, 10, 15].includes(s.quick.target)) s.quick.target = 5
  s.champRuns = s.champRuns.filter((e) => n(e.timeMs) && n(e.goalsFor) && n(e.goalsAgainst) && typeof e.date === 'string').slice(0, 100) as ChampEntry[]
  s.survRuns = s.survRuns.filter((e) => n(e.streak) && n(e.score) && n(e.goalsFor) && typeof e.date === 'string').slice(0, 100) as SurvEntry[]
  for (const k of Object.keys(s.completed)) {
    const c = s.completed[k] as any
    if (!(+k >= 1 && +k <= 12) || !c || !n(c.wins)) delete s.completed[k]
    else s.completed[k] = coerce({ wins: 0, plays: 0, bestMargin: 0, bestTimeMs: 0, bestScore: '', date: '' }, c)
  }
  for (const k of Object.keys(s.achievements)) if (typeof s.achievements[k] !== 'string') delete s.achievements[k]
  if (Object.keys(s.completed).length >= 12 || s.championshipCompleted) s.unlocked = Math.max(s.unlocked, 12)
  return s
}

// ---------------------------------------------------------------- achievements
export interface AchievementDef { id: string; name: string; icon: string; desc: string }
export const ACHIEVEMENTS: AchievementDef[] = [
  { id: 'first_victory', name: 'First Victory', icon: '🏅', desc: 'Win any match.' },
  { id: 'first_level', name: 'First Championship Level', icon: '🥇', desc: 'Beat Rookie Rex in Championship.' },
  { id: 'perfect_defence', name: 'Perfect Defence', icon: '🛡️', desc: 'Win a match without conceding a goal.' },
  { id: 'comeback_king', name: 'Comeback King', icon: '👑', desc: 'Win after trailing by 3 or more goals.' },
  { id: 'three_wins', name: 'Hat Trick', icon: '🎩', desc: 'Win 3 matches in a row (Championship or Survival).' },
  { id: 'ten_wins', name: 'Unstoppable', icon: '🔥', desc: 'Win 10 matches in a row (Championship or Survival).' },
  { id: 'speed_demon', name: 'Speed Demon', icon: '⚡', desc: 'Win a match to 5 or more goals in under 75 seconds.' },
  { id: 'survival_specialist', name: 'Survival Specialist', icon: '🧗', desc: 'Reach a 10 win streak in Survival Mode.' },
  { id: 'unbeaten_champion', name: 'Unbeaten Champion', icon: '💎', desc: 'Finish the Championship without losing a single match.' },
  { id: 'all_12', name: 'Complete All 12 Levels', icon: '🏆', desc: 'Defeat all twelve opponents in one championship run.' },
  { id: 'survival_25', name: 'Survival Milestone 25', icon: '🌟', desc: 'Reach a 25 win streak in Survival Mode.' },
]

export interface MatchOutcome {
  save: SaveData
  newAchievements: string[]
  unlockedLevel: number | null
  championshipCompleted: boolean
  survivalStreak: number
  milestone: number | null
}

/** Call when a Championship match starts at a level (decides whether a new run begins). */
export function beginChampionshipMatch(save: SaveData, level: number, now = new Date()): SaveData {
  if (level === 1 && !save.champRun.active) {
    return { ...save, champRun: { active: true, startedAt: now.toISOString(), levels: {}, losses: 0, goalsFor: 0, goalsAgainst: 0, timeMs: 0 } }
  }
  return save
}

export const survivalScore = (streak: number, gf: number, ga: number) => Math.max(0, streak * 100 + gf * 10 - ga * 5)

/**
 * Pure function: apply one finished match to the save. `survivalRun` carries the current run (wins so far + goals).
 * Quick matches update overall stats only; they never touch progression, records, streaks or leaderboards.
 */
export function applyMatch(
  input: SaveData, r: MatchResult, survivalRun?: { wins: number; goalsFor: number; goalsAgainst: number; timeMs: number }, now = new Date(),
): MatchOutcome {
  const s: SaveData = JSON.parse(JSON.stringify(input))
  const date = now.toISOString()
  const mode = r.cfg.mode
  const out: MatchOutcome = { save: s, newAchievements: [], unlockedLevel: null, championshipCompleted: false, survivalStreak: 0, milestone: null }
  const give = (id: string) => { if (!s.achievements[id]) { s.achievements[id] = date; out.newAchievements.push(id) } }

  s.stats.matches++
  s.stats.goalsFor += r.playerScore
  s.stats.goalsAgainst += r.aiScore
  s.stats.playTimeMs += r.durationMs
  if (r.won) s.stats.wins++; else s.stats.losses++

  const counted = mode !== 'quick'
  if (counted) {
    if (r.won) {
      s.stats.winStreak++
      if (s.stats.winStreak > s.stats.bestWinStreak) { s.stats.bestWinStreak = s.stats.winStreak; s.stats.bestWinStreakDate = date }
    } else s.stats.winStreak = 0
  }

  // achievements that any fair match can earn (quick: only default difficulty and target >= 5)
  const fair = counted || ((r.cfg.difficultyMod ?? 0) === 0 && r.cfg.targetScore >= 5)
  if (r.won && fair) {
    give('first_victory')
    if (r.aiScore === 0) give('perfect_defence')
    if (r.maxDeficit >= 3) give('comeback_king')
    if (r.cfg.targetScore >= 5 && r.durationMs < 75000) give('speed_demon')
  }
  if (counted && s.stats.winStreak >= 3) give('three_wins')
  if (counted && s.stats.winStreak >= 10) give('ten_wins')

  if (mode === 'championship') {
    const key = String(r.cfg.level)
    const rec = s.completed[key] || { wins: 0, plays: 0, bestMargin: 0, bestTimeMs: 0, bestScore: '', date: '' }
    rec.plays++
    const run = s.champRun
    if (run.active) {
      run.timeMs += r.durationMs; run.goalsFor += r.playerScore; run.goalsAgainst += r.aiScore
      if (!r.won) run.losses++
    }
    if (r.won) {
      const margin = r.playerScore - r.aiScore
      if (rec.wins === 0 || margin > rec.bestMargin) { rec.bestMargin = margin; rec.bestScore = `${r.playerScore}-${r.aiScore}` }
      if (rec.wins === 0 || r.durationMs < rec.bestTimeMs) rec.bestTimeMs = r.durationMs
      rec.wins++
      rec.date = date
      give('first_level')
      if (r.cfg.level >= s.unlocked && r.cfg.level < 12) { s.unlocked = r.cfg.level + 1; out.unlockedLevel = s.unlocked }
      if (run.active) run.levels[key] = true
      if (r.cfg.level === 12 && run.active && Object.keys(run.levels).length >= 12) {
        out.championshipCompleted = true
        s.championshipCompleted = true
        s.unlocked = 12
        give('all_12')
        if (run.losses === 0) give('unbeaten_champion')
        s.champRuns.push({ id: `c${now.getTime()}`, date, timeMs: run.timeMs, goalsFor: run.goalsFor, goalsAgainst: run.goalsAgainst, losses: run.losses })
        s.champRuns.sort((a, b) => a.timeMs - b.timeMs)
        s.champRuns = s.champRuns.slice(0, 50)
        s.champRun = { active: false, startedAt: '', levels: {}, losses: 0, goalsFor: 0, goalsAgainst: 0, timeMs: 0 }
      }
    }
    s.completed[key] = rec
  }

  if (mode === 'survival' && survivalRun) {
    s.survival.totalGoals += r.playerScore
    if (r.won) {
      s.survival.totalWins++
      const streak = survivalRun.wins
      out.survivalStreak = streak
      if (streak > s.survival.bestStreak) { s.survival.bestStreak = streak; s.survival.bestStreakDate = date }
      if (streak >= 10) give('survival_specialist')
      if (streak >= 25) give('survival_25')
      if (MILESTONES.includes(streak)) out.milestone = streak
    }
  }
  s.updatedAt = date
  return out
}

/** Record a finished Survival run on the leaderboard (called when the run ends with a loss). */
export function finishSurvivalRun(input: SaveData, run: { wins: number; goalsFor: number; goalsAgainst: number; timeMs: number }, now = new Date()): { save: SaveData; entry: SurvEntry } {
  const s: SaveData = JSON.parse(JSON.stringify(input))
  const entry: SurvEntry = {
    id: `s${now.getTime()}`, date: now.toISOString(), streak: run.wins, score: survivalScore(run.wins, run.goalsFor, run.goalsAgainst),
    goalsFor: run.goalsFor, goalsAgainst: run.goalsAgainst, timeMs: run.timeMs,
  }
  s.survival.runs++
  s.survRuns.push(entry)
  s.survRuns.sort((a, b) => b.score - a.score)
  s.survRuns = s.survRuns.slice(0, 50)
  s.updatedAt = entry.date
  return { save: s, entry }
}

export const survivalUnlocked = (s: SaveData) => s.championshipCompleted

// ---------------------------------------------------------------- leaderboard
export type BoardCategory = 'championship' | 'survival' | 'overall'
export interface BoardRow { rank: number; value: string; sub: string; date: string }
export interface LeaderboardProvider {
  readonly kind: 'local' | 'online'
  top(save: SaveData, category: BoardCategory, metric: string, n?: number): BoardRow[]
}
export const fmtTime = (ms: number) => { const s = Math.round(ms / 1000); return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}` }
const d = (iso: string) => (iso ? new Date(iso).toLocaleDateString() : '-')

export const BOARD_METRICS: Record<BoardCategory, { id: string; label: string }[]> = {
  championship: [
    { id: 'fastest', label: 'Fastest completion' }, { id: 'goals', label: 'Highest total goals' },
    { id: 'conceded', label: 'Fewest conceded' }, { id: 'victories', label: 'Championship victories' },
  ],
  survival: [
    { id: 'streak', label: 'Longest winning streak' }, { id: 'score', label: 'Highest survival score' },
    { id: 'consecutive', label: 'Most consecutive victories' }, { id: 'goals', label: 'Total survival goals' },
  ],
  overall: [
    { id: 'matches', label: 'Matches played' }, { id: 'wins', label: 'Total wins' }, { id: 'winpct', label: 'Win percentage' },
    { id: 'gf', label: 'Goals scored' }, { id: 'ga', label: 'Goals conceded' }, { id: 'level', label: 'Highest unlocked level' },
  ],
}

/** Local implementation. An online provider can implement the same interface later without touching game code. */
export const LocalLeaderboard: LeaderboardProvider = {
  kind: 'local',
  top(s, cat, metric, n = 10) {
    const rows = (list: { v: string; sub: string; date: string }[]): BoardRow[] => list.slice(0, n).map((x, i) => ({ rank: i + 1, value: x.v, sub: x.sub, date: d(x.date) }))
    if (cat === 'championship') {
      const runs = [...s.champRuns]
      if (metric === 'fastest') return rows(runs.sort((a, b) => a.timeMs - b.timeMs).map((r) => ({ v: fmtTime(r.timeMs), sub: `${r.goalsFor}-${r.goalsAgainst}, ${r.losses} losses`, date: r.date })))
      if (metric === 'goals') return rows(runs.sort((a, b) => b.goalsFor - a.goalsFor).map((r) => ({ v: String(r.goalsFor), sub: `in ${fmtTime(r.timeMs)}`, date: r.date })))
      if (metric === 'conceded') return rows(runs.sort((a, b) => a.goalsAgainst - b.goalsAgainst).map((r) => ({ v: String(r.goalsAgainst), sub: `in ${fmtTime(r.timeMs)}`, date: r.date })))
      const last = runs.map((r) => r.date).sort().pop() || ''
      return s.champRuns.length ? [{ rank: 1, value: String(s.champRuns.length), sub: 'completed runs', date: d(last) }] : []
    }
    if (cat === 'survival') {
      const runs = [...s.survRuns]
      if (metric === 'streak') return rows(runs.sort((a, b) => b.streak - a.streak).map((r) => ({ v: `${r.streak} wins`, sub: `score ${r.score}`, date: r.date })))
      if (metric === 'score') return rows(runs.sort((a, b) => b.score - a.score).map((r) => ({ v: String(r.score), sub: `${r.streak} wins`, date: r.date })))
      if (metric === 'consecutive') return rows(runs.sort((a, b) => b.streak - a.streak || a.timeMs - b.timeMs).map((r) => ({ v: `${r.streak}`, sub: `${r.goalsFor}-${r.goalsAgainst} goals, ${fmtTime(r.timeMs)}`, date: r.date })))
      return rows(runs.sort((a, b) => b.goalsFor - a.goalsFor).map((r) => ({ v: String(r.goalsFor), sub: `${r.streak} wins`, date: r.date })))
    }
    const st = s.stats
    const one = (v: string, sub: string, date: string) => [{ rank: 1, value: v, sub, date: d(date) }]
    switch (metric) {
      case 'matches': return one(String(st.matches), `${fmtTime(st.playTimeMs)} played`, s.updatedAt)
      case 'wins': return one(String(st.wins), `${st.losses} losses`, s.updatedAt)
      case 'winpct': return one(st.matches ? `${Math.round((st.wins / st.matches) * 100)}%` : '0%', `${st.wins}/${st.matches}`, s.updatedAt)
      case 'gf': return one(String(st.goalsFor), 'across all modes', s.updatedAt)
      case 'ga': return one(String(st.goalsAgainst), 'across all modes', s.updatedAt)
      default: return one(`Level ${s.unlocked}`, s.championshipCompleted ? 'Championship complete' : 'Championship in progress', s.updatedAt)
    }
  },
}
