import { motion } from 'framer-motion'
import { useStore } from '../store'
import { survivalUnlocked } from '../core/progress'
import { OPPONENTS } from '../core/opponents'
import { Avatar } from './Avatar'
import { Backdrop } from './Backdrop'
import { Btn } from './common'
import { InstallCard } from './Pwa'

const list = { hidden: {}, show: { transition: { staggerChildren: 0.07, delayChildren: 0.3 } } }
const item = { hidden: { opacity: 0, y: 26, scale: 0.94 }, show: { opacity: 1, y: 0, scale: 1, transition: { type: 'spring' as const, stiffness: 230, damping: 17 } } }

export function Menu() {
  const save = useStore((s) => s.save)
  const go = useStore((s) => s.go)
  const startChampionship = useStore((s) => s.startChampionship)
  const startSurvival = useStore((s) => s.startSurvival)
  const surv = survivalUnlocked(save)
  const started = Object.keys(save.completed).length > 0
  const champLabel = save.championshipCompleted ? 'New Championship Run' : started ? `Continue · Level ${save.unlocked}` : 'Play Championship'
  const best = Math.max(save.survival.bestStreak, save.stats.bestWinStreak)
  return (
    <div className="screen menu">
      <Backdrop />
      <div className="menu-inner">
        <motion.div className="logo" initial={{ y: -40, opacity: 0, scale: 0.8 }} animate={{ y: 0, opacity: 1, scale: 1 }} transition={{ type: 'spring', damping: 11 }}>
          <span className="logo-small">MPR · ARCADE</span>
          <h1 className="logo-title"><span>AIR</span> HOCKEY</h1>
          <div className="logo-rink" aria-hidden><i className="lr-puck" /></div>
        </motion.div>

        <motion.div className="chips" initial="hidden" animate="show" variants={list}>
          <motion.span variants={item} className="pill c1">🎯 Level {save.unlocked}/12</motion.span>
          <motion.span variants={item} className="pill c2">🏆 {save.stats.wins} wins</motion.span>
          {best > 0 && <motion.span variants={item} className="pill c3">🔥 Best streak {best}</motion.span>}
        </motion.div>

        <motion.nav className="menu-list" initial="hidden" animate="show" variants={list}>
          <motion.div variants={item} whileTap={{ scale: 0.97 }}><Btn accent="#3df5ff" onClick={() => startChampionship()}>🏁 {champLabel}</Btn></motion.div>
          <motion.div variants={item} whileTap={{ scale: 0.97 }}>
            <Btn variant={surv ? 'gold' : 'ghost'} disabled={!surv} onClick={startSurvival}>
              {surv ? '🔥 Survival Mode' : '🔒 Survival Mode'}
              {!surv && <small>Beat all 12 opponents in one championship run to unlock</small>}
              {surv && save.survival.bestStreak > 0 && <small>Best streak: {save.survival.bestStreak}</small>}
            </Btn>
          </motion.div>
          <motion.div variants={item} whileTap={{ scale: 0.97 }}><Btn accent="#ff3d8b" onClick={() => go('quick')}>⚡ Quick Match</Btn></motion.div>
          <motion.div variants={item} whileTap={{ scale: 0.97 }}><Btn accent="#b388ff" onClick={() => go('levels')}>🎯 Level Selection</Btn></motion.div>
          <motion.div variants={item} className="menu-grid">
            <Btn small accent="#ffd166" onClick={() => go('leaderboard')}>🏆 Leaderboard</Btn>
            <Btn small accent="#ff7a59" onClick={() => go('achievements')}>🎖️ Achievements</Btn>
            <Btn small accent="#7bd88f" onClick={() => go('stats')}>📊 Statistics</Btn>
            <Btn small accent="#5ec8ff" onClick={() => go('settings')}>⚙️ Settings</Btn>
          </motion.div>
        </motion.nav>

        <div className="marquee" aria-hidden>
          <div className="marquee-track">
            {[...OPPONENTS, ...OPPONENTS].map((o, i) => (
              <span key={i} className="mq-item"><Avatar spec={o.avatar} color={o.color} size={44} /></span>
            ))}
          </div>
        </div>
        <InstallCard />
      </div>
    </div>
  )
}
