import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react'
import type { UserProfile } from '../types/models'
import { tx } from '../utils/i18n'
import { ProfileAvatar } from './ProfileAvatar'

interface LoginScreenProps {
  profiles: UserProfile[]
  activeProfileId: string
  activeProfile: UserProfile | null
  language: 'de' | 'en'
  unlockSecret: string
  unlockError: string
  unlocking: boolean
  onSelectProfile: (profileId: string) => void
  onUnlockSecretChange: (value: string) => void
  onUnlockSubmit: (event: FormEvent) => Promise<void>
}

export function LoginScreen(props: LoginScreenProps): JSX.Element {
  const {
    profiles,
    activeProfileId,
    activeProfile,
    language,
    unlockSecret,
    unlockError,
    unlocking,
    onSelectProfile,
    onUnlockSecretChange,
    onUnlockSubmit,
  } = props
  const [hasSelectedProfile, setHasSelectedProfile] = useState(false)
  const unlockInputRef = useRef<HTMLInputElement | null>(null)
  const t = (de: string, en: string) => tx(language, de, en)
  const hasUnlockInput = unlockSecret.trim().length > 0
  const completedProfiles = useMemo(() => profiles.filter((profile) => profile.onboardingCompleted), [profiles])
  const pendingProfiles = useMemo(() => profiles.filter((profile) => !profile.onboardingCompleted), [profiles])
  const pendingProfile = useMemo(() => {
    if (pendingProfiles.length === 0) {
      return null
    }
    return pendingProfiles[pendingProfiles.length - 1]
  }, [pendingProfiles])

  useEffect(() => {
    if (!hasSelectedProfile) {
      return
    }
    unlockInputRef.current?.focus()
  }, [activeProfileId, hasSelectedProfile])

  return (
    <main className="auth-shell auth-shell-clean login-shell-bottom">
      <article className="auth-clean">
        <header className="auth-clean-header">
          <h1>{t('Anmeldung', 'Sign in')}</h1>
        </header>

        <div className="login-profiles-stack">
          <div className="login-profile-strip" role="listbox" aria-label={t('Profile', 'Profiles')}>
            {completedProfiles.map((profile) => {
              const selected = profile.id === activeProfileId
              return (
                <button
                  key={profile.id}
                  type="button"
                  className={`login-profile-pill ${selected ? 'active' : ''}`}
                  onClick={() => {
                    setHasSelectedProfile(true)
                    onSelectProfile(profile.id)
                  }}
                  aria-selected={selected}
                >
                  <ProfileAvatar profile={profile} size={86} />
                  <strong>{profile.name}</strong>
                </button>
              )
            })}
          </div>
        </div>

        {hasSelectedProfile ? (
          <form key={activeProfileId} onSubmit={(event) => void onUnlockSubmit(event)} className="auth-form-clean auth-form-reveal">
            <label className="auth-secret-label">
              <span className={`auth-secret-row ${hasUnlockInput ? 'has-action' : ''}`}>
                <input
                  ref={unlockInputRef}
                  type="password"
                  inputMode={activeProfile?.authMode === 'pin' ? 'numeric' : 'text'}
                  autoComplete="current-password"
                  aria-label={activeProfile?.authMode === 'pin' ? t('PIN eingeben', 'Enter PIN') : t('Passwort eingeben', 'Enter password')}
                  value={unlockSecret}
                  onChange={(event) => onUnlockSecretChange(event.target.value)}
                />
                {hasUnlockInput ? (
                  <button
                    type="submit"
                    className="auth-unlock-icon-button"
                    disabled={unlocking}
                    aria-label={unlocking ? t('Prüft...', 'Checking...') : t('Entsperren', 'Unlock')}
                    title={unlocking ? t('Prüft...', 'Checking...') : t('Entsperren', 'Unlock')}
                  >
                    {unlocking ? '…' : '🔓'}
                  </button>
                ) : null}
              </span>
            </label>
            {unlockError ? <p className="error-text">{unlockError}</p> : null}
          </form>
        ) : null}

      </article>
      {pendingProfile ? (
        <div className="login-profile-create-row" role="listbox" aria-label={t('Profile setup', 'Profile setup')}>
          <button
            key={pendingProfile.id}
            type="button"
            className={`login-profile-pill login-profile-create ${pendingProfile.id === activeProfileId ? 'active' : ''}`}
            onClick={() => {
              setHasSelectedProfile(true)
              onSelectProfile(pendingProfile.id)
            }}
            aria-selected={pendingProfile.id === activeProfileId}
          >
            <span className="login-plus-avatar" aria-hidden="true">
              +
            </span>
            <strong>{t('Neues Profil', 'New profile')}</strong>
          </button>
        </div>
      ) : null}
    </main>
  )
}
