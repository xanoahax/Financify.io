import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { UserProfile } from '../types/models'
import { tx } from '../utils/i18n'
import { ProfileAvatar } from './ProfileAvatar'

interface ProfileSwitcherProps {
  profiles: UserProfile[]
  activeProfileId: string
  activeProfile: UserProfile | null
  language: 'de' | 'en'
  onSwitchProfile: (profileId: string) => void
  onCreateProfile?: () => void
  onLockProfile?: () => void
  onOpenSettings?: () => void
  className?: string
  autoWidth?: boolean
  variant?: 'default' | 'avatar'
}

export function ProfileSwitcher(props: ProfileSwitcherProps): JSX.Element {
  const {
    profiles,
    activeProfileId,
    activeProfile,
    language,
    onSwitchProfile,
    onCreateProfile,
    onLockProfile,
    onOpenSettings,
    className,
    autoWidth = false,
    variant = 'default',
  } = props
  const [menuOpen, setMenuOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement | null>(null)
  const t = useCallback((de: string, en: string) => tx(language, de, en), [language])
  const maxSwitcherWidth = 340
  const minSwitcherWidth = 132

  const switcherWidth = useMemo(() => {
    if (typeof document === 'undefined' || variant === 'avatar') {
      return undefined
    }
    const fallbackName = activeProfile?.onboardingCompleted ? activeProfile.name : t('Neues Profil', 'New profile')
    const names = [fallbackName, t('Profil', 'Profile')].map((name) => name.trim()).filter(Boolean)
    if (names.length === 0) {
      return undefined
    }
    const canvas = document.createElement('canvas')
    const context = canvas.getContext('2d')
    if (!context) {
      return undefined
    }
    const bodyStyle = window.getComputedStyle(document.body)
    context.font = `${bodyStyle.fontWeight} ${bodyStyle.fontSize} ${bodyStyle.fontFamily}`
    const maxTextWidth = names.reduce((max, name) => Math.max(max, context.measureText(name).width), 0)
    const controlChromeWidth = 66
    return Math.min(maxSwitcherWidth, Math.max(minSwitcherWidth, Math.ceil(maxTextWidth + controlChromeWidth)))
  }, [activeProfile, t, variant])

  const hasPendingProfile = useMemo(() => profiles.some((profile) => !profile.onboardingCompleted), [profiles])
  const otherProfiles = useMemo(() => profiles.filter((profile) => profile.id !== activeProfileId), [activeProfileId, profiles])

  useEffect(() => {
    if (!menuOpen) {
      return
    }
    function onDocumentMouseDown(event: MouseEvent): void {
      if (!menuRef.current?.contains(event.target as Node)) {
        setMenuOpen(false)
      }
    }
    function onDocumentKeyDown(event: KeyboardEvent): void {
      if (event.key === 'Escape') {
        setMenuOpen(false)
      }
    }
    window.addEventListener('mousedown', onDocumentMouseDown)
    window.addEventListener('keydown', onDocumentKeyDown)
    return () => {
      window.removeEventListener('mousedown', onDocumentMouseDown)
      window.removeEventListener('keydown', onDocumentKeyDown)
    }
  }, [menuOpen])

  return (
    <div
      className={`profile-switcher ${className ?? ''}`.trim()}
      ref={menuRef}
      style={autoWidth && switcherWidth ? { width: `${switcherWidth}px` } : undefined}
    >
      <button
        type="button"
        className={`profile-switcher-trigger ${variant === 'avatar' ? 'profile-switcher-trigger-avatar' : ''}`.trim()}
        onClick={() => setMenuOpen((current) => !current)}
        aria-label={t('Profil wechseln', 'Switch profile')}
        aria-haspopup="listbox"
        aria-expanded={menuOpen}
        title={activeProfile?.onboardingCompleted ? activeProfile.name : t('Neues Profil', 'New profile')}
      >
        {activeProfile ? (
          activeProfile.onboardingCompleted ? (
            <ProfileAvatar profile={activeProfile} size={variant === 'avatar' ? 44 : 28} />
          ) : (
            <span className="profile-switcher-plus" aria-hidden="true">
              +
            </span>
          )
        ) : null}
        {variant === 'default' ? (
          <>
            <span className="profile-switcher-name">
              {activeProfile?.onboardingCompleted ? activeProfile.name : t('Neues Profil', 'New profile')}
            </span>
            <span className="profile-switcher-caret" aria-hidden="true" />
          </>
        ) : null}
      </button>
      {menuOpen ? (
        <div
          className={`profile-switcher-menu ${variant === 'avatar' ? 'profile-switcher-menu-avatar' : ''}`.trim()}
          role="listbox"
          aria-label={t('Profile', 'Profiles')}
        >
          {variant === 'avatar' && activeProfile ? (
            <div className="profile-switcher-active-profile">
              <ProfileAvatar profile={activeProfile} size={56} />
              <div className="profile-switcher-active-copy">
                <strong>{activeProfile.name}</strong>
              </div>
            </div>
          ) : null}

          {(variant === 'avatar' ? otherProfiles : profiles).map((profile) => {
            const selected = profile.id === activeProfileId
            const isPendingProfile = !profile.onboardingCompleted
            return (
              <button
                key={profile.id}
                type="button"
                className={`profile-switcher-option ${selected ? 'active' : ''}`}
                onClick={() => {
                  setMenuOpen(false)
                  onSwitchProfile(profile.id)
                }}
                aria-selected={selected}
                title={isPendingProfile ? t('Neues Profil', 'New profile') : profile.name}
              >
                {isPendingProfile ? (
                  <span className="profile-switcher-plus" aria-hidden="true">
                    +
                  </span>
                ) : (
                  <ProfileAvatar profile={profile} size={24} />
                )}
                <span className="profile-switcher-option-name">{isPendingProfile ? t('Neues Profil', 'New profile') : profile.name}</span>
              </button>
            )
          })}

          {onCreateProfile && !hasPendingProfile ? (
            <button
              type="button"
              className="profile-switcher-option profile-switcher-option-create"
              onClick={() => {
                setMenuOpen(false)
                onCreateProfile()
              }}
            >
              <span className="profile-switcher-plus" aria-hidden="true">
                +
              </span>
              <span className="profile-switcher-option-name">{t('Neues Profil', 'New profile')}</span>
            </button>
          ) : null}

          {onOpenSettings || onLockProfile ? <div className="profile-switcher-divider" aria-hidden="true" /> : null}

          {onOpenSettings ? (
            <button
              type="button"
              className="profile-switcher-option profile-switcher-option-settings"
              onClick={() => {
                setMenuOpen(false)
                onOpenSettings()
              }}
            >
              <span className="profile-switcher-option-name">{t('Einstellungen', 'Settings')}</span>
            </button>
          ) : null}

          {onLockProfile ? (
            <button
              type="button"
              className="profile-switcher-option profile-switcher-option-logout"
              onClick={() => {
                setMenuOpen(false)
                onLockProfile()
              }}
            >
              <span className="profile-switcher-option-name">{t('Abmelden', 'Log out')}</span>
            </button>
          ) : null}
        </div>
      ) : null}
    </div>
  )
}
