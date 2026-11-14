import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import './styles.css'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)

// Offline-Fähigkeit: Service Worker nur in der fertigen (gebauten) App.
if ('serviceWorker' in navigator && import.meta.env.PROD) {
  window.addEventListener('load', async () => {
    try {
      const reg = await navigator.serviceWorker.register('./sw.js')
      await navigator.serviceWorker.ready
      const urls = [location.href, ...performance.getEntriesByType('resource').map((r) => r.name).filter((u) => u.startsWith(location.origin))]
      reg.active?.postMessage({ type: 'CACHE_URLS', urls })
    } catch {
      /* ohne Service Worker läuft die App trotzdem, nur nicht offline */
    }
  })
}
