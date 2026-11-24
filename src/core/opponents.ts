import { clamp, lerp } from './util'
import { PLAYER_MAX_SPEED } from './constants'

/** Independent difficulty axes. None of them lets the AI exceed the player's physical limits. */
export interface AIParams {
  reaction: number // seconds of perception delay (lower = harder)
  predict: number // 0..1 trajectory prediction accuracy (bounces included)
  aggression: number // 0..1 willingness to attack / push forward
  defense: number // 0..1 goal-cover quality and defensive discipline
  speed: number // max paddle speed, capped at PLAYER_MAX_SPEED
  power: number // 0..1 how hard it strikes
  aim: number // 0..1 shot accuracy
  bank: number // 0..1 chance of choosing a bank shot
  adapt: number // 0..1 how much it learns the player's habits
}

export interface AvatarSpec {
  head: 'round' | 'square' | 'hex' | 'ghost' | 'angular' | 'hood' | 'oval'
  eyes: 'dots' | 'bars' | 'wide' | 'visor' | 'angry' | 'ring' | 'glow' | 'slit' | 'hollow' | 'cyclops' | 'monocle' | 'star'
  mouth: 'smile' | 'flat' | 'grin' | 'teeth' | 'wavy' | 'fangs' | 'smirk' | 'none' | 'stache'
  extra: 'antenna' | 'cap' | 'bolt' | 'shield' | 'horns' | 'halo' | 'hood' | 'speed' | 'wisps' | 'spikes' | 'crown' | 'flames'
}

export type IntroStyle = 'slide' | 'glitch' | 'spin' | 'drop' | 'zoom' | 'flicker' | 'stomp' | 'slash' | 'ghost' | 'pounce' | 'crown' | 'champion'

export interface Opponent {
  level: number
  id: string
  name: string
  strategy: string
  personality: string
  color: string
  avatar: AvatarSpec
  intro: IntroStyle
  introLine: string
  winLine: string // shown when the opponent beats you
  loseLine: string // shown when you beat the opponent
  params: AIParams
}

const P = (
  reaction: number, predict: number, aggression: number, defense: number,
  speed: number, power: number, aim: number, bank: number, adapt: number,
): AIParams => ({ reaction, predict, aggression, defense, speed, power, aim, bank, adapt })

export const OPPONENTS: Opponent[] = [
  { level: 1, id: 'rex', name: 'Rookie Rex', strategy: 'Slow reactions, basic defence', personality: 'Cheerful newcomer who still reads the rulebook.', color: '#7bd88f',
    avatar: { head: 'round', eyes: 'dots', mouth: 'smile', extra: 'antenna' }, intro: 'slide',
    introLine: 'First day on the job! Go easy on me?', winLine: 'Whoa, I actually won!', loseLine: 'Ha! Good game, I learned a lot.', params: P(0.32, 0.15, 0.25, 0.3, 1.4, 0.35, 0.2, 0, 0) },
  { level: 2, id: 'carl', name: 'Casual Carl', strategy: 'Simple attacking movements', personality: 'Plays after lunch, swings at everything.', color: '#ffd166',
    avatar: { head: 'square', eyes: 'bars', mouth: 'smile', extra: 'cap' }, intro: 'glitch',
    introLine: 'Just a friendly game, right?', winLine: 'Lucky bounce. Rematch?', loseLine: 'Nice one. Buy you a soda.', params: P(0.28, 0.25, 0.45, 0.35, 1.7, 0.45, 0.3, 0, 0) },
  { level: 3, id: 'finn', name: 'Quick Finn', strategy: 'Faster reactions', personality: 'Twitchy and talkative. Never stands still.', color: '#5ec8ff',
    avatar: { head: 'oval', eyes: 'wide', mouth: 'grin', extra: 'bolt' }, intro: 'spin',
    introLine: 'Blink and you will miss it!', winLine: 'Too slow, too slow!', loseLine: 'Okay, okay, you are quick too.', params: P(0.2, 0.35, 0.45, 0.4, 2.1, 0.5, 0.35, 0, 0) },
  { level: 4, id: 'max', name: 'Defender Max', strategy: 'Strong defensive positioning', personality: 'A wall with opinions. Waits for your mistake.', color: '#8da2c0',
    avatar: { head: 'hex', eyes: 'visor', mouth: 'flat', extra: 'shield' }, intro: 'drop',
    introLine: 'Nothing gets past me.', winLine: 'The wall holds.', loseLine: 'Impressive. You found the gap.', params: P(0.2, 0.5, 0.25, 0.8, 2.1, 0.5, 0.45, 0.05, 0) },
  { level: 5, id: 'ace', name: 'Aggressor Ace', strategy: 'Aggressive attacking', personality: 'Attacks first and asks questions never.', color: '#ff5a5f',
    avatar: { head: 'angular', eyes: 'angry', mouth: 'teeth', extra: 'horns' }, intro: 'stomp',
    introLine: 'Attack is the best defence!', winLine: 'Smashed you!', loseLine: 'Grr! Next time I hit harder.', params: P(0.18, 0.45, 0.85, 0.35, 2.4, 0.75, 0.5, 0.1, 0) },
  { level: 6, id: 'nova', name: 'Tactical Nova', strategy: 'Basic trajectory prediction', personality: 'Calculates angles on the back of a napkin.', color: '#b388ff',
    avatar: { head: 'round', eyes: 'ring', mouth: 'flat', extra: 'halo' }, intro: 'zoom',
    introLine: 'I have already seen where this ends.', winLine: 'Outcome: as predicted.', loseLine: 'Recalculating... well played.', params: P(0.16, 0.7, 0.55, 0.6, 2.4, 0.6, 0.6, 0.2, 0) },
  { level: 7, id: 'shadow', name: 'Shadow', strategy: 'Adapts to player movements', personality: 'Watches your habits and quietly uses them.', color: '#5a6bff',
    avatar: { head: 'hood', eyes: 'glow', mouth: 'none', extra: 'hood' }, intro: 'flicker',
    introLine: 'I have been watching you.', winLine: 'You are predictable.', loseLine: 'You changed. Interesting.', params: P(0.15, 0.65, 0.5, 0.6, 2.5, 0.65, 0.65, 0.2, 0.8) },
  { level: 8, id: 'velocity', name: 'Velocity', strategy: 'High-speed attacking', personality: 'Pure speed. Shots arrive before the sound.', color: '#ff9f1c',
    avatar: { head: 'angular', eyes: 'slit', mouth: 'flat', extra: 'speed' }, intro: 'slash',
    introLine: 'Hold on to your paddle.', winLine: 'Gone before you blinked.', loseLine: 'You kept up. Barely.', params: P(0.13, 0.6, 0.8, 0.45, 3.0, 0.95, 0.6, 0.15, 0) },
  { level: 9, id: 'phantom', name: 'Phantom', strategy: 'Advanced rebounds and positioning', personality: 'Bounces the puck off walls like it owes it money.', color: '#c8f4ff',
    avatar: { head: 'ghost', eyes: 'hollow', mouth: 'wavy', extra: 'wisps' }, intro: 'ghost',
    introLine: 'Where the puck goes, I already was.', winLine: 'Off the wall and in.', loseLine: 'A ghost, beaten by a human.', params: P(0.12, 0.85, 0.6, 0.7, 2.8, 0.7, 0.75, 0.6, 0.2) },
  { level: 10, id: 'predator', name: 'Predator', strategy: 'Relentless offensive pressure', personality: 'Never retreats, never rests.', color: '#ff2e63',
    avatar: { head: 'angular', eyes: 'cyclops', mouth: 'fangs', extra: 'spikes' }, intro: 'pounce',
    introLine: 'I smell hesitation.', winLine: 'Hunted down.', loseLine: 'The prey bites back.', params: P(0.1, 0.8, 0.95, 0.5, 2.95, 0.9, 0.8, 0.3, 0.2) },
  { level: 11, id: 'grandmaster', name: 'Grandmaster', strategy: 'Advanced predictive AI', personality: 'Plays five bounces ahead and mentions it.', color: '#ffd700',
    avatar: { head: 'square', eyes: 'monocle', mouth: 'stache', extra: 'crown' }, intro: 'crown',
    introLine: 'Let us begin the endgame.', winLine: 'Checkmate, as they say.', loseLine: 'Remarkable. Truly remarkable.', params: P(0.08, 0.95, 0.65, 0.75, 3.0, 0.8, 0.9, 0.4, 0.6) },
  { level: 12, id: 'champion', name: 'THE CHAMPION', strategy: 'Extremely challenging balanced AI', personality: 'Undefeated. Balanced in every way that matters.', color: '#ff3d8b',
    avatar: { head: 'hex', eyes: 'star', mouth: 'smirk', extra: 'flames' }, intro: 'champion',
    introLine: 'Nobody has taken this title from me.', winLine: 'The crown stays.', loseLine: 'You are the new champion.', params: P(0.06, 0.97, 0.7, 0.85, PLAYER_MAX_SPEED, 0.9, 0.95, 0.45, 0.9) },
]

export const getOpponent = (level: number) => OPPONENTS[clamp(Math.round(level), 1, 12) - 1]

/** 1..10 rating built from several independent axes (not just speed). */
export function difficultyRating(p: AIParams): number {
  const s =
    0.2 * (1 - clamp((p.reaction - 0.06) / 0.28, 0, 1)) + 0.2 * p.predict + 0.15 * p.aim +
    0.15 * (p.speed / PLAYER_MAX_SPEED) + 0.1 * p.power + 0.1 * p.aggression + 0.1 * p.defense
  return Math.round(1 + 9 * clamp((s - 0.2) / 0.7, 0, 1))
}

/** Interpolated parameters at a fractional level; > 12 extrapolates only the non-physical axes. */
export function paramsAtLevel(level: number): AIParams {
  const L = Math.max(1, level)
  if (L >= 12) {
    const u = L - 12
    const c = OPPONENTS[11].params
    return {
      ...c,
      reaction: Math.max(0.035, c.reaction - u * 0.003),
      predict: Math.min(0.995, c.predict + u * 0.003),
      aim: Math.min(0.99, c.aim + u * 0.004),
      power: Math.min(1, c.power + u * 0.01),
      aggression: Math.min(0.85, c.aggression + u * 0.01),
      defense: Math.min(0.95, c.defense + u * 0.008),
      bank: Math.min(0.6, c.bank + u * 0.01),
      adapt: Math.min(1, c.adapt + u * 0.02),
      speed: PLAYER_MAX_SPEED,
    }
  }
  const i = Math.floor(L) - 1
  const a = OPPONENTS[i].params
  const b = OPPONENTS[Math.min(11, i + 1)].params
  const t = L - Math.floor(L)
  const o = {} as AIParams
  for (const k of Object.keys(a) as (keyof AIParams)[]) o[k] = lerp(a[k], b[k], t)
  return o
}

/** Survival: each win raises the difficulty; styles rotate through opponents 4-11. */
export function survivalOpponent(wins: number): Opponent {
  const arch = OPPONENTS[3 + (wins % 8)]
  const eq = 4 + wins * 0.7
  const base = paramsAtLevel(eq)
  const avgAggr = 0.62
  const params: AIParams = {
    ...base,
    aggression: clamp(base.aggression + (arch.params.aggression - avgAggr) * 0.7, 0.15, 0.95),
    defense: clamp(base.defense + (arch.params.defense - 0.58) * 0.7, 0.2, 0.95),
    bank: clamp(base.bank + (arch.params.bank - 0.2) * 0.5, 0, 0.7),
    adapt: clamp(Math.max(base.adapt, arch.params.adapt * 0.7), 0, 1),
    speed: Math.min(PLAYER_MAX_SPEED, base.speed),
  }
  return { ...arch, level: Math.round(eq), params }
}

/** Quick-match difficulty modifier: -1 easier, 0 default, +1 harder (+2 levels). */
export function quickOpponent(level: number, mod: number): Opponent {
  const base = getOpponent(level)
  if (!mod) return base
  return { ...base, params: paramsAtLevel(clamp(level + mod * 2, 1, 14)) }
}
