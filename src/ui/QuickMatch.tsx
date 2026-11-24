import { AnimatePresence, motion } from 'framer-motion'
import { OPPONENTS, difficultyRating, quickOpponent } from '../core/opponents'
import { TARGETS } from '../core/constants'
import { useStore } from '../store'
import { audio } from '../audio'
import { buzz } from '../haptics'
import { Avatar } from './Avatar'
import { Btn, Page, Pips, Segmented } from './common'

const sections = { hidden: {}, show: { transition: { staggerChildren: 0.09, delayChildren: 0.1 } } }
const sec = { hidden: { opacity: 0, y: 22 }, show: { opacity: 1, y: 0, transition: { type: 'spring' as const, stiffness: 240, damping: 20 } } }
const TARGET_COLORS = ['#3df5ff', '#7bd88f', '#ffd166', '#ff8a5c', '#ff3d8b']
const DIFFS: { value: number; label: string; color: string }[] = [
  { value: -1, label: '🐢 Easier', color: '#7bd88f' },
  { value: 0, label: '⚖️ Normal', color: '#3df5ff' },
  { value: 1, label: '🔥 Harder', color: '#ff3d8b' },
]

export function QuickMatch() {
  const save = useStore((s) => s.save)
  const setQuick = useStore((s) => s.setQuick)
  const start = useStore((s) => s.startQuick)
  const q = save.quick
  const opp = quickOpponent(q.opponent, q.difficulty)
  const unlocked = OPPONENTS.filter((o) => o.level <= save.unlocked)
  return (
    <Page title="Quick Match" theme="pink" icon="⚡">
      <motion.div variants={sections} initial="hidden" animate="show">
        <motion.p variants={sec} className="hint tip-card"><span aria-hidden>🎮</span>Practice freely. Quick matches never change championship progress, streaks or leaderboards.</motion.p>

        <motion.h3 variants={sec}>Opponent</motion.h3>
        <motion.div variants={sec} className="chip-row">
          {unlocked.map((o) => {
            const on = q.opponent === o.level
            return (
              <motion.button key={o.id} className={`chip avatar-chip ${on ? 'on' : ''}`} style={{ ['--c' as string]: o.color }}
                animate={{ scale: on ? 1.12 : 1 }} whileHover={{ y: -3 }} whileTap={{ scale: 0.88 }} transition={{ type: 'spring', stiffness: 420, damping: 16 }}
                onClick={() => { audio.play('ui'); buzz('ui'); setQuick({ opponent: o.level }) }} aria-label={o.name}>
                <Avatar spec={o.avatar} color={o.color} size={40} />
              </motion.button>
            )
          })}
        </motion.div>

        <motion.div variants={sec}>
          <AnimatePresence mode="wait" initial={false}>
            <motion.div key={q.opponent} className="card preview vs-card" style={{ ['--c' as string]: opp.color }}
              initial={{ opacity: 0, x: 46, rotate: 2 }} animate={{ opacity: 1, x: 0, rotate: 0 }} exit={{ opacity: 0, x: -46, rotate: -2 }} transition={{ type: 'spring', stiffness: 280, damping: 22 }}>
              <div className="vs-avatar"><Avatar spec={opp.avatar} color={opp.color} size={84} /></div>
              <div className="vs-info">
                <b>{opp.name}</b>
                <small>{opp.strategy}</small>
                <Pips key={q.difficulty} n={difficultyRating(opp.params)} color={opp.color} anim />
              </div>
              <span className="vs-badge" aria-hidden>VS</span>
            </motion.div>
          </AnimatePresence>
        </motion.div>

        <motion.h3 variants={sec}>First to</motion.h3>
        <motion.div variants={sec}>
          <Segmented id="target" value={q.target} onChange={(v) => setQuick({ target: v })}
            options={TARGETS.map((t, i) => ({ value: t, label: String(t), color: TARGET_COLORS[i % TARGET_COLORS.length] }))} />
        </motion.div>

        <motion.h3 variants={sec}>AI difficulty</motion.h3>
        <motion.div variants={sec}>
          <Segmented id="diff" value={q.difficulty} onChange={(v) => setQuick({ difficulty: v })} options={DIFFS} />
        </motion.div>

        <motion.div variants={sec} className="actions" whileTap={{ scale: 0.97 }}>
          <Btn accent="#ff3d8b" className="start-btn" onClick={start}><span className="bolt" aria-hidden>⚡</span> Start Match</Btn>
        </motion.div>
      </motion.div>
    </Page>
  )
}
