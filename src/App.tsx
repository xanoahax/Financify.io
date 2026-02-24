import { useCallback, useEffect, useMemo, useState } from 'react'
import { NavLink, Navigate, Route, Routes, useNavigate } from 'react-router-dom'
import { BackgroundLayers } from './components/BackgroundLayers'
import { CommandPalette, type PaletteAction } from './components/CommandPalette'
import { LoginScreen } from './components/LoginScreen'
import { OnboardingCard } from './components/OnboardingCard'
import { ProfileSwitcher } from './components/ProfileSwitcher'
import { QuickAddFab } from './components/QuickAddFab'
import { ToastHost } from './components/ToastHost'
import { useDocumentAppearance } from './hooks/useDocumentAppearance'
import { useGuardedBackdropClose } from './hooks/useGuardedBackdropClose'
import { useLockScreenVisuals } from './hooks/useLockScreenVisuals'
import { DashboardPage } from './pages/DashboardPage'
import { IncomePage } from './pages/IncomePage'
import { SettingsPage } from './pages/SettingsPage'
import { StatsPage } from './pages/StatsPage'
import { SubscriptionsPage } from './pages/SubscriptionsPage'
import { useAppContext } from './state/useAppContext'
import type { OnboardingSetupInput } from './state/AppContext'
import { tx } from './utils/i18n'
import { isGitHubPagesRuntime } from './utils/runtime'
import { resolveTheme } from './utils/theme'

let startupUpdateCheckTriggered = false
const DESKTOP_RELEASES_URL = 'https://github.com/xanoahax/Financify.io/releases'

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
    isProfileLocked,
    switchProfile,
    needsOnboarding,
    canExitOnboarding,
    completeOnboarding,
    exitOnboarding,
    unlockActiveProfile,
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
  const [unlockSecret, setUnlockSecret] = useState('')
  const [unlockError, setUnlockError] = useState('')
  const [unlocking, setUnlocking] = useState(false)
  const navigate = useNavigate()
  const { effectiveSettings, effectiveBackgroundImageDataUrl, captureCurrentVisualSnapshot } = useLockScreenVisuals({
    settings,
    backgroundImageDataUrl,
    isProfileLocked,
  })
  const language = effectiveSettings.language
  const t = (de: string, en: string) => tx(language, de, en)
  const applyThemePreview = useCallback((theme: OnboardingSetupInput['theme']) => {
    document.documentElement.dataset.theme = resolveTheme(theme)
  }, [])
  const closeDesktopDownloadHint = useCallback(() => setShowDesktopDownloadHint(false), [])
  const desktopDownloadHintBackdropCloseGuard = useGuardedBackdropClose(closeDesktopDownloadHint)
  const updatePromptBackdropCloseGuard = useGuardedBackdropClose(dismissUpdatePrompt)
  const resetUnlockState = useCallback(() => {
    setUnlockSecret('')
    setUnlockError('')
  }, [])
  const handleProfileSwitch = useCallback(
    (profileId: string) => {
      // Keep login visuals on the profile we switch away from.
      captureCurrentVisualSnapshot()
      resetUnlockState()
      switchProfile(profileId)
    },
    [captureCurrentVisualSnapshot, resetUnlockState, switchProfile],
  )
  const handleLockedProfileSelect = useCallback(
    (profileId: string) => {
      // While locked, keep the existing login visual snapshot untouched.
      resetUnlockState()
      switchProfile(profileId)
    },
    [resetUnlockState, switchProfile],
  )

  useEffect(() => {
    resetUnlockState()
    setUnlocking(false)
  }, [activeProfileId, isProfileLocked, resetUnlockState])

  useDocumentAppearance({
    settings: effectiveSettings,
    language,
  })

  const navItems = [
    { to: '/dashboard', label: t('\u00dcbersicht', 'Overview'), icon: '\u2302' },
    { to: '/income', label: t('Einkommen', 'Income'), icon: '\u20ac' },
    { to: '/subscriptions', label: t('Abo-Tracker', 'Subscription Tracker'), icon: '\u21bb' },
    { to: '/stats', label: t('Statistiken', 'Statistics'), icon: '\u2197' },
    { to: '/settings', label: t('Einstellungen', 'Settings'), icon: '\u2699', isSettings: true },
  ]
  const selectableProfiles = useMemo(() => {
    const completed = profiles.filter((profile) => profile.onboardingCompleted)
    const pending = profiles.filter((profile) => !profile.onboardingCompleted)
    const base = pending.length > 0 ? [...completed, pending[pending.length - 1]] : completed
    if (activeProfileId && !base.some((profile) => profile.id === activeProfileId)) {
      const active = profiles.find((profile) => profile.id === activeProfileId)
      if (active) {
        return [...base, active]
      }
    }
    return base
  }, [activeProfileId, profiles])
  useEffect(() => {
    function onShortcut(event: KeyboardEvent): void {
      if (isProfileLocked) {
        return
      }
      const isPaletteShortcut = (event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k'
      if (isPaletteShortcut) {
        event.preventDefault()
        setPaletteOpen((current) => !current)
      }
    }
    window.addEventListener('keydown', onShortcut)
    return () => window.removeEventListener('keydown', onShortcut)
  }, [isProfileLocked])

  useEffect(() => {
    if (isProfileLocked) {
      setPaletteOpen(false)
    }
  }, [isProfileLocked])

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
    { id: 'go-stats', label: t('Statistiken öffnen', 'Open statistics'), description: t('Trends und Cashflow prüfen', 'Review trends and cashflow'), run: () => navigate('/stats') },
    { id: 'go-settings', label: t('Einstellungen öffnen', 'Open settings'), description: t('Präferenzen anpassen', 'Adjust preferences'), run: () => navigate('/settings') },
    { id: 'toggle-privacy', label: t('Beträge ausblenden', 'Hide amounts'), description: t('Privatsphäre-Modus in Einstellungen umschalten', 'Toggle privacy mode in settings'), run: () => navigate('/settings') },
  ]

  const backgroundStyle = useMemo(() => {
    if (!effectiveBackgroundImageDataUrl) {
      return undefined
    }
    return {
      backgroundImage: `url(${effectiveBackgroundImageDataUrl})`,
      filter: effectiveSettings.backgroundImageBlurEnabled ? `blur(${effectiveSettings.backgroundImageBlurAmount}px)` : 'none',
    }
  }, [
    effectiveBackgroundImageDataUrl,
    effectiveSettings.backgroundImageBlurAmount,
    effectiveSettings.backgroundImageBlurEnabled,
  ])

  async function onUnlockSubmit(event: React.FormEvent): Promise<void> {
    event.preventDefault()
    try {
      setUnlocking(true)
      setUnlockError('')
      await unlockActiveProfile(unlockSecret)
      setUnlockSecret('')
    } catch (error) {
      setUnlockError(error instanceof Error ? error.message : t('Entsperren fehlgeschlagen.', 'Unlock failed.'))
    } finally {
      setUnlocking(false)
    }
  }

  if (needsOnboarding) {
    return (
      <>
        <BackgroundLayers imageStyle={backgroundStyle} />
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
            onThemePreviewChange={applyThemePreview}
          />
        </main>
        <ToastHost toasts={toasts} onDismiss={dismissToast} language={language} />
      </>
    )
  }

  if (isProfileLocked) {
    return (
      <>
        <BackgroundLayers imageStyle={backgroundStyle} />
        <LoginScreen
          profiles={profiles}
          activeProfileId={activeProfileId}
          activeProfile={activeProfile}
          language={language}
          unlockSecret={unlockSecret}
          unlockError={unlockError}
          unlocking={unlocking}
          onSelectProfile={handleLockedProfileSelect}
          onUnlockSecretChange={setUnlockSecret}
          onUnlockSubmit={onUnlockSubmit}
        />
        <ToastHost toasts={toasts} onDismiss={dismissToast} language={language} />
      </>
    )
  }

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
      <BackgroundLayers imageStyle={backgroundStyle} />

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
                className={({ isActive }) => {
                  const classes = ['nav-link']
                  if (isActive) {
                    classes.push('active')
                  }
                  if (item.isSettings) {
                    classes.push('settings-nav-link')
                  }
                  return classes.join(' ')
                }}
              >
                <span className="nav-icon" aria-hidden="true">
                  {item.icon}
                </span>
                <span className="nav-label">{item.label}</span>
              </NavLink>
            ))}
          </nav>
          <div className="sidebar-footer">
            <ProfileSwitcher
              profiles={selectableProfiles}
              activeProfileId={activeProfileId}
              activeProfile={activeProfile}
              language={language}
              onSwitchProfile={handleProfileSwitch}
              className="sidebar-profile-switcher"
              autoWidth={false}
            />
            <NavLink
              to="/settings"
              title={t('Einstellungen', 'Settings')}
              aria-label={t('Einstellungen', 'Settings')}
              className={({ isActive }) => (isActive ? 'nav-link sidebar-settings-link active' : 'nav-link sidebar-settings-link')}
            >
              <span className="nav-icon" aria-hidden="true">
                ⚙
              </span>
              <span className="nav-label">{t('Einstellungen', 'Settings')}</span>
            </NavLink>
          </div>
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
              <ProfileSwitcher
                profiles={selectableProfiles}
                activeProfileId={activeProfileId}
                activeProfile={activeProfile}
                language={language}
                onSwitchProfile={handleProfileSwitch}
                className="topbar-profile-switcher"
                autoWidth
              />
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
              <Route path="/income" element={<IncomePage />} />
              <Route path="/stats" element={<StatsPage />} />
              <Route path="/settings" element={<SettingsPage />} />
              <Route path="*" element={<Navigate to="/dashboard" replace />} />
            </Routes>
          </main>
        </div>

        {paletteOpen ? <CommandPalette onClose={() => setPaletteOpen(false)} actions={paletteActions} language={language} /> : null}
        {showDesktopDownloadHint ? (
          <div
            className="form-modal-backdrop"
            onMouseDown={desktopDownloadHintBackdropCloseGuard.onBackdropMouseDown}
            onClick={desktopDownloadHintBackdropCloseGuard.onBackdropClick}
            role="presentation"
          >
            <article
              className="card form-modal confirm-modal update-modal"
              onMouseDownCapture={desktopDownloadHintBackdropCloseGuard.onModalMouseDownCapture}
              onClick={(event) => event.stopPropagation()}
            >
              <header className="section-header">
                <h2>{t('Desktop-App verfügbar', 'Desktop app available')}</h2>
                <button
                  type="button"
                  className="icon-button"
                  onClick={closeDesktopDownloadHint}
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
                <button type="button" className="button button-secondary" onClick={closeDesktopDownloadHint}>
                  {t('Im Browser fortfahren', 'Continue in browser')}
                </button>
              </div>
            </article>
          </div>
        ) : null}
        {updatePrompt ? (
          <div
            className="form-modal-backdrop"
            onMouseDown={updatePromptBackdropCloseGuard.onBackdropMouseDown}
            onClick={updatePromptBackdropCloseGuard.onBackdropClick}
            role="presentation"
          >
            <article
              className="card form-modal confirm-modal update-modal"
              onMouseDownCapture={updatePromptBackdropCloseGuard.onModalMouseDownCapture}
              onClick={(event) => event.stopPropagation()}
            >
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




