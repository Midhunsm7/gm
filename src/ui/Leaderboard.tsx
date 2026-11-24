import { useState } from 'react'
import { BOARD_METRICS, BoardCategory, LeaderboardProvider, LocalLeaderboard } from '../core/progress'
import { useStore } from '../store'
import { Page } from './common'

// Swap this for an online provider later; nothing else in the game needs to change.
const provider: LeaderboardProvider = LocalLeaderboard
const CATS: { id: BoardCategory; label: string }[] = [{ id: 'championship', label: 'Championship' }, { id: 'survival', label: 'Survival' }, { id: 'overall', label: 'Overall' }]

export function Leaderboard() {
  const save = useStore((s) => s.save)
  const [cat, setCat] = useState<BoardCategory>('championship')
  const [metric, setMetric] = useState<Record<BoardCategory, string>>({ championship: 'fastest', survival: 'streak', overall: 'wins' })
  const metrics = BOARD_METRICS[cat]
  const m = metrics.find((x) => x.id === metric[cat]) ?? metrics[0]
  const rows = provider.top(save, cat, m.id, 10)
  return (
    <Page title="Leaderboard">
      <div className="seg" role="tablist" aria-label="Scope">
        <button className="on" role="tab" aria-selected>Local (this device)</button>
        <button disabled role="tab" aria-selected={false} title="Online rankings are planned">Global · coming soon</button>
      </div>
      <div className="seg">
        {CATS.map((c) => <button key={c.id} className={cat === c.id ? 'on' : ''} onClick={() => setCat(c.id)}>{c.label}</button>)}
      </div>
      <div className="chip-row">
        {metrics.map((x) => <button key={x.id} className={`chip ${m.id === x.id ? 'on' : ''}`} onClick={() => setMetric({ ...metric, [cat]: x.id })}>{x.label}</button>)}
      </div>
      <div className="board">
        <div className="board-head"><span>#</span><span>{m.label}</span><span>Details</span><span>Date</span></div>
        {rows.length === 0 && <p className="empty">No records yet. {cat === 'championship' ? 'Finish a full championship run to set one.' : cat === 'survival' ? 'Finish a Survival run to set one.' : 'Play a match to get started.'}</p>}
        {rows.map((r) => (
          <div key={r.rank} className={`board-row ${r.rank === 1 ? 'best' : ''}`}>
            <span className="rank">{r.rank}</span><b>{r.value}</b><span>{r.sub}</span><span className="muted">{r.date}</span>
          </div>
        ))}
      </div>
      <p className="hint">Records are stored only on this device. Online global rankings are not available yet.</p>
    </Page>
  )
}
