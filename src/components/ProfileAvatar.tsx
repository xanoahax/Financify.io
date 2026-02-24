import type { UserProfile } from '../types/models'

function profileInitials(name: string): string {
  const cleaned = name
    .trim()
    .split(/\s+/)
    .filter(Boolean)
  if (cleaned.length === 0) {
    return 'U'
  }
  const first = cleaned[0]?.[0] ?? ''
  const second = cleaned.length > 1 ? cleaned[1]?.[0] ?? '' : ''
  return `${first}${second}`.toUpperCase()
}

export function ProfileAvatar({ profile, size = 72 }: { profile: UserProfile; size?: number }): JSX.Element {
  const initials = profileInitials(profile.name)
  return (
    <span className="profile-avatar" style={{ width: `${size}px`, height: `${size}px` }} aria-hidden="true">
      {profile.avatarDataUrl ? <img src={profile.avatarDataUrl} alt="" /> : <span>{initials}</span>}
    </span>
  )
}

