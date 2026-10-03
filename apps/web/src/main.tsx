import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { registerSW } from 'virtual:pwa-register'
import './index.css'
import App from './App.tsx'

// `immediate: true` + `workbox.skipWaiting` en vite.config.ts hacen que, en
// cuanto hay una versión nueva disponible, se active y recargue sola — así
// la PWA instalada nunca se queda viendo un bundle viejo (p. ej. Comprobantes
// y Actividad no navegaban hasta refrescar el service worker a mano).
registerSW({ immediate: true })

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
