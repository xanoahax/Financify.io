import { useCallback, useEffect, useMemo, useState } from 'react'
import { NavLink, Navigate, Route, Routes, useNavigate } from 'react-router-dom'
import { BackgroundLayers } from './components/BackgroundLayers'
import { LoginScreen } from './components/LoginScreen'
import { OnboardingCard } from './components/OnboardingCard'
import { ProfileSwitcher } from './components/ProfileSwitcher'
import { ToastHost } from './components/ToastHost'
import { useDocumentAppearance } from './hooks/useDocumentAppearance'
import { useGuardedBackdropClose } from './hooks/useGuardedBackdropClose'
import { useLockScreenVisuals } from './hooks/useLockScreenVisuals'
import { DashboardPage, type DashboardQuickAction } from './pages/DashboardPage'
import { ExpensesPage } from './pages/ExpensesPage'
import { HouseholdsPage } from './pages/HouseholdsPage'
import { IncomePage } from './pages/IncomePage'
import { SettingsPage } from './pages/SettingsPage'
import { StatsPage } from './pages/StatsPage'
import { SubscriptionsPage } from './pages/SubscriptionsPage'
import { useAppContext } from './state/useAppContext'
import type { OnboardingSetupInput } from './state/AppContext'
import { tx } from './utils/i18n'
import { isGitHubPagesRuntime } from './utils/runtime'
import dashboardIconDark from '../redesign_icons/dashboard_dark.png'
import dashboardIconLight from '../redesign_icons/dashboard_light.png'
import expenseIconDark from '../redesign_icons/expense_dark.png'
import expenseIconLight from '../redesign_icons/expense_light.png'
import houseIconDark from '../redesign_icons/house_dark.png'
import houseIconLight from '../redesign_icons/house_light.png'
import incomeIconDark from '../redesign_icons/income_dark.png'
import incomeIconLight from '../redesign_icons/income_light.png'
import logoutIconDark from '../redesign_icons/logout_dark.png'
import logoutIconLight from '../redesign_icons/logout_light.png'
import logoForLightMode from '../redesign_icons/mainlogo_dark.png'
import logoForDarkMode from '../redesign_icons/mainlogo_light.png'
import statsIconDark from '../redesign_icons/stats_dark.png'
import statsIconLight from '../redesign_icons/stats_light.png'
import subsIconDark from '../redesign_icons/subs_dark.png'
import subsIconLight from '../redesign_icons/subs_light.png'

let startupUpdateCheckTriggered = false
const DESKTOP_RELEASES_URL = 'https://github.com/xanoahax/Financify.io/releases'

interface NavItem {
  to: string
  label: string
  iconDark?: string
  iconLight?: string
  glyph?: string
}

export default function App(): JSX.Element {
  const {
    loading,
    settings,
    setSettings,
    profiles,
    activeProfileId,
    activeProfile,
    isProfileLocked,
    switchProfile,
    createProfile,
    lockActiveProfile,
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
  const [showDesktopDownloadHint, setShowDesktopDownloadHint] = useState(() => isGitHubPagesRuntime())
  const [isSessionLoggedOut, setIsSessionLoggedOut] = useState(true)
  const [unlockSecret, setUnlockSecret] = useState('')
  const [unlockError, setUnlockError] = useState('')
  const [unlocking, setUnlocking] = useState(false)
  const navigate = useNavigate()
  const showLoginScreen = isProfileLocked || isSessionLoggedOut
  const { effectiveSettings, captureCurrentVisualSnapshot, clearCurrentVisualSnapshot } = useLockScreenVisuals({
    settings,
    isProfileLocked: showLoginScreen,
  })
  const language = effectiveSettings.language
  const t = useCallback((de: string, en: string) => tx(language, de, en), [language])
  const shellLogo = settings.theme === 'dark' ? logoForDarkMode : logoForLightMode
  const logoutIcon = settings.theme === 'dark' ? logoutIconLight : logoutIconDark
  const nextTheme = settings.theme === 'dark' ? 'light' : 'dark'
  const applyThemePreview = useCallback((theme: OnboardingSetupInput['theme']) => {
    document.documentElement.dataset.theme = theme
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
      captureCurrentVisualSnapshot()
      resetUnlockState()
      switchProfile(profileId)
    },
    [captureCurrentVisualSnapshot, resetUnlockState, switchProfile],
  )
  const handleLockedProfileSelect = useCallback(
    (profileId: string) => {
      const selectedProfile = profiles.find((profile) => profile.id === profileId)
      resetUnlockState()
      switchProfile(profileId)
      if (selectedProfile?.authMode === 'none') {
        clearCurrentVisualSnapshot()
        setIsSessionLoggedOut(false)
      }
    },
    [clearCurrentVisualSnapshot, profiles, resetUnlockState, switchProfile],
  )
  const handleLockProfile = useCallback(() => {
    captureCurrentVisualSnapshot()
    setIsSessionLoggedOut(true)
    lockActiveProfile()
  }, [captureCurrentVisualSnapshot, lockActiveProfile])

  useEffect(() => {
    resetUnlockState()
    setUnlocking(false)
  }, [activeProfileId, showLoginScreen, resetUnlockState])

  useDocumentAppearance({
    settings: effectiveSettings,
    language,
  })

  const navItems: NavItem[] = [
    { to: '/dashboard', label: t('Übersicht', 'Overview'), iconDark: dashboardIconDark, iconLight: dashboardIconLight },
    { to: '/income', label: t('Einkommen', 'Income'), iconDark: incomeIconDark, iconLight: incomeIconLight },
    { to: '/expenses', label: t('Ausgaben', 'Expenses'), iconDark: expenseIconDark, iconLight: expenseIconLight },
    { to: '/subscriptions', label: t('Abo-Tracker', 'Subscription tracker'), iconDark: subsIconDark, iconLight: subsIconLight },
    { to: '/households', label: t('Haushaltskosten', 'Household costs'), iconDark: houseIconDark, iconLight: houseIconLight },
    { to: '/stats', label: t('Statistiken', 'Statistics'), iconDark: statsIconDark, iconLight: statsIconLight },
  ]

  const selectableProfiles = useMemo(() => {
    const completed = profiles.filter((profile) => profile.onboardingCompleted)
    const base = completed
    if (activeProfileId && !base.some((profile) => profile.id === activeProfileId)) {
      const active = profiles.find((profile) => profile.id === activeProfileId)
      if (active && active.onboardingCompleted) {
        return [...base, active]
      }
    }
    return base
  }, [activeProfileId, profiles])

  useEffect(() => {
    if (!updatesSupported || loading || startupUpdateCheckTriggered) {
      return
    }
    startupUpdateCheckTriggered = true
    void checkForUpdates()
  }, [checkForUpdates, loading, updatesSupported])

  const dashboardQuickActions: DashboardQuickAction[] = useMemo(
    () => [
      {
        id: 'dash-income',
        label: t('Einkommen hinzufügen', 'Add income'),
        iconDark: incomeIconDark,
        iconLight: incomeIconLight,
        run: () => navigate('/income?quickAdd=income'),
      },
      {
        id: 'dash-expense',
        label: t('Ausgabe hinzufügen', 'Add expense'),
        iconDark: expenseIconDark,
        iconLight: expenseIconLight,
        run: () => navigate('/expenses?quickAdd=expense'),
      },
      {
        id: 'dash-subscription',
        label: t('Abo hinzufügen', 'Add subscription'),
        iconDark: subsIconDark,
        iconLight: subsIconLight,
        run: () => navigate('/subscriptions?quickAdd=subscription'),
      },
      {
        id: 'dash-household-cost',
        label: t('Haushaltskosten hinzufügen', 'Add household cost'),
        iconDark: houseIconDark,
        iconLight: houseIconLight,
        run: () => navigate('/households?quickAdd=cost'),
      },
    ],
    [navigate, t],
  )

  async function onUnlockSubmit(event: React.FormEvent): Promise<void> {
    event.preventDefault()
    try {
      setUnlocking(true)
      setUnlockError('')
      await unlockActiveProfile(unlockSecret)
      clearCurrentVisualSnapshot()
      setIsSessionLoggedOut(false)
      setUnlockSecret('')
    } catch (error) {
      setUnlockError(error instanceof Error ? error.message : t('Entsperren fehlgeschlagen.', 'Unlock failed.'))
    } finally {
      setUnlocking(false)
    }
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

  if (needsOnboarding) {
    return (
      <>
        <BackgroundLayers />
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

  if (showLoginScreen) {
    return (
      <>
        <BackgroundLayers />
        <LoginScreen
          profiles={profiles}
          activeProfileId={activeProfileId}
          activeProfile={activeProfile}
          logoSrc={shellLogo}
          language={language}
          unlockSecret={unlockSecret}
          unlockError={unlockError}
          unlocking={unlocking}
          onSelectProfile={handleLockedProfileSelect}
          onCreateProfile={() => createProfile('')}
          onUnlockSecretChange={setUnlockSecret}
          onUnlockSubmit={onUnlockSubmit}
        />
        <ToastHost toasts={toasts} onDismiss={dismissToast} language={language} />
      </>
    )
  }

  return (
    <>
      <BackgroundLayers />

      <div className="app-shell">
        <div className="shell-brand" aria-hidden="true">
          <img className="shell-app-logo" src={shellLogo} alt="" />
        </div>

        <aside className="sidebar" aria-label={t('Hauptnavigation', 'Main navigation')}>
          <nav>
            {navItems.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                title={item.label}
                aria-label={item.label}
                className={({ isActive }) => (isActive ? 'nav-link active' : 'nav-link')}
              >
                {({ isActive }) => {
                  return (
                    <>
                      <span className="nav-icon" aria-hidden="true">
                        {item.iconDark && item.iconLight ? (
                          <img
                            src={
                              settings.theme === 'dark'
                                ? isActive
                                  ? item.iconDark
                                  : item.iconLight
                                : isActive
                                  ? item.iconLight
                                  : item.iconDark
                            }
                            alt=""
                          />
                        ) : (
                          <span className="nav-icon-glyph">{item.glyph}</span>
                        )}
                      </span>
                      <span className="nav-label">{item.label}</span>
                    </>
                  )
                }}
              </NavLink>
            ))}
          </nav>
          <div className="sidebar-footer">
            <button
              type="button"
              className="nav-link nav-link-logout"
              title={t('Abmelden', 'Log out')}
              aria-label={t('Abmelden', 'Log out')}
              onClick={handleLockProfile}
            >
              <span className="nav-icon" aria-hidden="true">
                <img src={logoutIcon} alt="" />
              </span>
              <span className="nav-label">{t('Abmelden', 'Log out')}</span>
            </button>
          </div>
        </aside>

        <div className="content-shell">
          <header className="shell-utility-bar">
            <div className="shell-utility-left" />
            <div className="shell-utility-right">
              <button
                type="button"
                className="topbar-theme-toggle"
                onClick={() => setSettings({ theme: nextTheme })}
                aria-label={settings.theme === 'dark' ? t('Zum hellen Modus wechseln', 'Switch to light mode') : t('Zum dunklen Modus wechseln', 'Switch to dark mode')}
                title={settings.theme === 'dark' ? t('Heller Modus', 'Light mode') : t('Dunkler Modus', 'Dark mode')}
              >
                <span aria-hidden="true">{settings.theme === 'dark' ? '☀' : '☾'}</span>
              </button>
              <ProfileSwitcher
                key={`topbar-profile-switcher-${activeProfileId}`}
                profiles={selectableProfiles}
                activeProfileId={activeProfileId}
                activeProfile={activeProfile}
                language={language}
                onSwitchProfile={handleProfileSwitch}
                onCreateProfile={() => createProfile('')}
                onOpenSettings={() => navigate('/settings')}
                className="topbar-profile-switcher"
                variant="avatar"
              />
            </div>
          </header>

          <main className="content">
            <Routes>
              <Route path="/" element={<Navigate to="/dashboard" replace />} />
              <Route path="/dashboard" element={<DashboardPage quickActions={dashboardQuickActions} />} />
              <Route path="/subscriptions" element={<SubscriptionsPage />} />
              <Route path="/households" element={<HouseholdsPage />} />
              <Route path="/income" element={<IncomePage />} />
              <Route path="/expenses" element={<ExpensesPage />} />
              <Route path="/stats" element={<StatsPage />} />
              <Route path="/settings" element={<SettingsPage />} />
              <Route path="*" element={<Navigate to="/dashboard" replace />} />
            </Routes>
          </main>
        </div>

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
        <ToastHost toasts={toasts} onDismiss={dismissToast} language={language} />
      </div>
    </>
  )
}
