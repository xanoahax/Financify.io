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
import { tx } from './utils/i18n'

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
  const language = settings.language
  const t = (de: string, en: string) => tx(language, de, en)

  const navItems = [
    { to: '/dashboard', label: t('Übersicht', 'Overview'), icon: '⌂' },
    { to: '/income', label: t('Einkommen', 'Income'), icon: '¤' },
    { to: '/subscriptions', label: t('Abo-Tracker', 'Subscription Tracker'), icon: '↻' },
    { to: '/interest', label: t('Zinsrechner', 'Interest Calculator'), icon: '%' },
    { to: '/stats', label: t('Statistiken', 'Statistics'), icon: '▦' },
    { to: '/settings', label: t('Einstellungen', 'Settings'), icon: '⚙' },
  ]

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

  const paletteActions: PaletteAction[] = [
    {
      id: 'add-subscription',
      label: t('Abo hinzufügen', 'Add subscription'),
      description: t('Formular öffnen und auf Abo-Name fokussieren', 'Open form and focus subscription name'),
      run: () => navigate('/subscriptions?quickAdd=1'),
    },
    {
      id: 'add-income',
      label: t('Einkommen hinzufügen', 'Add income'),
      description: t('Formular öffnen und auf Betragsfeld fokussieren', 'Open form and focus amount field'),
      run: () => navigate('/income?quickAdd=1'),
    },
    { id: 'go-dashboard', label: t('Übersicht öffnen', 'Open overview'), description: t('Zur Gesamtübersicht springen', 'Jump to overall overview'), run: () => navigate('/dashboard') },
    { id: 'go-subs', label: t('Abo-Tracker öffnen', 'Open subscription tracker'), description: t('Wiederkehrende Kosten verwalten', 'Manage recurring costs'), run: () => navigate('/subscriptions') },
    { id: 'go-income', label: t('Einkommen öffnen', 'Open income'), description: t('Einkommenseinträge verwalten', 'Manage income entries'), run: () => navigate('/income') },
    { id: 'go-interest', label: t('Zinsrechner öffnen', 'Open interest calculator'), description: t('Szenarien mit Zinseszins berechnen', 'Calculate compound interest scenarios'), run: () => navigate('/interest') },
    { id: 'go-stats', label: t('Statistiken öffnen', 'Open statistics'), description: t('Trends und Cashflow prüfen', 'Review trends and cashflow'), run: () => navigate('/stats') },
    { id: 'go-settings', label: t('Einstellungen öffnen', 'Open settings'), description: t('Präferenzen anpassen', 'Adjust preferences'), run: () => navigate('/settings') },
    { id: 'toggle-privacy', label: t('Beträge ausblenden', 'Hide amounts'), description: t('Privatsphäre-Modus in Einstellungen umschalten', 'Toggle privacy mode in settings'), run: () => navigate('/settings') },
  ]

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
          <p className="muted">{t('Lokale Daten werden geladen...', 'Loading local data...')}</p>
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
              aria-label={t('Seitenleiste umschalten', 'Toggle sidebar')}
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
              placeholder={t('Globale Suche (Abos und Einkommen)', 'Global search (subscriptions and income)')}
              aria-label={t('Globale Suche', 'Global search')}
            />
            <div className="topbar-actions">
              <button type="button" className="button button-secondary" onClick={() => setPaletteOpen(true)}>
                {t('Cmd/Ctrl + K', 'Cmd/Ctrl + K')}
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

        {paletteOpen ? <CommandPalette onClose={() => setPaletteOpen(false)} actions={paletteActions} language={language} /> : null}
        <QuickAddFab
          onAddSubscription={() => navigate('/subscriptions?quickAdd=1')}
          onAddIncome={() => navigate('/income?quickAdd=1')}
          language={language}
        />
        <ToastHost toasts={toasts} onDismiss={dismissToast} language={language} />
      </div>
    </>
  )
}
