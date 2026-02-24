import { useEffect, useMemo, useRef, useState } from 'react'
import type { UserProfile } from '../types/models'
import { tx } from '../utils/i18n'
import { ProfileAvatar } from './ProfileAvatar'

interface ProfileSwitcherProps {
  profiles: UserProfile[]
  activeProfileId: string
  activeProfile: UserProfile | null
  language: 'de' | 'en'
  onSwitchProfile: (profileId: string) => void
  className?: string
  autoWidth?: boolean
}

export function ProfileSwitcher(props: ProfileSwitcherProps): JSX.Element {
  const { profiles, activeProfileId, activeProfile, language, onSwitchProfile, className, autoWidth = false } = props
  const [menuOpen, setMenuOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement | null>(null)
  const t = (de: string, en: string) => tx(language, de, en)

  const switcherWidth = useMemo(() => {
    if (typeof document === 'undefined') {
      return undefined
    }
    const displayNames = profiles.map((profile) =>
      profile.onboardingCompleted ? profile.name : t('Neues Profil', 'New profile'),
    )
    const fallbackName = activeProfile?.onboardingCompleted ? activeProfile.name : t('Neues Profil', 'New profile')
    const names = [...displayNames, fallbackName, t('Profil', 'Profile')].map((name) => name.trim()).filter(Boolean)
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
    return Math.ceil(maxTextWidth + controlChromeWidth)
  }, [activeProfile, profiles, t])

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

  useEffect(() => {
    setMenuOpen(false)
  }, [activeProfileId])

  return (
    <div
      className={`profile-switcher ${className ?? ''}`.trim()}
      ref={menuRef}
      style={autoWidth && switcherWidth ? { width: `${switcherWidth}px` } : undefined}
    >
      <button
        type="button"
        className="profile-switcher-trigger"
        onClick={() => setMenuOpen((current) => !current)}
        aria-label={t('Profil wechseln', 'Switch profile')}
        aria-haspopup="listbox"
        aria-expanded={menuOpen}
      >
        {activeProfile ? (
          activeProfile.onboardingCompleted ? (
            <ProfileAvatar profile={activeProfile} size={28} />
          ) : (
            <span className="profile-switcher-plus" aria-hidden="true">
              +
            </span>
          )
        ) : null}
        <span className="profile-switcher-name">
          {activeProfile?.onboardingCompleted ? activeProfile.name : t('Neues Profil', 'New profile')}
        </span>
        <span className="profile-switcher-caret" aria-hidden="true">
          ▾
        </span>
      </button>
      {menuOpen ? (
        <div className="profile-switcher-menu" role="listbox" aria-label={t('Profile', 'Profiles')}>
          {profiles.map((profile) => {
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
        </div>
      ) : null}
    </div>
  )
}

