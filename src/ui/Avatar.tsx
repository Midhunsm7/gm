import { AvatarSpec } from '../core/opponents'

const DARK = '#0a0f24'
const GOLD = '#ffd166'
const star = (cx: number, cy: number, r: number) =>
  Array.from({ length: 10 }, (_, i) => { const a = -Math.PI / 2 + (i * Math.PI) / 5; const rr = i % 2 ? r * 0.45 : r; return `${(cx + Math.cos(a) * rr).toFixed(1)},${(cy + Math.sin(a) * rr).toFixed(1)}` }).join(' ')

function Head({ h, c }: { h: AvatarSpec['head']; c: string }) {
  const p = { fill: c, stroke: 'rgba(255,255,255,0.35)', strokeWidth: 2 }
  switch (h) {
    case 'round': return <circle cx={50} cy={54} r={34} {...p} />
    case 'square': return <rect x={18} y={22} width={64} height={64} rx={10} {...p} />
    case 'hex': return <polygon points="50,18 82,36 82,72 50,90 18,72 18,36" {...p} />
    case 'ghost': return <path d="M20 88 V50 a30 30 0 0 1 60 0 V88 l-10 -8 l-10 8 l-10 -8 l-10 8 l-10 -8 z" {...p} />
    case 'angular': return <polygon points="20,30 50,18 80,30 86,62 62,88 38,88 14,62" {...p} />
    case 'hood': return <path d="M50 14 C76 14 86 40 84 70 C82 86 66 90 50 90 C34 90 18 86 16 70 C14 40 24 14 50 14 Z" {...p} />
    default: return <ellipse cx={50} cy={54} rx={28} ry={36} {...p} />
  }
}

function Eyes({ e, defeated }: { e: AvatarSpec['eyes']; defeated: boolean }) {
  if (defeated) {
    const x = (cx: number) => <path key={cx} d={`M${cx - 5} 43 l10 10 M${cx + 5} 43 l-10 10`} stroke={DARK} strokeWidth={3.5} strokeLinecap="round" />
    return <>{x(38)}{x(62)}</>
  }
  switch (e) {
    case 'dots': return <><circle cx={38} cy={48} r={4.5} fill={DARK} /><circle cx={62} cy={48} r={4.5} fill={DARK} /></>
    case 'bars': return <><rect x={31} y={46} width={14} height={4.5} rx={2} fill={DARK} /><rect x={55} y={46} width={14} height={4.5} rx={2} fill={DARK} /></>
    case 'wide': return <><circle cx={38} cy={48} r={7} fill="#fff" /><circle cx={62} cy={48} r={7} fill="#fff" /><circle cx={39} cy={49} r={3.4} fill={DARK} /><circle cx={63} cy={49} r={3.4} fill={DARK} /></>
    case 'visor': return <><rect x={24} y={42} width={52} height={12} rx={5} fill={DARK} /><rect x={30} y={45} width={20} height={2.5} rx={1} fill="#3df5ff" opacity={0.8} /></>
    case 'angry': return <><polygon points="28,42 47,50 28,54" fill={DARK} /><polygon points="72,42 53,50 72,54" fill={DARK} /></>
    case 'ring': return <><circle cx={38} cy={48} r={6} fill="none" stroke={DARK} strokeWidth={3} /><circle cx={62} cy={48} r={6} fill="none" stroke={DARK} strokeWidth={3} /></>
    case 'glow': return <><circle cx={38} cy={50} r={10} fill="#fff" opacity={0.25} /><circle cx={62} cy={50} r={10} fill="#fff" opacity={0.25} /><circle cx={38} cy={50} r={4.5} fill="#fff" /><circle cx={62} cy={50} r={4.5} fill="#fff" /></>
    case 'slit': return <><path d="M28 48 L46 50" stroke={DARK} strokeWidth={3.5} strokeLinecap="round" /><path d="M72 48 L54 50" stroke={DARK} strokeWidth={3.5} strokeLinecap="round" /></>
    case 'hollow': return <><ellipse cx={38} cy={50} rx={6} ry={9} fill={DARK} /><ellipse cx={62} cy={50} rx={6} ry={9} fill={DARK} /></>
    case 'cyclops': return <><circle cx={50} cy={48} r={11} fill="#fff" /><circle cx={51} cy={49} r={5.5} fill={DARK} /></>
    case 'monocle': return <><circle cx={38} cy={48} r={4} fill={DARK} /><circle cx={62} cy={48} r={8} fill="none" stroke={GOLD} strokeWidth={2.5} /><circle cx={62} cy={48} r={3} fill={DARK} /></>
    default: return <><polygon points={star(38, 48, 8)} fill={DARK} /><polygon points={star(62, 48, 8)} fill={DARK} /></>
  }
}

function Mouth({ m, defeated }: { m: AvatarSpec['mouth']; defeated: boolean }) {
  if (defeated) return <path d="M38 74 Q50 64 62 74" fill="none" stroke={DARK} strokeWidth={3} strokeLinecap="round" />
  const s = { fill: 'none', stroke: DARK, strokeWidth: 3, strokeLinecap: 'round' as const }
  switch (m) {
    case 'smile': return <path d="M38 66 Q50 78 62 66" {...s} />
    case 'flat': return <path d="M40 70 H60" {...s} />
    case 'grin': return <path d="M36 64 Q50 84 64 64 Z" fill={DARK} />
    case 'teeth': return <><rect x={37} y={64} width={26} height={11} rx={2} fill={DARK} /><path d="M44 64 V75 M50 64 V75 M56 64 V75" stroke="#fff" strokeWidth={1.6} /></>
    case 'wavy': return <path d="M34 70 q5 -6 9 0 t9 0 t9 0 t9 0" {...s} />
    case 'fangs': return <><path d="M38 66 H62" {...s} /><polygon points="40,66 45,66 42.5,75" fill="#fff" /><polygon points="55,66 60,66 57.5,75" fill="#fff" /></>
    case 'smirk': return <path d="M40 70 Q54 73 63 62" {...s} />
    case 'stache': return <path d="M32 68 q9 -11 18 -3 q9 -8 18 3 q-9 6 -18 0 q-9 6 -18 0z" fill={DARK} />
    default: return null
  }
}

function Extra({ x, c }: { x: AvatarSpec['extra']; c: string }) {
  switch (x) {
    case 'antenna': return <><path d="M50 20 V6" stroke="#fff" strokeWidth={3} /><circle cx={50} cy={6} r={4.5} fill={GOLD} /></>
    case 'cap': return <><path d="M20 38 Q50 2 80 38 Z" fill={GOLD} stroke="rgba(0,0,0,.25)" strokeWidth={1.5} /><rect x={58} y={34} width={34} height={6} rx={3} fill={GOLD} /></>
    case 'bolt': return <polygon points="56,2 40,24 51,24 44,40 64,16 52,16" fill={GOLD} />
    case 'shield': return <path d="M70 70 h22 v14 q0 10 -11 14 q-11 -4 -11 -14 z" fill="#3df5ff" stroke={DARK} strokeWidth={2} />
    case 'horns': return <><polygon points="24,32 14,4 42,22" fill="#fff" /><polygon points="76,32 86,4 58,22" fill="#fff" /></>
    case 'halo': return <ellipse cx={50} cy={13} rx={22} ry={6} fill="none" stroke={GOLD} strokeWidth={3.5} />
    case 'hood': return <path d="M16 70 C14 40 24 14 50 14 C76 14 86 40 84 70" fill="none" stroke="rgba(0,0,0,.4)" strokeWidth={6} />
    case 'speed': return <><path d="M2 38 H16 M0 50 H14 M4 62 H18" stroke="#fff" strokeWidth={3} strokeLinecap="round" opacity={0.8} /></>
    case 'wisps': return <><path d="M14 80 q-10 6 -4 14 M86 80 q10 6 4 14 M50 92 q-6 6 0 8" fill="none" stroke="#fff" strokeWidth={3} strokeLinecap="round" opacity={0.6} /></>
    case 'spikes': return <>{[28, 40, 50, 60, 72].map((px, i) => <polygon key={i} points={`${px - 6},24 ${px},${6 + (i % 2) * 6} ${px + 6},24`} fill={c} stroke="rgba(255,255,255,.4)" strokeWidth={1.5} />)}</>
    case 'crown': return <polygon points="28,24 34,4 43,17 50,2 57,17 66,4 72,24" fill={GOLD} stroke="rgba(0,0,0,.3)" strokeWidth={1.5} />
    default: return <><path d="M24 30 q-8 -10 -2 -24 q8 8 8 20 z" fill="#ff9f1c" /><path d="M50 18 q-8 -12 0 -26 q8 14 0 26 z" fill="#ff3d8b" transform="translate(0 8)" /><path d="M76 30 q8 -10 2 -24 q-8 8 -8 20 z" fill="#ff9f1c" /></>
  }
}

export function Avatar({ spec, color, size = 120, defeated = false }: { spec: AvatarSpec; color: string; size?: number; defeated?: boolean }) {
  return (
    <svg viewBox="0 0 100 100" width={size} height={size} role="img" aria-label="Opponent avatar" style={{ overflow: 'visible', filter: `drop-shadow(0 0 10px ${color}88)` }}>
      <Extra x={spec.extra} c={color} />
      <Head h={spec.head} c={color} />
      <Eyes e={spec.eyes} defeated={defeated} />
      <Mouth m={spec.mouth} defeated={defeated} />
    </svg>
  )
}
