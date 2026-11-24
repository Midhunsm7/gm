import { useEffect } from 'react'
import { motion } from 'framer-motion'
import { IntroStyle, Opponent, difficultyRating } from '../core/opponents'
import { MatchConfig } from '../core/engine'
import { audio } from '../audio'
import { Avatar } from './Avatar'
import { Pips } from './common'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Anim = { initial: any; animate: any; transition: any }
const spring = { type: 'spring', stiffness: 140, damping: 14 }
/** One distinct entrance per opponent. */
export const INTRO_ANIM: Record<IntroStyle, Anim> = {
  slide: { initial: { x: -320, opacity: 0 }, animate: { x: 0, opacity: 1 }, transition: spring },
  glitch: { initial: { opacity: 0 }, animate: { x: [0, -16, 14, -9, 6, 0], skewX: [0, 24, -24, 12, 0, 0], opacity: [0, 1, 0.3, 1, 0.6, 1] }, transition: { duration: 0.8 } },
  spin: { initial: { rotate: -540, scale: 0 }, animate: { rotate: 0, scale: 1 }, transition: { duration: 0.9, ease: 'easeOut' } },
  drop: { initial: { y: -520, opacity: 0 }, animate: { y: 0, opacity: 1 }, transition: { type: 'spring', stiffness: 120, damping: 9 } },
  zoom: { initial: { scale: 4.5, opacity: 0 }, animate: { scale: 1, opacity: 1 }, transition: { duration: 0.7, ease: 'easeOut' } },
  flicker: { initial: { opacity: 0 }, animate: { opacity: [0, 1, 0, 1, 0, 0.4, 1] }, transition: { duration: 1.1 } },
  stomp: { initial: { y: -380, scaleY: 1.6 }, animate: { y: 0, scaleY: [1.6, 0.55, 1.1, 1] }, transition: { duration: 0.8, times: [0, 0.55, 0.8, 1] } },
  slash: { initial: { x: 420, skewX: -40, opacity: 0 }, animate: { x: 0, skewX: 0, opacity: 1 }, transition: { duration: 0.45, ease: 'easeOut' } },
  ghost: { initial: { opacity: 0, y: 50, scale: 0.8 }, animate: { opacity: [0, 0.5, 1], y: [50, -14, 0], scale: [0.8, 1.05, 1] }, transition: { duration: 1.1 } },
  pounce: { initial: { x: -420, y: 220, scale: 0.5, opacity: 0 }, animate: { x: 0, y: 0, scale: 1, opacity: 1 }, transition: { type: 'spring', stiffness: 170, damping: 11 } },
  crown: { initial: { y: -240, scale: 0.6, opacity: 0 }, animate: { y: 0, scale: 1, opacity: 1 }, transition: { duration: 0.9, ease: 'easeOut' } },
  champion: { initial: { scale: 0, rotate: 180, opacity: 0 }, animate: { scale: [0, 1.35, 1], rotate: 0, opacity: 1 }, transition: { duration: 1.1 } },
}

export function Intro({ cfg, onDone }: { cfg: MatchConfig; onDone: () => void }) {
  const o: Opponent = cfg.opponent
  const a = INTRO_ANIM[o.intro]
  useEffect(() => {
    audio.play('intro')
    const t = window.setTimeout(onDone, 3600)
    return () => window.clearTimeout(t)
  }, [onDone])
  const tag = cfg.mode === 'championship' ? `LEVEL ${cfg.level}` : cfg.mode === 'survival' ? `SURVIVAL · WIN ${(cfg.survivalWins ?? 0) + 1}` : 'QUICK MATCH'
  return (
    <motion.div className="intro" style={{ ['--c' as string]: o.color }} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onDone}>
      <motion.small className="intro-tag" initial={{ y: -20, opacity: 0 }} animate={{ y: 0, opacity: 1 }}>{tag} · FIRST TO {cfg.targetScore}</motion.small>
      <motion.div className={`intro-avatar ${o.intro === 'champion' ? 'champ-glow' : ''}`} initial={a.initial} animate={a.animate} transition={a.transition}>
        <Avatar spec={o.avatar} color={o.color} size={170} />
      </motion.div>
      <motion.h2 initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.7 }}>{o.name}</motion.h2>
      <motion.p className="intro-strategy" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.9 }}>{o.strategy}</motion.p>
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 1.0 }}><Pips n={difficultyRating(o.params)} color={o.color} /></motion.div>
      <motion.p className="intro-line" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 1.3 }}>“{o.introLine}”</motion.p>
      <motion.small className="hint blink" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 1.8 }}>Tap to start</motion.small>
    </motion.div>
  )
}
