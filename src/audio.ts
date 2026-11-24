/** Dedicated audio manager. Every sound is synthesised with the Web Audio API, so there are no asset files and it works offline. */
export type Sfx = 'paddle' | 'wall' | 'goalFor' | 'goalAgainst' | 'count' | 'go' | 'win' | 'lose' | 'intro' | 'unlock' | 'milestone' | 'achievement' | 'ui'
export interface AudioPrefs { master: number; music: number; sfx: number; mute: boolean; musicOn: boolean }

const BAR_ROOTS = [110, 87.31, 130.81, 98]
const MINOR = [1, 1.189, 1.498, 2]
const MAJOR = [1, 1.26, 1.498, 2]
const ARP = [0, 1, 2, 3, 2, 1, 2, 3]

class AudioManager {
  private ctx: AudioContext | null = null
  private master!: GainNode
  private sfxBus!: GainNode
  private musicBus!: GainNode
  private noiseBuf: AudioBuffer | null = null
  private prefs: AudioPrefs = { master: 0.8, music: 0.5, sfx: 0.9, mute: false, musicOn: true }
  private last: Record<string, number> = {}
  private voices = 0
  private timer: number | null = null
  private nextNote = 0
  private step = 0
  private hiddenSuspended = false

  apply(p: AudioPrefs) { this.prefs = { ...p }; this.sync() }

  private sync() {
    const c = this.ctx
    if (!c) return
    const t = c.currentTime
    this.master.gain.setTargetAtTime(this.prefs.mute ? 0 : this.prefs.master, t, 0.02)
    this.sfxBus.gain.setTargetAtTime(this.prefs.sfx, t, 0.02)
    this.musicBus.gain.setTargetAtTime(this.prefs.musicOn ? this.prefs.music * 0.3 : 0, t, 0.05)
  }

  /** Must be called from a user gesture (browsers block audio until then). Safe to call repeatedly. */
  unlock() {
    if (typeof window === 'undefined') return
    if (!this.ctx) {
      const AC = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
      if (!AC) return
      this.ctx = new AC()
      this.master = this.ctx.createGain()
      this.sfxBus = this.ctx.createGain()
      this.musicBus = this.ctx.createGain()
      const comp = this.ctx.createDynamicsCompressor()
      this.sfxBus.connect(this.master)
      this.musicBus.connect(this.master)
      this.master.connect(comp)
      comp.connect(this.ctx.destination)
      const len = Math.floor(this.ctx.sampleRate * 1)
      this.noiseBuf = this.ctx.createBuffer(1, len, this.ctx.sampleRate)
      const d = this.noiseBuf.getChannelData(0)
      for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1
      this.sync()
      document.addEventListener('visibilitychange', () => this.onVisibility())
    }
    if (this.ctx.state === 'suspended') void this.ctx.resume()
    this.startMusic()
  }

  private onVisibility() {
    const c = this.ctx
    if (!c) return
    if (document.hidden) { if (c.state === 'running') { this.hiddenSuspended = true; void c.suspend() } }
    else if (this.hiddenSuspended) { this.hiddenSuspended = false; void c.resume() }
  }

  // ---------------------------------------------------------------- synth helpers
  private osc(type: OscillatorType, f0: number, f1: number, dur: number, vol: number, at = 0, dest?: AudioNode, counted = true) {
    const c = this.ctx!
    const t = c.currentTime + Math.max(0, at)
    const o = c.createOscillator()
    const g = c.createGain()
    o.type = type
    o.frequency.setValueAtTime(f0, t)
    if (f1 !== f0) o.frequency.exponentialRampToValueAtTime(Math.max(1, f1), t + dur)
    g.gain.setValueAtTime(0.0001, t)
    g.gain.exponentialRampToValueAtTime(Math.max(0.0002, vol), t + 0.008)
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur)
    o.connect(g)
    g.connect(dest ?? this.sfxBus)
    o.start(t)
    o.stop(t + dur + 0.03)
    if (counted) this.voices++
    o.onended = () => { if (counted) this.voices--; g.disconnect() }
  }

  private noise(dur: number, vol: number, type: BiquadFilterType, f0: number, f1 = f0, at = 0, dest?: AudioNode, counted = true) {
    const c = this.ctx!
    if (!this.noiseBuf) return
    const t = c.currentTime + Math.max(0, at)
    const s = c.createBufferSource()
    s.buffer = this.noiseBuf
    const f = c.createBiquadFilter()
    f.type = type
    f.frequency.setValueAtTime(f0, t)
    if (f1 !== f0) f.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur)
    const g = c.createGain()
    g.gain.setValueAtTime(Math.max(0.0002, vol), t)
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur)
    s.connect(f); f.connect(g); g.connect(dest ?? this.sfxBus)
    s.start(t, Math.random() * 0.5)
    s.stop(t + dur + 0.03)
    if (counted) this.voices++
    s.onended = () => { if (counted) this.voices--; g.disconnect() }
  }

  // ---------------------------------------------------------------- public sfx
  play(name: Sfx, v = 1) {
    const c = this.ctx
    if (!c || c.state !== 'running' || this.prefs.mute) return
    if (name === 'paddle' || name === 'wall') {
      const now = performance.now()
      const gap = name === 'wall' ? 45 : 35
      if (now - (this.last[name] ?? 0) < gap || this.voices > 24) return // never pile up collision sounds
      this.last[name] = now
    }
    const k = Math.min(1, Math.max(0.15, v))
    switch (name) {
      case 'paddle':
        this.osc('sine', 220 + k * 120, 70, 0.13, 0.5 * k + 0.2)
        this.noise(0.045, 0.35 * k + 0.1, 'highpass', 2500)
        break
      case 'wall':
        this.osc('triangle', 520 + k * 200, 280, 0.08, 0.3 * k + 0.1)
        this.noise(0.04, 0.2 * k + 0.05, 'bandpass', 1800)
        break
      case 'goalFor':
        ;[523.25, 659.25, 783.99, 1046.5].forEach((f, i) => this.osc('square', f, f, 0.16, 0.22, i * 0.09))
        this.noise(0.8, 0.25, 'bandpass', 800, 2400, 0.1)
        break
      case 'goalAgainst':
        ;[392, 311.13, 233.08].forEach((f, i) => this.osc('sawtooth', f, f * 0.96, 0.22, 0.2, i * 0.11))
        break
      case 'count': this.osc('sine', 660, 660, 0.14, 0.4); break
      case 'go':
        this.osc('square', 880, 880, 0.12, 0.25)
        this.osc('square', 1320, 1320, 0.28, 0.25, 0.1)
        break
      case 'win':
        ;[523.25, 659.25, 783.99, 659.25, 783.99, 1046.5].forEach((f, i) => this.osc('square', f, f, 0.2, 0.2, i * 0.13))
        this.osc('triangle', 130.81, 130.81, 0.9, 0.35, 0)
        break
      case 'lose':
        ;[392, 349.23, 311.13, 261.63].forEach((f, i) => this.osc('triangle', f, f * 0.98, 0.3, 0.3, i * 0.2))
        break
      case 'intro':
        this.noise(0.6, 0.35, 'bandpass', 200, 3000)
        this.osc('sawtooth', 110, 220, 0.5, 0.2, 0.15)
        break
      case 'unlock':
        ;[880, 1108.73, 1318.51, 1760].forEach((f, i) => this.osc('sine', f, f, 0.22, 0.25, i * 0.07))
        break
      case 'milestone':
        ;[261.63, 329.63, 392, 523.25, 659.25, 783.99, 1046.5].forEach((f, i) => this.osc('square', f, f, 0.24, 0.18, i * 0.08))
        this.noise(1.0, 0.25, 'highpass', 1500, 6000, 0.2)
        break
      case 'achievement':
        this.osc('sine', 1046.5, 1046.5, 0.14, 0.3)
        this.osc('sine', 1568, 1568, 0.3, 0.3, 0.12)
        break
      case 'ui': this.osc('square', 820, 760, 0.04, 0.1, 0, undefined, false); break
    }
  }

  // ---------------------------------------------------------------- music
  private startMusic() {
    if (this.timer !== null || !this.ctx) return
    this.nextNote = this.ctx.currentTime + 0.1
    this.step = 0
    this.timer = window.setInterval(() => this.schedule(), 100)
  }

  private schedule() {
    const c = this.ctx
    if (!c || c.state !== 'running' || !this.prefs.musicOn || this.prefs.mute) { if (c) this.nextNote = Math.max(this.nextNote, c.currentTime); return }
    const spb = 60 / 112 / 4
    if (this.nextNote < c.currentTime - 0.3) this.nextNote = c.currentTime
    while (this.nextNote < c.currentTime + 0.25) {
      this.note(this.step, this.nextNote - c.currentTime)
      this.nextNote += spb
      this.step = (this.step + 1) % 64
    }
  }

  private note(step: number, at: number) {
    const bar = Math.floor(step / 16) % 4
    const i = step % 16
    const root = BAR_ROOTS[bar]
    const chord = bar === 0 ? MINOR : MAJOR
    const m = this.musicBus
    if (i % 4 === 0) this.osc('sine', 120, 45, 0.16, 0.7, at, m, false)
    if (i % 2 === 1) this.noise(0.03, 0.08, 'highpass', 7000, 7000, at, m, false)
    if (i % 2 === 0) this.osc('sawtooth', root * (i % 8 === 6 ? 2 : 1), root * (i % 8 === 6 ? 2 : 1), 0.18, 0.28, at, m, false)
    this.osc('triangle', root * 4 * chord[ARP[i % 8] % 4], root * 4 * chord[ARP[i % 8] % 4], 0.12, 0.16, at, m, false)
  }

  stopMusic() { if (this.timer !== null) { clearInterval(this.timer); this.timer = null } }
}

export const audio = new AudioManager()
