import { createRoot } from 'react-dom/client'
import { registerSW } from 'virtual:pwa-register'
import '@fontsource/chakra-petch/400.css'
import '@fontsource/chakra-petch/600.css'
import '@fontsource/chakra-petch/700.css'
import './index.css'
import App from './App'
import { InstallEvent, useStore } from './store'

createRoot(document.getElementById('root')!).render(<App />)

// PWA: offline caching + "new version available" prompt
const updateSW = registerSW({
  onNeedRefresh() { useStore.getState().setUpdate(() => { void updateSW(true) }) },
  onOfflineReady() { useStore.getState().setNotice('Ready to play offline.') },
})

// PWA: capture the install prompt so the menu can offer an Install button
window.addEventListener('beforeinstallprompt', (e) => { e.preventDefault(); useStore.getState().setInstallEvent(e as InstallEvent) })
window.addEventListener('appinstalled', () => useStore.getState().setInstallEvent(null))
