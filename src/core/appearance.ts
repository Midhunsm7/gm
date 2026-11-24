export type ThemeMode = 'dark' | 'light'

export const DEFAULT_PADDLE = '#3df5ff'
export const DEFAULT_PUCK = '#e8f0ff'

export interface Swatch { name: string; hex: string }
export const PADDLE_COLORS: Swatch[] = [
  { name: 'Cyan', hex: '#3df5ff' }, { name: 'Pink', hex: '#ff3d8b' }, { name: 'Gold', hex: '#ffd166' }, { name: 'Green', hex: '#7bd88f' },
  { name: 'Orange', hex: '#ff8a5c' }, { name: 'Purple', hex: '#b388ff' }, { name: 'Red', hex: '#ff4d4d' }, { name: 'White', hex: '#ffffff' },
]
export const PUCK_COLORS: Swatch[] = [
  { name: 'White', hex: '#e8f0ff' }, { name: 'Yellow', hex: '#ffd166' }, { name: 'Pink', hex: '#ff3d8b' }, { name: 'Cyan', hex: '#3df5ff' },
  { name: 'Green', hex: '#7bd88f' }, { name: 'Orange', hex: '#ff8a5c' }, { name: 'Purple', hex: '#b388ff' }, { name: 'Red', hex: '#ff4d4d' },
]

export const isHex = (v: unknown): v is string => typeof v === 'string' && /^#[0-9a-fA-F]{6}$/.test(v)
