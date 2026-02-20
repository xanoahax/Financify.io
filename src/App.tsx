import { useEffect, useMemo, useState } from 'react'
import { NavLink, Navigate, Route, Routes, useNavigate } from 'react-router-dom'
import { CommandPalette, type PaletteAction } from './components/CommandPalette'
import { QuickAddFab } from './components/QuickAddFab'
import { ToastHost } from './components/ToastHost'
import { DashboardPage } from './pages/DashboardPage'
import { IncomePage } from './pages/IncomePage'
import { InterestPage } from './pages/InterestPage'
import { SettingsPage } from './pages/SettingsPage'
import { StatsPage } from './pages/StatsPage'
import { SubscriptionsPage } from './pages/SubscriptionsPage'
import { useAppContext } from './state/useAppContext'

const navItems = [
  { to: '/dashboard', label: 'Übersicht', icon: '⌂' },
  { to: '/income', label: 'Einkommen', icon: '¤' },
  { to: '/subscriptions', label: 'Abo-Tracker', icon: '↻' },
  { to: '/interest', label: 'Zinsrechner', icon: '%' },
  { to: '/stats', label: 'Statistiken', icon: '▦' },
  { to: '/settings', label: 'Einstellungen', icon: '⚙' },
]

function resolveTheme(theme: 'light' | 'dark' | 'glass' | 'system'): 'light' | 'dark' | 'glass' {
  if (theme !== 'system') {
    return theme
  }
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}

export default function App(): JSX.Element {
  const { loading, settings, backgroundImageDataUrl, uiState, setUiState, toasts, dismissToast } = useAppContext()
  const [paletteOpen, setPaletteOpen] = useState(false)
  const navigate = useNavigate()

  useEffect(() => {
    const effectiveTheme = resolveTheme(settings.theme)
    document.documentElement.dataset.theme = effectiveTheme
    document.documentElement.dataset.gradientOverlay = settings.gradientOverlayEnabled ? 'on' : 'off'
    document.documentElement.dataset.motion = settings.reducedMotion ? 'reduced' : 'full'
    document.documentElement.style.setProperty('--accent', settings.accentColor)
    document.documentElement.style.setProperty('--gradient-a', settings.gradientColorA)
    document.documentElement.style.setProperty('--gradient-b', settings.gradientColorB)
  }, [
    settings.accentColor,
    settings.gradientColorA,
    settings.gradientColorB,
    settings.gradientOverlayEnabled,
    settings.reducedMotion,
    settings.theme,
  ])

  useEffect(() => {
    function onShortcut(event: KeyboardEvent): void {
      const isPaletteShortcut = (event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k'
      if (isPaletteShortcut) {
        event.preventDefault()
        setPaletteOpen((current) => !current)
      }
    }
    window.addEventListener('keydown', onShortcut)
    return () => window.removeEventListener('keydown', onShortcut)
  }, [])

  const paletteActions = useMemo<PaletteAction[]>(
    () => [
      {
        id: 'add-subscription',
        label: 'Abo hinzufügen',
        description: 'Formular öffnen und auf Abo-Name fokussieren',
        run: () => navigate('/subscriptions?quickAdd=1'),
      },
      {
        id: 'add-income',
        label: 'Einkommen hinzufügen',
        description: 'Formular öffnen und auf Betragsfeld fokussieren',
        run: () => navigate('/income?quickAdd=1'),
      },
      { id: 'go-dashboard', label: 'Übersicht öffnen', description: 'Zur Gesamtübersicht springen', run: () => navigate('/dashboard') },
      { id: 'go-subs', label: 'Abo-Tracker öffnen', description: 'Wiederkehrende Kosten verwalten', run: () => navigate('/subscriptions') },
      { id: 'go-income', label: 'Einkommen öffnen', description: 'Einkommenseinträge verwalten', run: () => navigate('/income') },
      { id: 'go-interest', label: 'Zinsrechner öffnen', description: 'Szenarien mit Zinseszins berechnen', run: () => navigate('/interest') },
      { id: 'go-stats', label: 'Statistiken öffnen', description: 'Trends und Cashflow prüfen', run: () => navigate('/stats') },
      { id: 'go-settings', label: 'Einstellungen öffnen', description: 'Präferenzen anpassen', run: () => navigate('/settings') },
      { id: 'toggle-privacy', label: 'Beträge ausblenden', description: 'Privatsphäre-Modus in Einstellungen umschalten', run: () => navigate('/settings') },
    ],
    [navigate],
  )

  const backgroundStyle = useMemo(() => {
    if (!backgroundImageDataUrl) {
      return undefined
    }
    return {
      backgroundImage: `url(${backgroundImageDataUrl})`,
      filter: settings.backgroundImageBlurEnabled ? `blur(${settings.backgroundImageBlurAmount}px)` : 'none',
    }
  }, [backgroundImageDataUrl, settings.backgroundImageBlurAmount, settings.backgroundImageBlurEnabled])

  if (loading) {
    return (
      <main className="loading-shell">
        <article className="card loading-card">
          <h1>financify</h1>
          <p className="muted">Lokale Daten werden geladen...</p>
        </article>
      </main>
    )
  }

  return (
    <>
      <div className="background-gradient-layer" aria-hidden="true" />
      {backgroundImageDataUrl ? <div className="background-image-layer" style={backgroundStyle} aria-hidden="true" /> : null}

      <div className={`app-shell ${uiState.sidebarCollapsed ? 'sidebar-collapsed' : ''}`}>
        <aside className="sidebar">
          <header>
            <strong>financify</strong>
            <button
              type="button"
              className="icon-button"
              onClick={() => setUiState({ sidebarCollapsed: !uiState.sidebarCollapsed })}
              aria-label="Seitenleiste umschalten"
            >
              {uiState.sidebarCollapsed ? '>' : '<'}
            </button>
          </header>
          <nav>
            {navItems.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                title={item.label}
                aria-label={item.label}
                className={({ isActive }) => (isActive ? 'nav-link active' : 'nav-link')}
              >
                <span className="nav-icon" aria-hidden="true">
                  {item.icon}
                </span>
                <span className="nav-label">{item.label}</span>
              </NavLink>
            ))}
          </nav>
        </aside>

        <div className="content-shell">
          <header className="topbar">
            <input
              value={uiState.globalSearch}
              onChange={(event) => setUiState({ globalSearch: event.target.value })}
              placeholder="Globale Suche (Abos und Einkommen)"
              aria-label="Globale Suche"
            />
            <div className="topbar-actions">
              <button type="button" className="button button-secondary" onClick={() => setPaletteOpen(true)}>
                Cmd/Ctrl + K
              </button>
            </div>
          </header>

          <main className="content">
            <Routes>
              <Route path="/" element={<Navigate to="/dashboard" replace />} />
              <Route path="/dashboard" element={<DashboardPage />} />
              <Route path="/subscriptions" element={<SubscriptionsPage />} />
              <Route path="/interest" element={<InterestPage />} />
              <Route path="/income" element={<IncomePage />} />
              <Route path="/stats" element={<StatsPage />} />
              <Route path="/settings" element={<SettingsPage />} />
              <Route path="*" element={<Navigate to="/dashboard" replace />} />
            </Routes>
          </main>
        </div>

        {paletteOpen ? <CommandPalette onClose={() => setPaletteOpen(false)} actions={paletteActions} /> : null}
        <QuickAddFab onAddSubscription={() => navigate('/subscriptions?quickAdd=1')} onAddIncome={() => navigate('/income?quickAdd=1')} />
        <ToastHost toasts={toasts} onDismiss={dismissToast} />
      </div>
    </>
  )
}
