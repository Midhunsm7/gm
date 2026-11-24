import { useEffect, useState } from 'react'
import { useStore } from '../store'
import { Btn } from './common'

const isStandalone = () => typeof window !== 'undefined' && (window.matchMedia('(display-mode: standalone)').matches || (navigator as unknown as { standalone?: boolean }).standalone === true)
const isIOS = () => typeof navigator !== 'undefined' && /iphone|ipad|ipod/i.test(navigator.userAgent) || (typeof navigator !== 'undefined' && navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)

/** Install guidance: native prompt where available, Add-to-Home-Screen instructions on iOS Safari. */
export function InstallCard() {
  const ev = useStore((s) => s.installEvent)
  const setEv = useStore((s) => s.setInstallEvent)
  const [done, setDone] = useState(isStandalone())
  useEffect(() => {
    const h = () => setDone(true)
    window.addEventListener('appinstalled', h)
    return () => window.removeEventListener('appinstalled', h)
  }, [])
  if (done) return <p className="hint">Installed. It runs fullscreen and offline.</p>
  if (ev) {
    return (
      <div className="card install">
        <div><b>Install Air Hockey</b><small>Play fullscreen and offline from your home screen.</small></div>
        <Btn small onClick={async () => { await ev.prompt(); await ev.userChoice; setEv(null) }}>Install</Btn>
      </div>
    )
  }
  if (isIOS()) {
    return <div className="card"><b>Install on iPhone / iPad</b><small>In Safari tap the Share button, then <em>Add to Home Screen</em>.</small></div>
  }
  return <div className="card"><b>Install</b><small>Use your browser's menu: <em>Install app</em> (Chrome / Edge) to add it to your device.</small></div>
}

export function UpdateBanner() {
  const ready = useStore((s) => s.updateReady)
  const apply = useStore((s) => s.applyUpdate)
  const notice = useStore((s) => s.notice)
  const setNotice = useStore((s) => s.setNotice)
  useEffect(() => {
    if (!notice) return
    const t = window.setTimeout(() => setNotice(null), 5000)
    return () => window.clearTimeout(t)
  }, [notice, setNotice])
  return (
    <>
      {ready && (
        <div className="banner">
          <span>A new version is ready.</span>
          <Btn small onClick={() => apply?.()}>Reload</Btn>
        </div>
      )}
      {!ready && notice && <div className="banner" onClick={() => setNotice(null)}><span>{notice}</span></div>}
    </>
  )
}
