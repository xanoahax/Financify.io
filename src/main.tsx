import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter, HashRouter } from 'react-router-dom'
import App from './App'
import { AppProvider } from './state/AppContext'
import './index.css'

const isTauriRuntime = typeof window !== 'undefined' && typeof (window as Window & { __TAURI_INTERNALS__?: unknown }).__TAURI_INTERNALS__ !== 'undefined'
const webBasename = import.meta.env.BASE_URL === './' ? '/' : import.meta.env.BASE_URL

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    {isTauriRuntime ? (
      <HashRouter>
        <AppProvider>
          <App />
        </AppProvider>
      </HashRouter>
    ) : (
      <BrowserRouter basename={webBasename}>
        <AppProvider>
          <App />
        </AppProvider>
      </BrowserRouter>
    )}
  </StrictMode>,
)
