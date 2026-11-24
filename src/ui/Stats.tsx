import { OPPONENTS } from '../core/opponents'
import { fmtTime } from '../core/progress'
import { useStore } from '../store'
import { Page } from './common'

const Stat = ({ k, v }: { k: string; v: string | number }) => <div className="stat"><b>{v}</b><small>{k}</small></div>

export function Stats() {
  const s = useStore((x) => x.save)
  const st = s.stats
  const pct = st.matches ? Math.round((st.wins / st.matches) * 100) : 0
  const cleared = Object.values(s.completed).filter((c) => c.wins > 0).length
  const fastest = s.champRuns.length ? fmtTime(Math.min(...s.champRuns.map((r) => r.timeMs))) : '-'
  return (
    <Page title="Statistics">
      <h3>Overall</h3>
      <div className="stat-grid">
        <Stat k="Matches" v={st.matches} /><Stat k="Wins" v={st.wins} /><Stat k="Win rate" v={`${pct}%`} />
        <Stat k="Goals scored" v={st.goalsFor} /><Stat k="Goals conceded" v={st.goalsAgainst} /><Stat k="Time played" v={fmtTime(st.playTimeMs)} />
        <Stat k="Win streak" v={st.winStreak} /><Stat k="Best streak" v={st.bestWinStreak} /><Stat k="Highest level" v={s.unlocked} />
      </div>
      <h3>Championship</h3>
      <div className="stat-grid">
        <Stat k="Levels cleared" v={`${cleared}/12`} /><Stat k="Completed runs" v={s.champRuns.length} /><Stat k="Fastest run" v={fastest} />
      </div>
      <h3>Survival</h3>
      <div className="stat-grid">
        <Stat k="Best streak" v={s.survival.bestStreak} /><Stat k="Runs" v={s.survival.runs} /><Stat k="Total wins" v={s.survival.totalWins} /><Stat k="Total goals" v={s.survival.totalGoals} />
      </div>
      <h3>Per opponent</h3>
      <div className="board">
        <div className="board-head"><span>#</span><span>Opponent</span><span>Best</span><span>Plays</span></div>
        {OPPONENTS.map((o) => {
          const r = s.completed[String(o.level)]
          return <div key={o.id} className="board-row"><span className="rank">{o.level}</span><b style={{ color: o.color }}>{o.name}</b><span>{r?.wins ? `${r.bestScore} · ${fmtTime(r.bestTimeMs)}` : '-'}</span><span className="muted">{r?.plays ?? 0}</span></div>
        })}
      </div>
    </Page>
  )
}
