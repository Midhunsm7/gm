export type HapticKind = 'paddle' | 'wall' | 'goalFor' | 'goalAgainst' | 'win' | 'lose' | 'milestone' | 'ui'

export const hapticsSupported = () => typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function'

export const PATTERNS: Record<HapticKind, number[]> = {
  paddle: [14],
  wall: [7],
  goalFor: [30, 40, 70],
  goalAgainst: [110],
  win: [60, 60, 60, 60, 180],
  lose: [220, 90, 220],
  milestone: [40, 40, 40, 40, 40, 40, 240],
  ui: [8],
}

let enabled = true
export const setHapticsEnabled = (b: boolean) => { enabled = b }
export const isHapticsEnabled = () => enabled

/** Fire a vibration pattern. `intensity` (0..1) scales single-pulse patterns (impacts). Safe to call anywhere. */
export function buzz(kind: HapticKind, intensity = 1): boolean {
  if (!enabled || !hapticsSupported()) return false
  const base = PATTERNS[kind]
  const k = Math.min(1, Math.max(0.3, intensity))
  const pat = base.length === 1 ? [Math.round(base[0] * (0.6 + k * 0.8))] : base
  try { return navigator.vibrate(pat) } catch { return false }
}
