import { Component, ReactNode, useEffect } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { useStore } from './store'
import { audio } from './audio'
import { GameView } from './render/GameView'
import { Menu } from './ui/Menu'
import { Levels } from './ui/Levels'
import { QuickMatch } from './ui/QuickMatch'
import { Leaderboard } from './ui/Leaderboard'
import { Achievements } from './ui/Achievements'
import { Stats } from './ui/Stats'
import { Settings } from './ui/Settings'
import { Results } from './ui/Results'
import { Toasts } from './ui/Toasts'
import { UpdateBanner } from './ui/Pwa'
import { Loading } from './ui/Loading'

class Boundary extends Component<{ children: ReactNode; onReset: () => void }, { err: string | null }> {
  state = { err: null as string | null }
  static getDerivedStateFromError(e: unknown) { return { err: String((e as Error)?.message ?? e) } }
  render() {
    if (this.state.err) {
      return (
        <div className="screen center">
          <h2>Something went wrong</h2>
          <p className="hint">{this.state.err}</p>
          <p className="hint">If this keeps happening, your device may not support WebGL. Try turning off battery saver or another browser.</p>
          <button className="btn primary" onClick={() => { this.setState({ err: null }); this.props.onReset() }}>Back to menu</button>
        </div>
      )
    }
    return this.props.children
  }
}

export default function App() {
  const ready = useStore((s) => s.ready)
  const screen = useStore((s) => s.screen)
  const session = useStore((s) => s.session)
  const results = useStore((s) => s.results)
  const init = useStore((s) => s.init)
  const quit = useStore((s) => s.quitToMenu)

  useEffect(() => { void init() }, [init])

  // browsers only allow audio after a gesture; also block page zoom / scroll gestures
  useEffect(() => {
    const unlock = () => audio.unlock()
    const stop = (e: Event) => e.preventDefault()
    window.addEventListener('pointerdown', unlock)
    window.addEventListener('keydown', unlock)
    document.addEventListener('gesturestart', stop)
    document.addEventListener('gesturechange', stop)
    const ctx = (e: Event) => { if (useStore.getState().screen === 'game') e.preventDefault() }
    document.addEventListener('contextmenu', ctx)
    return () => {
      window.removeEventListener('pointerdown', unlock)
      window.removeEventListener('keydown', unlock)
      document.removeEventListener('gesturestart', stop)
      document.removeEventListener('gesturechange', stop)
      document.removeEventListener('contextmenu', ctx)
    }
  }, [])

  if (!ready || screen === 'loading') return <Loading label="Loading" />

  const page = (() => {
    switch (screen) {
      case 'levels': return <Levels />
      case 'quick': return <QuickMatch />
      case 'leaderboard': return <Leaderboard />
      case 'achievements': return <Achievements />
      case 'stats': return <Stats />
      case 'settings': return <Settings />
      default: return <Menu />
    }
  })()

  return (
    <>
      {screen === 'game' && session ? (
        <Boundary onReset={quit}>
          <GameView key={session.key} cfg={session.cfg} />
          <AnimatePresence>{results && <Results key="results" />}</AnimatePresence>
        </Boundary>
      ) : (
        <AnimatePresence mode="wait">
          <motion.div key={screen} className="route" initial={{ opacity: 0, x: 24 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -24 }} transition={{ duration: 0.18 }}>
            {page}
          </motion.div>
        </AnimatePresence>
      )}
      <Toasts />
      <UpdateBanner />
    </>
  )
}
