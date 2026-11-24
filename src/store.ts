import { create } from 'zustand'
import { MatchConfig, MatchResult } from './core/engine'
import {
  SaveData, Settings, QuickSettings, SurvEntry, MatchOutcome, defaultSave, applyMatch, finishSurvivalRun,
  beginChampionshipMatch, survivalUnlocked,
} from './core/progress'
import { loadSave, writeSave, wipeSave, requestPersistence } from './core/storage'
import {
  SurvRun, ResultKind, championshipConfig, survivalConfig, quickConfig, newRun, extendRun, resultKind, survivalRank,
} from './core/flow'
import { audio } from './audio'
import { buzz, setHapticsEnabled } from './haptics'

export type Screen = 'loading' | 'menu' | 'levels' | 'quick' | 'leaderboard' | 'achievements' | 'stats' | 'settings' | 'game'
export interface Session { cfg: MatchConfig; key: number }
export interface ResultState {
  kind: ResultKind
  result: MatchResult
  outcome: MatchOutcome
  run: SurvRun | null
  entry: SurvEntry | null
  rank: number
  newBest: boolean
}
export interface InstallEvent extends Event { prompt(): Promise<void>; userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }> }

interface Store {
  ready: boolean
  recovered: 'none' | 'backup' | 'reset'
  save: SaveData
  screen: Screen
  session: Session | null
  run: SurvRun | null
  results: ResultState | null
  toasts: string[]
  notice: string | null
  updateReady: boolean
  applyUpdate: (() => void) | null
  installEvent: InstallEvent | null

  init(): Promise<void>
  go(s: Screen): void
  startChampionship(level?: number): void
  startSurvival(): void
  nextSurvival(): void
  startQuick(): void
  restartMatch(): void
  finishMatch(r: MatchResult): void
  quitToMenu(): void
  updateSettings(p: Partial<Settings>): void
  setQuick(p: Partial<QuickSettings>): void
  resetProgress(): Promise<void>
  popToast(): void
  setNotice(n: string | null): void
  setUpdate(fn: (() => void) | null): void
  setInstallEvent(e: InstallEvent | null): void
}

let keyN = 0
let chain: Promise<void> = Promise.resolve()
const queue = (fn: () => Promise<void>) => { chain = chain.then(fn).catch(() => { /* storage failures must never break gameplay */ }) }
const persist = (s: SaveData) => queue(() => writeSave(s))
let settingsTimer: number | undefined

function applyAppearance(s: Settings) {
  if (typeof document === 'undefined') return
  const root = document.documentElement
  root.dataset.theme = s.theme
  root.style.setProperty('--you', s.paddleColor)
  root.style.setProperty('--puck', s.puckColor)
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', s.theme === 'light' ? '#e9f0ff' : '#070b1a')
  try { localStorage.setItem('mpr-theme', s.theme) } catch { /* private mode */ }
}

function applyPrefs(s: Settings) {
  applyAppearance(s)
  audio.apply({ master: s.master, music: s.music, sfx: s.sfx, mute: s.mute, musicOn: s.musicOn })
  setHapticsEnabled(s.haptics)
}

export const useStore = create<Store>((set, get) => ({
  ready: false,
  recovered: 'none',
  save: defaultSave(),
  screen: 'loading',
  session: null,
  run: null,
  results: null,
  toasts: [],
  notice: null,
  updateReady: false,
  applyUpdate: null,
  installEvent: null,

  async init() {
    if (get().ready) return
    const { save, recovered } = await loadSave()
    applyPrefs(save.settings)
    set({ save, recovered, ready: true, screen: 'menu', notice: recovered === 'backup' ? 'Save data was damaged - restored from backup.' : recovered === 'reset' ? 'Save data was damaged and had to be reset.' : null })
    void requestPersistence()
  },

  go(screen) { set({ screen, session: screen === 'game' ? get().session : null, results: null }) },

  startChampionship(level) {
    const { save } = get()
    const lv = level ?? (save.championshipCompleted ? 1 : save.unlocked)
    if (lv > save.unlocked) return
    const next = beginChampionshipMatch(save, lv)
    if (next !== save) persist(next)
    set({ save: next, run: null, results: null, screen: 'game', session: { cfg: championshipConfig(lv), key: ++keyN } })
  },

  startSurvival() {
    if (!survivalUnlocked(get().save)) return
    set({ run: newRun(), results: null, screen: 'game', session: { cfg: survivalConfig(0), key: ++keyN } })
  },

  nextSurvival() {
    const run = get().run
    if (!run) return get().startSurvival()
    set({ results: null, screen: 'game', session: { cfg: survivalConfig(run.wins), key: ++keyN } })
  },

  startQuick() {
    set({ run: null, results: null, screen: 'game', session: { cfg: quickConfig(get().save.quick), key: ++keyN } })
  },

  restartMatch() {
    const s = get().session
    if (!s) return
    set({ results: null, session: { cfg: s.cfg, key: ++keyN } })
  },

  finishMatch(r) {
    if (get().results) return // a match can only be recorded once
    const { save, run } = get()
    let nrun: SurvRun | null = null
    if (r.cfg.mode === 'survival') nrun = extendRun(run ?? newRun(), r)
    const outcome = applyMatch(save, r, nrun ?? undefined)
    let next = outcome.save
    let entry: SurvEntry | null = null
    let newBest = false
    let rank = 0
    if (r.cfg.mode === 'survival' && !r.won && nrun) {
      newBest = nrun.wins > 0 && nrun.wins > save.survival.bestStreak
      const fin = finishSurvivalRun(next, nrun)
      next = fin.save
      entry = fin.entry
      rank = survivalRank(next, entry.id)
    }
    persist(next)
    const kind = resultKind(r, outcome)
    set({
      save: next,
      run: r.cfg.mode === 'survival' && r.won ? nrun : null,
      results: { kind, result: r, outcome, run: nrun, entry, rank, newBest },
      toasts: [...get().toasts, ...outcome.newAchievements],
    })
    // presentation: sound + haptics for the outcome
    if (kind === 'survival-milestone') { audio.play('milestone'); buzz('milestone') }
    else if (r.won) { audio.play('win'); buzz('win') }
    else { audio.play('lose'); buzz('lose') }
    if (outcome.unlockedLevel || outcome.championshipCompleted) window.setTimeout(() => audio.play('unlock'), 900)
  },

  quitToMenu() {
    const { run, save } = get()
    let next = save
    if (run && run.wins > 0) { // abandoning a live survival run still banks it
      next = finishSurvivalRun(save, run).save
      persist(next)
    }
    set({ save: next, run: null, session: null, results: null, screen: 'menu' })
  },

  updateSettings(p) {
    const save = { ...get().save, settings: { ...get().save.settings, ...p }, updatedAt: new Date().toISOString() }
    applyPrefs(save.settings)
    set({ save })
    window.clearTimeout(settingsTimer)
    settingsTimer = window.setTimeout(() => persist(get().save), 250)
  },

  setQuick(p) {
    const save = { ...get().save, quick: { ...get().save.quick, ...p } }
    set({ save })
    persist(save)
  },

  async resetProgress() {
    const keep = get().save.settings
    const fresh: SaveData = { ...defaultSave(), settings: keep, updatedAt: new Date().toISOString() }
    queue(async () => { await wipeSave(); await writeSave(fresh) })
    set({ save: fresh, run: null, session: null, results: null, toasts: [], screen: 'menu', notice: 'Progress reset.' })
  },

  popToast() { set({ toasts: get().toasts.slice(1) }) },
  setNotice(notice) { set({ notice }) },
  setUpdate(fn) { set({ updateReady: !!fn, applyUpdate: fn }) },
  setInstallEvent(installEvent) { set({ installEvent }) },
}))
