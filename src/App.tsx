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
import type { OnboardingSetupInput } from './state/AppContext'
import { tx } from './utils/i18n'
import { isGitHubPagesRuntime } from './utils/runtime'

let startupUpdateCheckTriggered = false
const DESKTOP_RELEASES_URL = 'https://github.com/xanoahax/Financify.io/releases'

function resolveTheme(theme: 'light' | 'dark' | 'glass' | 'system'): 'light' | 'dark' | 'glass' {
  if (theme !== 'system') {
    return theme
  }
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}

function OnboardingCard(props: {
  profileName: string
  defaults: Pick<OnboardingSetupInput, 'language' | 'theme' | 'currency' | 'dateFormat'>
  onFinish: (payload: OnboardingSetupInput) => Promise<void>
  canExit: boolean
  onExit: () => void
}): JSX.Element {
  const [profileName, setProfileName] = useState(props.profileName)
  const [language, setLanguage] = useState(props.defaults.language)
  const [theme, setTheme] = useState(props.defaults.theme)
  const [currency, setCurrency] = useState(props.defaults.currency)
  const [dateFormat, setDateFormat] = useState(props.defaults.dateFormat)
  const [authMode, setAuthMode] = useState<OnboardingSetupInput['authMode']>('none')
  const [authSecret, setAuthSecret] = useState('')
  const [authSecretConfirm, setAuthSecretConfirm] = useState('')
  const [jobName, setJobName] = useState('')
  const [jobRate, setJobRate] = useState('18')
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  async function submit(): Promise<void> {
    if (authMode !== 'none' && authSecret !== authSecretConfirm) {
      setError(tx(language, 'PIN/Passwort stimmt nicht überein.', 'PIN/password does not match.'))
      return
    }
    setError('')
    setSubmitting(true)
    try {
      await props.onFinish({
        profileName,
        language,
        theme,
        currency,
        dateFormat,
        authMode,
        authSecret: authMode === 'none' ? undefined : authSecret,
        jobName,
        jobHourlyRate: Number(jobRate),
      })
    } catch (err) {
      setError(err instanceof Error ? err.message : tx(language, 'Einrichtung fehlgeschlagen.', 'Setup failed.'))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <article className="card onboarding-card">
      <header className="section-header">
        <h1>{tx(language, 'Einrichtung', 'Setup')}</h1>
        <p className="muted">{tx(language, `Profil: ${profileName || props.profileName}`, `Profile: ${profileName || props.profileName}`)}</p>
      </header>
      <div className="setting-list">
        <label>
          {tx(language, 'Profilname', 'Profile name')}
          <input value={profileName} onChange={(event) => setProfileName(event.target.value)} placeholder={tx(language, 'z. B. Noah', 'e.g. Noah')} />
        </label>
        <label>
          {tx(language, 'Sprache', 'Language')}
          <select value={language} onChange={(event) => setLanguage(event.target.value as typeof language)}>
            <option value="de">Deutsch</option>
            <option value="en">English</option>
          </select>
        </label>
        <label>
          {tx(language, 'Thema', 'Theme')}
          <select value={theme} onChange={(event) => setTheme(event.target.value as typeof theme)}>
            <option value="light">{tx(language, 'Hell', 'Light')}</option>
            <option value="dark">{tx(language, 'Dunkel', 'Dark')}</option>
            <option value="glass">{tx(language, 'Glas', 'Glass')}</option>
            <option value="system">{tx(language, 'System', 'System')}</option>
          </select>
        </label>
        <label>
          {tx(language, 'Währung', 'Currency')}
          <select value={currency} onChange={(event) => setCurrency(event.target.value as typeof currency)}>
            <option value="EUR">EUR (€)</option>
            <option value="USD">USD ($)</option>
          </select>
        </label>
        <label>
          {tx(language, 'Datumsformat', 'Date format')}
          <select value={dateFormat} onChange={(event) => setDateFormat(event.target.value as typeof dateFormat)}>
            <option value="DD.MM.YYYY">DD.MM.YYYY</option>
            <option value="MM/DD/YYYY">MM/DD/YYYY</option>
            <option value="YYYY-MM-DD">YYYY-MM-DD</option>
          </select>
        </label>
        <label>
          {tx(language, 'Profilschutz', 'Profile protection')}
          <select value={authMode} onChange={(event) => setAuthMode(event.target.value as OnboardingSetupInput['authMode'])}>
            <option value="none">{tx(language, 'Kein Schutz', 'No protection')}</option>
            <option value="pin">{tx(language, 'PIN', 'PIN')}</option>
            <option value="password">{tx(language, 'Passwort', 'Password')}</option>
          </select>
        </label>
        {authMode !== 'none' ? (
          <>
            <label>
              {authMode === 'pin' ? tx(language, 'PIN', 'PIN') : tx(language, 'Passwort', 'Password')}
              <input
                type={authMode === 'pin' ? 'password' : 'password'}
                inputMode={authMode === 'pin' ? 'numeric' : 'text'}
                value={authSecret}
                onChange={(event) => setAuthSecret(event.target.value)}
                placeholder={authMode === 'pin' ? tx(language, '4-8 Ziffern', '4-8 digits') : tx(language, 'mind. 6 Zeichen', 'min. 6 characters')}
              />
            </label>
            <label>
              {tx(language, 'Bestätigen', 'Confirm')}
              <input
                type="password"
                inputMode={authMode === 'pin' ? 'numeric' : 'text'}
                value={authSecretConfirm}
                onChange={(event) => setAuthSecretConfirm(event.target.value)}
                placeholder={tx(language, 'Erneut eingeben', 'Enter again')}
              />
            </label>
          </>
        ) : null}
        <label>
          {tx(language, 'Job (optional)', 'Job (optional)')}
          <input value={jobName} onChange={(event) => setJobName(event.target.value)} placeholder={tx(language, 'z. B. FoodAffairs', 'e.g. FoodAffairs')} />
        </label>
        <label>
          {tx(language, 'Stundensatz (optional)', 'Hourly rate (optional)')}
          <input type="number" min={0.01} step="0.01" value={jobRate} onChange={(event) => setJobRate(event.target.value)} />
        </label>
      </div>
      {error ? <p className="error-text">{error}</p> : null}
      <div className="form-actions">
        {props.canExit ? (
          <button type="button" className="button button-secondary" onClick={props.onExit} disabled={submitting}>
            {tx(language, 'Einrichtung verlassen', 'Leave setup')}
          </button>
        ) : null}
        <button
          type="button"
          className="button button-primary"
          onClick={() => void submit()}
          disabled={submitting}
        >
          {submitting ? tx(language, 'Speichert...', 'Saving...') : tx(language, 'Einrichtung abschließen', 'Finish setup')}
        </button>
      </div>
    </article>
  )
}

export default function App(): JSX.Element {
  const {
    loading,
    settings,
    backgroundImageDataUrl,
    uiState,
    setUiState,
    profiles,
    activeProfileId,
    activeProfile,
    switchProfile,
    needsOnboarding,
    canExitOnboarding,
    completeOnboarding,
    exitOnboarding,
    toasts,
    dismissToast,
    updatesSupported,
    checkForUpdates,
    updatePrompt,
    installUpdate,
    skipUpdateVersion,
    dismissUpdatePrompt,
    isInstallingUpdate,
    updateCheckError,
  } = useAppContext()
  const [paletteOpen, setPaletteOpen] = useState(false)
  const [showDesktopDownloadHint, setShowDesktopDownloadHint] = useState(() => isGitHubPagesRuntime())
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
    document.documentElement.lang = language
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
    language,
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

  useEffect(() => {
    if (!updatesSupported || loading || startupUpdateCheckTriggered) {
      return
    }
    startupUpdateCheckTriggered = true
    void checkForUpdates()
  }, [checkForUpdates, loading, updatesSupported])

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

  if (needsOnboarding) {
    return (
      <>
        <div className="background-gradient-layer" aria-hidden="true" />
        {backgroundImageDataUrl ? <div className="background-image-layer" style={backgroundStyle} aria-hidden="true" /> : null}
        <main className="loading-shell">
          <OnboardingCard
            key={activeProfileId}
            profileName={activeProfile?.name ?? 'User'}
            defaults={{
              language: settings.language,
              theme: settings.theme,
              currency: settings.currency,
              dateFormat: settings.dateFormat,
            }}
            onFinish={completeOnboarding}
            canExit={canExitOnboarding}
            onExit={exitOnboarding}
          />
        </main>
        <ToastHost toasts={toasts} onDismiss={dismissToast} language={language} />
      </>
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
              <select
                value={activeProfileId}
                onChange={(event) => switchProfile(event.target.value)}
                aria-label={t('Profil wechseln', 'Switch profile')}
              >
                {profiles.map((profile) => (
                  <option key={profile.id} value={profile.id}>
                    {profile.name}
                  </option>
                ))}
              </select>
              <button type="button" className="button button-secondary palette-launcher" onClick={() => setPaletteOpen(true)}>
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
        {showDesktopDownloadHint ? (
          <div className="form-modal-backdrop" onClick={() => setShowDesktopDownloadHint(false)} role="presentation">
            <article className="card form-modal confirm-modal update-modal" onClick={(event) => event.stopPropagation()}>
              <header className="section-header">
                <h2>{t('Desktop-App verfügbar', 'Desktop app available')}</h2>
                <button
                  type="button"
                  className="icon-button"
                  onClick={() => setShowDesktopDownloadHint(false)}
                  aria-label={t('Popup schließen', 'Close popup')}
                >
                  ×
                </button>
              </header>
              <p>
                {t(
                  'Du nutzt financify gerade über GitHub Pages. Für lokale Langzeitspeicherung und integrierte Updates empfehlen wir die Desktop-App.',
                  'You are currently using financify on GitHub Pages. For long-term local storage and built-in updates, we recommend the desktop app.',
                )}
              </p>
              <div className="form-actions update-modal-actions">
                <a href={DESKTOP_RELEASES_URL} target="_blank" rel="noreferrer" className="button button-primary">
                  {t('Download', 'Download')}
                </a>
                <button type="button" className="button button-secondary" onClick={() => setShowDesktopDownloadHint(false)}>
                  {t('Im Browser fortfahren', 'Continue in browser')}
                </button>
              </div>
            </article>
          </div>
        ) : null}
        {updatePrompt ? (
          <div className="form-modal-backdrop" onClick={dismissUpdatePrompt} role="presentation">
            <article className="card form-modal confirm-modal update-modal" onClick={(event) => event.stopPropagation()}>
              <header className="section-header">
                <h2>{t('Update verfügbar', 'Update available')}</h2>
                <button
                  type="button"
                  className="icon-button"
                  onClick={dismissUpdatePrompt}
                  aria-label={t('Popup schließen', 'Close popup')}
                  disabled={isInstallingUpdate}
                >
                  ×
                </button>
              </header>
              <p>
                {t(
                  `Version ${updatePrompt.version} ist verfügbar (aktuell ${updatePrompt.currentVersion}).`,
                  `Version ${updatePrompt.version} is available (current ${updatePrompt.currentVersion}).`,
                )}
              </p>
              {updatePrompt.body ? <pre className="update-modal-notes">{updatePrompt.body}</pre> : null}
              {updateCheckError ? <p className="error-text">{updateCheckError}</p> : null}
              <div className="form-actions update-modal-actions">
                <button type="button" className="button button-primary" onClick={() => void installUpdate()} disabled={isInstallingUpdate}>
                  {isInstallingUpdate ? t('Installiert...', 'Installing...') : t('Installieren', 'Install')}
                </button>
                <button type="button" className="button button-secondary" onClick={skipUpdateVersion} disabled={isInstallingUpdate}>
                  {t('Diese Version überspringen', 'Skip this version')}
                </button>
                <button type="button" className="button button-tertiary" onClick={dismissUpdatePrompt} disabled={isInstallingUpdate}>
                  {t('Jetzt ignorieren', 'Ignore for now')}
                </button>
              </div>
            </article>
          </div>
        ) : null}
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
