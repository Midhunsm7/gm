import { motion } from 'framer-motion'
import { useStore } from '../store'
import { ACHIEVEMENTS, fmtTime, survivalScore } from '../core/progress'
import { nextChampionshipLevel } from '../core/flow'
import { survivalOpponent, difficultyRating } from '../core/opponents'
import { Avatar } from './Avatar'
import { Btn, Pips } from './common'
import { Confetti } from './Confetti'

const Row = ({ k, v }: { k: string; v: string | number }) => <div className="res-row"><span>{k}</span><b>{v}</b></div>

/** Result presentations: championship win/defeat, survival win / milestone / run ended, quick match. */
export function Results() {
  const r = useStore((s) => s.results)
  const save = useStore((s) => s.save)
  const st = useStore()
  if (!r) return null
  const { kind, result, outcome, run } = r
  const o = result.cfg.opponent
  const won = result.won
  const next = nextChampionshipLevel(result.cfg.level)
  const rec = save.completed[String(result.cfg.level)]
  const champ = outcome.championshipCompleted

  const title =
    kind === 'championship-win' ? (champ ? 'CHAMPION!' : `LEVEL ${result.cfg.level} CLEARED`)
    : kind === 'championship-defeat' ? 'DEFEATED'
    : kind === 'survival-milestone' ? `${outcome.milestone} WIN STREAK!`
    : kind === 'survival-win' ? `STREAK ${run?.wins ?? 0}`
    : kind === 'survival-end' ? 'RUN ENDED'
    : won ? 'MATCH WON' : 'MATCH LOST'
  const tone = won ? 'win' : 'lose'

  return (
    <motion.div className={`results ${tone} ${kind}`} style={{ ['--c' as string]: o.color }} initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
      {won && <Confetti big={kind === 'survival-milestone' || champ} />}
      <motion.div className="res-card" initial={{ scale: 0.85, y: 30 }} animate={{ scale: 1, y: 0 }} transition={{ type: 'spring', damping: 14 }}>
        <motion.h2 className={`res-title ${champ || kind === 'survival-milestone' ? 'epic' : ''}`} initial={{ scale: 0.4, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ type: 'spring', stiffness: 200, damping: 11, delay: 0.1 }}>{title}</motion.h2>

        <div className="res-opp">
          <motion.div animate={won ? { rotate: [0, -14, 10, -22], y: [0, 6, 0, 14], opacity: [1, 1, 1, 0.8] } : { y: [0, -8, 0] }} transition={won ? { duration: 1.2 } : { repeat: Infinity, duration: 1.4 }}>
            <Avatar spec={o.avatar} color={o.color} size={92} defeated={won} />
          </motion.div>
          <div><b>{o.name}</b><small>“{won ? o.loseLine : o.winLine}”</small></div>
        </div>

        <div className="res-score"><b>{result.playerScore}</b><span>:</span><b>{result.aiScore}</b></div>

        <div className="res-stats">
          <Row k="Time" v={fmtTime(result.durationMs)} />
          {kind.startsWith('championship') && rec && <Row k="Best on this level" v={rec.wins ? `${rec.bestScore} · ${fmtTime(rec.bestTimeMs)}` : '-'} />}
          {kind === 'quick' && <Row k="Mode" v={`Quick · first to ${result.cfg.targetScore}`} />}
          {run && kind !== 'quick' && (
            <>
              <Row k="Win streak" v={run.wins} />
              <Row k="Goals scored / conceded" v={`${run.goalsFor} / ${run.goalsAgainst}`} />
              <Row k="Survival score" v={survivalScore(run.wins, run.goalsFor, run.goalsAgainst)} />
            </>
          )}
          {kind === 'survival-end' && (
            <>
              <Row k="Leaderboard rank" v={r.rank ? `#${r.rank}` : '-'} />
              <Row k="Best streak ever" v={save.survival.bestStreak} />
            </>
          )}
          {kind === 'survival-milestone' && <Row k="Total survival wins" v={save.survival.totalWins} />}
        </div>

        {r.newBest && <motion.div className="badge" initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ delay: 0.5, type: 'spring' }}>★ NEW PERSONAL BEST</motion.div>}
        {outcome.unlockedLevel && (
          <motion.div className="unlock" initial={{ x: -40, opacity: 0 }} animate={{ x: 0, opacity: 1 }} transition={{ delay: 0.6 }}>
            <motion.span animate={{ rotate: [0, -20, 20, 0], scale: [1, 1.4, 1] }} transition={{ delay: 0.9, duration: 0.7 }}>🔓</motion.span> Level {outcome.unlockedLevel} unlocked
          </motion.div>
        )}
        {champ && <motion.div className="unlock gold" initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ delay: 0.8, type: 'spring' }}>🏆 Championship complete · Survival Mode unlocked</motion.div>}
        {outcome.newAchievements.length > 0 && (
          <div className="res-ach">{outcome.newAchievements.map((id) => { const a = ACHIEVEMENTS.find((x) => x.id === id); return a ? <span key={id}>{a.icon} {a.name}</span> : null })}</div>
        )}
        {(kind === 'survival-win' || kind === 'survival-milestone') && (
          <div className="next-opp" style={{ ['--c' as string]: nextSurvival(run?.wins ?? 0).color }}>
            <small>NEXT UP</small><b>{nextSurvival(run?.wins ?? 0).name}</b><Pips n={difficultyRating(nextSurvival(run?.wins ?? 0).params)} color={nextSurvival(run?.wins ?? 0).color} />
          </div>
        )}

        <div className="actions">
          {kind === 'championship-win' && next && <Btn onClick={() => st.startChampionship(next)}>Next Level</Btn>}
          {kind === 'championship-win' && !next && champ && <Btn variant="gold" onClick={st.startSurvival}>Try Survival Mode</Btn>}
          {kind === 'championship-win' && <Btn variant="ghost" onClick={() => st.startChampionship(result.cfg.level)}>Replay</Btn>}
          {kind === 'championship-defeat' && <Btn onClick={() => st.startChampionship(result.cfg.level)}>Retry</Btn>}
          {(kind === 'survival-win' || kind === 'survival-milestone') && <Btn variant="gold" onClick={st.nextSurvival}>Next Opponent</Btn>}
          {kind === 'survival-win' && <Btn variant="ghost" onClick={st.quitToMenu}>Bank Run & Quit</Btn>}
          {kind === 'survival-end' && <Btn variant="gold" onClick={st.startSurvival}>Run Again</Btn>}
          {kind === 'quick' && <Btn onClick={st.startQuick}>Play Again</Btn>}
          {kind === 'quick' && <Btn variant="ghost" onClick={() => st.go('quick')}>Change Setup</Btn>}
          {kind.startsWith('championship') && <Btn variant="ghost" onClick={() => st.go('levels')}>Levels</Btn>}
          {kind === 'survival-end' && <Btn variant="ghost" onClick={() => st.go('leaderboard')}>Leaderboard</Btn>}
          {kind !== 'survival-win' && kind !== 'survival-milestone' && <Btn variant="ghost" onClick={st.quitToMenu}>Menu</Btn>}
        </div>
      </motion.div>
    </motion.div>
  )
}

function nextSurvival(wins: number) { return survivalOpponent(wins) }
