import { useEffect, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { Backdrop } from './Backdrop'

const TIPS = [
  'Hit the puck with the edge of your paddle for sharper angles.',
  'Bank shots off the side walls fool slow defenders.',
  'Stay near your goal after attacking: the puck comes back fast.',
  'Every opponent has a different style. Watch how they move.',
  'Beat all 12 opponents in one run to unlock Survival Mode.',
  'Everything is saved on your device and works offline.',
]

/** Animated loading screen: a tiny rink with a bouncing puck, wavy title, shimmering bar and rotating tips. */
export function Loading({ label = 'Loading' }: { label?: string }) {
  const [tip, setTip] = useState(0)
  useEffect(() => {
    const t = window.setInterval(() => setTip((v) => (v + 1) % TIPS.length), 2200)
    return () => window.clearInterval(t)
  }, [])
  return (
    <div className="loader" role="status" aria-label={label}>
      <Backdrop />
      <div className="ld-content">
        <motion.div className="ld-rink" initial={{ scale: 0.7, opacity: 0, rotate: -6 }} animate={{ scale: 1, opacity: 1, rotate: 0 }} transition={{ type: 'spring', damping: 12 }}>
          <i className="ld-mid" />
          <i className="ld-circle" />
          <i className="ld-pad top" />
          <i className="ld-pad bot" />
          <i className="ld-puck" />
        </motion.div>
        <h1 className="ld-title" aria-hidden>
          {'AIR HOCKEY'.split('').map((c, i) => <span key={i} style={{ ['--i' as string]: i }}>{c === ' ' ? '\u00a0' : c}</span>)}
        </h1>
        <div className="ld-bar"><i /></div>
        <p className="ld-label">{label}<b className="dots"><span>.</span><span>.</span><span>.</span></b></p>
        <div className="ld-tip">
          <AnimatePresence mode="wait">
            <motion.small key={tip} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.25 }}>{TIPS[tip]}</motion.small>
          </AnimatePresence>
        </div>
      </div>
    </div>
  )
}
