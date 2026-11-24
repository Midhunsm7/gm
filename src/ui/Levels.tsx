import { motion } from 'framer-motion'
import { OPPONENTS, difficultyRating } from '../core/opponents'
import { fmtTime } from '../core/progress'
import { useStore } from '../store'
import { Avatar } from './Avatar'
import { Page, Pips } from './common'
import { audio } from '../audio'

export function Levels() {
  const save = useStore((s) => s.save)
  const start = useStore((s) => s.startChampionship)
  const total = OPPONENTS.length
  const beaten = OPPONENTS.filter((o) => (save.completed[String(o.level)]?.wins ?? 0) > 0).length
  const pct = Math.round((beaten / total) * 100)
  return (
    <Page title="Championship" theme="gold" icon="🏆">
      <motion.div className="champ-banner" initial={{ opacity: 0, y: -14, scale: 0.94 }} animate={{ opacity: 1, y: 0, scale: 1 }} transition={{ type: 'spring', stiffness: 220, damping: 16, delay: 0.12 }}>
        <span className="cb-trophy" aria-hidden>🏆</span>
        <div className="cb-main">
          <b>{beaten}/{total} opponents defeated</b>
          <div className="cb-bar"><motion.i initial={{ width: 0 }} animate={{ width: `${pct}%` }} transition={{ duration: 1.1, delay: 0.4, ease: 'easeOut' }} /></div>
        </div>
        <span className="cb-pct">{pct}%</span>
      </motion.div>
      <p className="hint">Defeat opponents in order. Every win unlocks the next level; finished levels can be replayed.</p>
      <div className="level-grid">
        {OPPONENTS.map((o, i) => {
          const locked = o.level > save.unlocked
          const rec = save.completed[String(o.level)]
          const done = !!rec && rec.wins > 0
          const current = !locked && !done
          return (
            <motion.button key={o.id} className={`level ${locked ? 'locked' : ''} ${done ? 'done' : ''} ${current ? 'current' : ''}`}
              style={{ ['--c' as string]: o.color, ['--n' as string]: i }} disabled={locked}
              initial={{ opacity: 0, y: 28, scale: 0.85 }} animate={{ opacity: locked ? 0.55 : 1, y: 0, scale: 1 }}
              transition={{ type: 'spring', stiffness: 230, damping: 17, delay: 0.25 + i * 0.05 }}
              whileHover={locked ? undefined : { y: -5, scale: 1.04 }} whileTap={locked ? undefined : { scale: 0.96 }}
              onClick={() => { audio.play('ui'); start(o.level) }}>
              <span className="lvl-no">{o.level}</span>
              {current && <em className="lvl-flag">NEXT</em>}
              {done && <motion.i className="lvl-check" initial={{ scale: 0, rotate: -90 }} animate={{ scale: 1, rotate: 0 }} transition={{ type: 'spring', stiffness: 400, damping: 12, delay: 0.5 + i * 0.05 }}>✓</motion.i>}
              <div className="lvl-avatar"><Avatar spec={o.avatar} color={locked ? '#44506e' : o.color} size={64} />{locked && <span className="lvl-lock" aria-hidden>🔒</span>}</div>
              <b>{locked ? '???' : o.name}</b>
              <Pips n={difficultyRating(o.params)} color={locked ? '#44506e' : o.color} anim={!locked} />
              <small>{locked ? 'Locked' : done ? `✓ Best ${rec.bestScore} · ${fmtTime(rec.bestTimeMs)}` : current ? 'Next challenge' : 'Not played'}</small>
              {!locked && <small className="muted">{o.strategy}</small>}
            </motion.button>
          )
        })}
      </div>
    </Page>
  )
}
