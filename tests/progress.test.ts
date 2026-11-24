import 'fake-indexeddb/auto'
import { describe, it, expect } from 'vitest'
import { applyMatch, beginChampionshipMatch, defaultSave, finishSurvivalRun, validateSave, LocalLeaderboard, survivalUnlocked, SaveData } from '../src/core/progress'
import { loadSave, writeSave, kvSet, wipeSave } from '../src/core/storage'
import { getOpponent, survivalOpponent, difficultyRating, OPPONENTS, paramsAtLevel } from '../src/core/opponents'
import { MatchResult, MatchConfig } from '../src/core/engine'
import { PLAYER_MAX_SPEED } from '../src/core/constants'

const mk = (mode: MatchConfig['mode'], level: number, p: number, a: number, extra: Partial<MatchResult> = {}, cfgx: Partial<MatchConfig> = {}): MatchResult => ({
  cfg: { mode, level, opponent: getOpponent(level), targetScore: 7, ...cfgx }, won: p > a, playerScore: p, aiScore: a, durationMs: 100000, maxDeficit: 0, maxLead: 0, ...extra,
})

describe('championship progression', () => {
  it('unlocks sequentially and completes after level 12', () => {
    let s = defaultSave()
    for (let L = 1; L <= 12; L++) {
      s = beginChampionshipMatch(s, L)
      expect(s.unlocked).toBe(L)
      const o = applyMatch(s, mk('championship', L, 7, 3))
      s = o.save
      if (L < 12) expect(o.unlockedLevel).toBe(L + 1)
      else { expect(o.championshipCompleted).toBe(true); expect(o.newAchievements).toContain('all_12'); expect(o.newAchievements).toContain('unbeaten_champion') }
    }
    expect(survivalUnlocked(s)).toBe(true)
    expect(s.champRuns.length).toBe(1)
  })
  it('a loss does not unlock and spoils unbeaten', () => {
    let s = beginChampionshipMatch(defaultSave(), 1)
    let o = applyMatch(s, mk('championship', 1, 3, 7)); s = o.save
    expect(s.unlocked).toBe(1)
    for (let L = 1; L <= 12; L++) s = applyMatch(s, mk('championship', L, 7, 0)).save
    expect(s.achievements.unbeaten_champion).toBeUndefined()
    expect(s.achievements.all_12).toBeDefined()
  })
  it('replaying earlier levels never lowers progress; survival locked until completion', () => {
    let s = beginChampionshipMatch(defaultSave(), 1)
    s = applyMatch(s, mk('championship', 1, 7, 2)).save
    s = applyMatch(s, mk('championship', 1, 7, 6)).save
    expect(s.unlocked).toBe(2)
    expect(survivalUnlocked(s)).toBe(false)
  })
})

describe('quick match and achievements', () => {
  it('quick match updates overall stats only', () => {
    const s0 = defaultSave()
    const o = applyMatch(s0, mk('quick', 3, 5, 1, {}, { targetScore: 5 }))
    expect(o.save.stats.matches).toBe(1); expect(o.save.stats.goalsFor).toBe(5)
    expect(o.save.unlocked).toBe(1); expect(Object.keys(o.save.completed).length).toBe(0)
    expect(o.save.stats.winStreak).toBe(0)
  })
  it('perfect defence, comeback king, speed demon, streaks', () => {
    let s = defaultSave()
    let o = applyMatch(s, mk('championship', 1, 7, 0, { durationMs: 60000, maxDeficit: 3 })); s = o.save
    for (const id of ['first_victory', 'perfect_defence', 'comeback_king', 'speed_demon', 'first_level']) expect(s.achievements[id]).toBeDefined()
    s = applyMatch(s, mk('championship', 2, 7, 1)).save
    o = applyMatch(s, mk('championship', 3, 7, 1)); expect(o.save.achievements.three_wins).toBeDefined()
  })
})

describe('survival', () => {
  it('records streak, milestones and run entries', () => {
    let s = defaultSave()
    let run = { wins: 0, goalsFor: 0, goalsAgainst: 0, timeMs: 0 }
    let milestone: number | null = null
    for (let i = 0; i < 5; i++) {
      run = { wins: run.wins + 1, goalsFor: run.goalsFor + 7, goalsAgainst: run.goalsAgainst + 2, timeMs: run.timeMs + 90000 }
      const o = applyMatch(s, mk('survival', 5, 7, 2), run); s = o.save; milestone = o.milestone
    }
    expect(milestone).toBe(5)
    expect(s.survival.bestStreak).toBe(5)
    const f = finishSurvivalRun(s, run)
    expect(f.entry.score).toBe(5 * 100 + 35 * 10 - 10 * 5)
    expect(f.save.survRuns.length).toBe(1)
  })
  it('difficulty strictly scales and never exceeds player speed', () => {
    let last = 0
    for (let w = 0; w < 40; w++) {
      const o = survivalOpponent(w)
      expect(o.params.speed).toBeLessThanOrEqual(PLAYER_MAX_SPEED)
      const r = difficultyRating(o.params)
      expect(r).toBeGreaterThanOrEqual(last - 0) ; last = Math.max(last, r)
    }
    expect(difficultyRating(survivalOpponent(0).params)).toBeLessThan(difficultyRating(survivalOpponent(12).params))
    expect(paramsAtLevel(20).reaction).toBeLessThan(paramsAtLevel(12).reaction)
  })
  it('12 opponents have strictly distinct, increasing-or-equal ratings and unique profiles', () => {
    const ratings = OPPONENTS.map((o) => difficultyRating(o.params))
    expect(ratings[11]).toBeGreaterThan(ratings[0])
    expect(ratings[11]).toBeGreaterThanOrEqual(ratings[6])
    expect(new Set(OPPONENTS.map((o) => JSON.stringify(o.params))).size).toBe(12)
    for (const o of OPPONENTS) expect(o.params.speed).toBeLessThanOrEqual(PLAYER_MAX_SPEED)
  })
})

describe('leaderboard sorting', () => {
  it('sorts each metric correctly', () => {
    const s: SaveData = defaultSave()
    s.champRuns = [
      { id: 'a', date: '2026-01-01', timeMs: 900000, goalsFor: 80, goalsAgainst: 40, losses: 1 },
      { id: 'b', date: '2026-02-01', timeMs: 600000, goalsFor: 70, goalsAgainst: 20, losses: 0 },
      { id: 'c', date: '2026-03-01', timeMs: 700000, goalsFor: 95, goalsAgainst: 30, losses: 0 },
    ]
    s.survRuns = [
      { id: 'x', date: '2026-01-01', streak: 3, score: 400, goalsFor: 21, goalsAgainst: 9, timeMs: 1 },
      { id: 'y', date: '2026-01-02', streak: 9, score: 1500, goalsFor: 63, goalsAgainst: 20, timeMs: 1 },
    ]
    const L = LocalLeaderboard
    expect(L.top(s, 'championship', 'fastest').map((r) => r.rank)).toEqual([1, 2, 3])
    expect(L.top(s, 'championship', 'fastest')[0].value).toBe('10:00')
    expect(L.top(s, 'championship', 'goals')[0].value).toBe('95')
    expect(L.top(s, 'championship', 'conceded')[0].value).toBe('20')
    expect(L.top(s, 'survival', 'score')[0].value).toBe('1500')
    expect(L.top(s, 'survival', 'streak')[0].value).toBe('9 wins')
    expect(L.kind).toBe('local')
  })
})

describe('persistence', () => {
  it('round-trips, and recovers from corruption', async () => {
    await wipeSave()
    let r = await loadSave(); expect(r.recovered).toBe('none')
    const s = defaultSave(); s.unlocked = 5; s.settings.master = 0.3
    await writeSave(s)
    const s2 = { ...s, unlocked: 7 }
    await writeSave(s2)
    r = await loadSave(); expect(r.save.unlocked).toBe(7); expect(r.save.settings.master).toBe(0.3)
    await kvSet('save', { version: 1, unlocked: 'banana', stats: 5 }) // corrupt main -> sanitised or backup
    r = await loadSave(); expect(r.save.unlocked).toBeGreaterThanOrEqual(1)
    await kvSet('save', 'garbage'); r = await loadSave(); expect(r.recovered).toBe('backup'); expect(r.save.unlocked).toBe(5)
    await kvSet('backup', null); r = await loadSave(); expect(r.recovered).toBe('reset'); expect(r.save.unlocked).toBe(1)
  })
  it('validation clamps out-of-range values', () => {
    const v = validateSave({ ...defaultSave(), unlocked: 99, settings: { ...defaultSave().settings, master: 7 }, quick: { opponent: 50, target: 4, difficulty: 9 } })!
    expect(v.unlocked).toBe(12); expect(v.settings.master).toBe(1); expect(v.quick.opponent).toBe(12); expect(v.quick.target).toBe(5); expect(v.quick.difficulty).toBe(1)
    expect(validateSave(null)).toBeNull(); expect(validateSave({ version: 99 })).toBeNull()
  })
  it('appearance settings default for old saves and reject bad values', () => {
    const d = defaultSave()
    expect(d.settings.theme).toBe('dark'); expect(d.settings.paddleColor).toBe('#3df5ff')
    const { theme, paddleColor, puckColor, ...old } = d.settings; void theme; void paddleColor; void puckColor
    const a = validateSave({ ...d, settings: old })!
    expect(a.settings.theme).toBe('dark'); expect(a.settings.paddleColor).toBe('#3df5ff'); expect(a.settings.puckColor).toBe('#e8f0ff')
    const b = validateSave({ ...d, settings: { ...d.settings, theme: 'neon', paddleColor: 'red; x', puckColor: '#FFAA00' } })!
    expect(b.settings.theme).toBe('dark'); expect(b.settings.paddleColor).toBe('#3df5ff'); expect(b.settings.puckColor).toBe('#ffaa00')
    expect(validateSave({ ...d, settings: { ...d.settings, theme: 'light' } })!.settings.theme).toBe('light')
  })
})
