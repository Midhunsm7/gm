import { motion } from 'framer-motion'
import { ACHIEVEMENTS } from '../core/progress'
import { useStore } from '../store'
import { Page } from './common'

export function Achievements() {
  const got = useStore((s) => s.save.achievements)
  const n = ACHIEVEMENTS.filter((a) => got[a.id]).length
  return (
    <Page title="Achievements" right={<span className="count">{n}/{ACHIEVEMENTS.length}</span>}>
      <div className="progress"><i style={{ width: `${(n / ACHIEVEMENTS.length) * 100}%` }} /></div>
      <div className="ach-list">
        {ACHIEVEMENTS.map((a, i) => {
          const d = got[a.id]
          return (
            <motion.div key={a.id} className={`ach ${d ? 'got' : ''}`} initial={{ opacity: 0, x: -14 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.03 }}>
              <span className="ach-icon">{a.icon}</span>
              <div><b>{a.name}</b><small>{a.desc}</small></div>
              <span className="ach-state">{d ? `✓ ${new Date(d).toLocaleDateString()}` : 'Locked'}</span>
            </motion.div>
          )
        })}
      </div>
    </Page>
  )
}
