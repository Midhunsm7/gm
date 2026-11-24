import { useEffect } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { ACHIEVEMENTS } from '../core/progress'
import { audio } from '../audio'
import { buzz } from '../haptics'
import { useStore } from '../store'

/** Achievement unlock notifications, one at a time. */
export function Toasts() {
  const first = useStore((s) => s.toasts[0])
  const pop = useStore((s) => s.popToast)
  const def = ACHIEVEMENTS.find((a) => a.id === first)
  useEffect(() => {
    if (!first) return
    audio.play('achievement')
    buzz('ui')
    const t = window.setTimeout(pop, 3600)
    return () => window.clearTimeout(t)
  }, [first, pop])
  return (
    <div className="toast-layer" aria-live="polite">
      <AnimatePresence>
        {def && (
          <motion.div key={def.id} className="toast" initial={{ y: -90, opacity: 0, scale: 0.9 }} animate={{ y: 0, opacity: 1, scale: 1 }} exit={{ y: -90, opacity: 0 }} transition={{ type: 'spring', stiffness: 260, damping: 20 }} onClick={pop}>
            <motion.span className="toast-icon" initial={{ rotate: -40, scale: 0 }} animate={{ rotate: 0, scale: 1 }} transition={{ delay: 0.15, type: 'spring' }}>{def.icon}</motion.span>
            <span><small>ACHIEVEMENT UNLOCKED</small><b>{def.name}</b></span>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
