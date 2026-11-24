import { useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { useStore } from '../store'
import { buzz, hapticsSupported } from '../haptics'
import { audio } from '../audio'
import { Btn, Modal, Page, Segmented, Slider, Toggle } from './common'
import { PADDLE_COLORS, PUCK_COLORS, Swatch, ThemeMode } from '../core/appearance'
import { InstallCard } from './Pwa'

function Swatches({ label, value, colors, onChange }: { label: string; value: string; colors: Swatch[]; onChange: (hex: string) => void }) {
  const preset = colors.some((c) => c.hex === value)
  const pick = (hex: string) => { audio.play('ui'); buzz('ui'); onChange(hex) }
  return (
    <div className="swatches" role="radiogroup" aria-label={label}>
      {colors.map((c) => (
        <motion.button key={c.hex} role="radio" aria-checked={c.hex === value} aria-label={c.name} title={c.name}
          className={`swatch ${c.hex === value ? 'on' : ''}`} style={{ ['--s' as string]: c.hex }}
          whileHover={{ scale: 1.12 }} whileTap={{ scale: 0.85 }} onClick={() => pick(c.hex)} />
      ))}
      <label className={`swatch custom ${!preset ? 'on' : ''}`} style={{ ['--s' as string]: preset ? undefined : value }} title="Custom colour">
        <input type="color" aria-label={`Custom ${label} colour`} value={value} onChange={(e) => onChange(e.target.value.toLowerCase())} />
        <span aria-hidden>{preset ? '+' : ''}</span>
      </label>
    </div>
  )
}

/** Settings body, reused by the pause overlay. */
export function SettingsPanel({ showDanger = true }: { showDanger?: boolean }) {
  const s = useStore((x) => x.save.settings)
  const up = useStore((x) => x.updateSettings)
  const reset = useStore((x) => x.resetProgress)
  const [confirm, setConfirm] = useState(false)
  const hap = hapticsSupported()
  return (
    <div className="settings">
      <h3>Appearance</h3>
      <Segmented id="theme" value={s.theme} onChange={(v: ThemeMode) => up({ theme: v })}
        options={[{ value: 'dark' as ThemeMode, label: '🌙 Dark', color: '#b388ff' }, { value: 'light' as ThemeMode, label: '☀️ Light', color: '#ffd166' }]} />
      <div className="ap-preview" style={{ ['--pc' as string]: s.paddleColor, ['--uc' as string]: s.puckColor }} aria-hidden>
        <i className="ap-mid" />
        <i className="ap-pad mine" />
        <i className="ap-puck" />
        <i className="ap-pad theirs" />
      </div>
      <p className="ap-label">Mallet colour</p>
      <Swatches label="mallet" value={s.paddleColor} colors={PADDLE_COLORS} onChange={(hex) => up({ paddleColor: hex })} />
      <p className="ap-label">Puck colour</p>
      <Swatches label="puck" value={s.puckColor} colors={PUCK_COLORS} onChange={(hex) => up({ puckColor: hex })} />
      <h3>Audio</h3>
      <Slider label="Master volume" value={s.master} onChange={(v) => up({ master: v })} />
      <Slider label="Music volume" value={s.music} onChange={(v) => up({ music: v })} />
      <Slider label="Effects volume" value={s.sfx} onChange={(v) => { up({ sfx: v }); audio.play('paddle', 0.6) }} />
      <Toggle label="Background music" value={s.musicOn} onChange={(v) => up({ musicOn: v })} />
      <Toggle label="Mute all" value={s.mute} onChange={(v) => up({ mute: v })} />
      <h3>Controls &amp; feel</h3>
      <Toggle label="Haptic feedback" value={s.haptics && hap} disabled={!hap} onChange={(v) => { up({ haptics: v }); if (v) setTimeout(() => buzz('goalFor'), 50) }}
        hint={hap ? 'Vibration on hits, goals and wins' : 'Not supported on this device or browser (iOS Safari has no vibration API)'} />
      <Toggle label="Camera shake" value={s.shake} onChange={(v) => up({ shake: v })} hint="Subtle shake on powerful hits" />
      <Slider label="Touch offset" value={s.touchOffset} min={0} max={0.3} step={0.01} onChange={(v) => up({ touchOffset: v })} fmt={(v) => (v < 0.01 ? 'Off' : `${Math.round(v * 100)}`)} />
      <small className="hint">Moves the paddle ahead of your finger so it stays visible. Keyboard: WASD / arrows. Esc or P pauses.</small>
      <h3>Graphics</h3>
      <Toggle label="High quality" value={s.quality === 'high'} onChange={(v) => up({ quality: v ? 'high' : 'low' })} hint="Shadows, reflections and sharper rendering. Turn off for older phones." />
      {showDanger && (
        <>
          <h3>Install</h3>
          <InstallCard />
          <h3>Data</h3>
          <Btn variant="danger" small onClick={() => setConfirm(true)}>Reset progress…</Btn>
          <AnimatePresence>
            {confirm && (
              <Modal onClose={() => setConfirm(false)}>
                <h3>Reset all progress?</h3>
                <p>This erases unlocked levels, records, leaderboard entries, statistics and achievements on this device. Settings are kept. This cannot be undone.</p>
                <div className="actions">
                  <Btn variant="ghost" small onClick={() => setConfirm(false)}>Cancel</Btn>
                  <Btn variant="danger" small onClick={() => { setConfirm(false); void reset() }}>Erase everything</Btn>
                </div>
              </Modal>
            )}
          </AnimatePresence>
        </>
      )}
    </div>
  )
}

export function Settings() {
  return <Page title="Settings"><SettingsPanel /></Page>
}
