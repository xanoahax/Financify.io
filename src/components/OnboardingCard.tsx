import { useEffect, useState } from 'react'
import type { OnboardingSetupInput } from '../state/AppContext'
import { todayString } from '../utils/date'
import { tx } from '../utils/i18n'

interface OnboardingCardProps {
  profileName: string
  defaults: Pick<OnboardingSetupInput, 'language' | 'theme' | 'currency' | 'dateFormat'>
  onFinish: (payload: OnboardingSetupInput) => Promise<void>
  canExit: boolean
  onExit: () => void
  onThemePreviewChange: (theme: OnboardingSetupInput['theme']) => void
}

export function OnboardingCard(props: OnboardingCardProps): JSX.Element {
  const { profileName: initialProfileName, defaults, onFinish, canExit, onExit, onThemePreviewChange } = props
  const [profileName, setProfileName] = useState(initialProfileName)
  const [language, setLanguage] = useState(defaults.language)
  const [theme, setTheme] = useState(defaults.theme)
  const [currency, setCurrency] = useState(defaults.currency)
  const [dateFormat, setDateFormat] = useState(defaults.dateFormat)
  const [authMode, setAuthMode] = useState<OnboardingSetupInput['authMode']>('none')
  const [authSecret, setAuthSecret] = useState('')
  const [authSecretConfirm, setAuthSecretConfirm] = useState('')
  const [jobEmploymentType, setJobEmploymentType] = useState<NonNullable<OnboardingSetupInput['jobEmploymentType']>>('casual')
  const [jobName, setJobName] = useState('')
  const [jobRate, setJobRate] = useState('18')
  const [jobSalaryAmount, setJobSalaryAmount] = useState('3000')
  const [jobFixedPayInterval, setJobFixedPayInterval] = useState<NonNullable<OnboardingSetupInput['jobFixedPayInterval']>>('monthly')
  const [jobHas13thSalary, setJobHas13thSalary] = useState(false)
  const [jobHas14thSalary, setJobHas14thSalary] = useState(false)
  const [jobStartDate, setJobStartDate] = useState(todayString())
  const [stepIndex, setStepIndex] = useState(0)
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const totalSteps = 4
  const isFinalStep = stepIndex === totalSteps - 1

  useEffect(() => {
    onThemePreviewChange(theme)
  }, [onThemePreviewChange, theme])

  function validateStep(index: number): boolean {
    if (index === 0) {
      if (!profileName.trim()) {
        setError(tx(language, 'Bitte gib einen Profilnamen ein.', 'Please enter a profile name.'))
        return false
      }
      return true
    }

    if (index === 1) {
      if (authMode === 'none') {
        return true
      }
      const secret = authSecret.trim()
      if (authMode === 'pin' && !/^\d{4,8}$/.test(secret)) {
        setError(tx(language, 'PIN muss aus 4 bis 8 Ziffern bestehen.', 'PIN must be 4 to 8 digits.'))
        return false
      }
      if (authMode === 'password' && secret.length < 6) {
        setError(tx(language, 'Passwort muss mindestens 6 Zeichen haben.', 'Password must be at least 6 characters.'))
        return false
      }
      if (secret !== authSecretConfirm.trim()) {
        setError(tx(language, 'PIN/Passwort stimmt nicht überein.', 'PIN/password does not match.'))
        return false
      }
      return true
    }

    if (index === 3) {
      const normalizedName = jobName.trim()
      if (!normalizedName) {
        return true
      }

      if (jobEmploymentType === 'casual') {
        const normalizedRate = Number(jobRate)
        if (!Number.isFinite(normalizedRate) || normalizedRate <= 0) {
          setError(tx(language, 'Bitte gib einen gültigen Stundensatz ein.', 'Please enter a valid hourly rate.'))
          return false
        }
      } else {
        const normalizedSalary = Number(jobSalaryAmount)
        if (!Number.isFinite(normalizedSalary) || normalizedSalary <= 0) {
          setError(tx(language, 'Bitte gib ein gültiges Gehalt ein.', 'Please enter a valid salary amount.'))
          return false
        }
        if (!jobStartDate) {
          setError(tx(language, 'Bitte gib ein Startdatum ein.', 'Please enter a start date.'))
          return false
        }
      }
    }

    return true
  }

  function goToPreviousStep(): void {
    setError('')
    setStepIndex((current) => Math.max(0, current - 1))
  }

  function goToNextStep(): void {
    if (!validateStep(stepIndex)) {
      return
    }
    setError('')
    setStepIndex((current) => Math.min(totalSteps - 1, current + 1))
  }

  async function submit(): Promise<void> {
    for (let index = 0; index < totalSteps; index += 1) {
      if (!validateStep(index)) {
        setStepIndex(index)
        return
      }
    }

    setError('')
    setSubmitting(true)
    try {
      await onFinish({
        profileName,
        language,
        theme,
        currency,
        dateFormat,
        authMode,
        authSecret: authMode === 'none' ? undefined : authSecret,
        jobEmploymentType,
        jobName,
        jobHourlyRate: jobEmploymentType === 'casual' ? Number(jobRate) : undefined,
        jobSalaryAmount: jobEmploymentType === 'fixed' ? Number(jobSalaryAmount) : undefined,
        jobFixedPayInterval: jobEmploymentType === 'fixed' ? jobFixedPayInterval : undefined,
        jobHas13thSalary: jobEmploymentType === 'fixed' ? jobHas13thSalary : undefined,
        jobHas14thSalary: jobEmploymentType === 'fixed' ? jobHas14thSalary : undefined,
        jobStartDate: jobEmploymentType === 'fixed' ? jobStartDate : undefined,
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
        <p className="muted">{tx(language, `Profil: ${profileName || initialProfileName}`, `Profile: ${profileName || initialProfileName}`)}</p>
      </header>

      <div className="setting-list">
        <p className="muted onboarding-step-title">
          {stepIndex === 0 ? tx(language, 'Name und Sprache', 'Name and language') : null}
          {stepIndex === 1 ? tx(language, 'Schutz', 'Protection') : null}
          {stepIndex === 2 ? tx(language, 'Währung, Datum und Theme', 'Currency, date format, and theme') : null}
          {stepIndex === 3 ? tx(language, 'Job-Setup (optional)', 'Job setup (optional)') : null}
        </p>

        {stepIndex === 0 ? (
          <>
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
          </>
        ) : null}

        {stepIndex === 1 ? (
          <>
            <label>
              {tx(language, 'Profilschutz', 'Profile protection')}
              <select
                value={authMode}
                onChange={(event) => {
                  const nextMode = event.target.value as OnboardingSetupInput['authMode']
                  setAuthMode(nextMode)
                  if (nextMode === 'none') {
                    setAuthSecret('')
                    setAuthSecretConfirm('')
                  }
                }}
              >
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
                    type="password"
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
          </>
        ) : null}

        {stepIndex === 2 ? (
          <>
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
              {tx(language, 'Thema', 'Theme')}
              <select value={theme} onChange={(event) => setTheme(event.target.value as typeof theme)}>
                <option value="light">{tx(language, 'Hell', 'Light')}</option>
                <option value="dark">{tx(language, 'Dunkel', 'Dark')}</option>
                <option value="glass">{tx(language, 'Glas', 'Glass')}</option>
                <option value="system">{tx(language, 'System', 'System')}</option>
              </select>
            </label>
          </>
        ) : null}

        {stepIndex === 3 ? (
          <>
            <label>
              {tx(language, 'Job (optional)', 'Job (optional)')}
              <input value={jobName} onChange={(event) => setJobName(event.target.value)} placeholder={tx(language, 'z. B. FoodAffairs', 'e.g. FoodAffairs')} />
            </label>
            <label>
              {tx(language, 'Anstellungsart', 'Employment type')}
              <select
                value={jobEmploymentType}
                onChange={(event) => setJobEmploymentType(event.target.value as NonNullable<OnboardingSetupInput['jobEmploymentType']>)}
              >
                <option value="casual">{tx(language, 'Fallweise', 'Casual')}</option>
                <option value="fixed">{tx(language, 'Fixanstellung', 'Fixed')}</option>
              </select>
            </label>

            {jobEmploymentType === 'casual' ? (
              <label>
                {tx(language, 'Stundensatz (optional)', 'Hourly rate (optional)')}
                <input type="number" min={0.01} step="0.01" value={jobRate} onChange={(event) => setJobRate(event.target.value)} />
              </label>
            ) : (
              <>
                <label>
                  {tx(language, 'Gehalt (pro Auszahlung)', 'Salary (per payout)')}
                  <input type="number" min={0.01} step="0.01" value={jobSalaryAmount} onChange={(event) => setJobSalaryAmount(event.target.value)} />
                </label>
                <label>
                  {tx(language, 'Auszahlungsintervall', 'Payout interval')}
                  <select
                    value={jobFixedPayInterval}
                    onChange={(event) => setJobFixedPayInterval(event.target.value as NonNullable<OnboardingSetupInput['jobFixedPayInterval']>)}
                  >
                    <option value="monthly">{tx(language, 'Monatlich', 'Monthly')}</option>
                    <option value="biweekly">{tx(language, 'Zweiwöchentlich', 'Biweekly')}</option>
                    <option value="weekly">{tx(language, 'Wöchentlich', 'Weekly')}</option>
                  </select>
                </label>
                <label>
                  {tx(language, 'Startdatum', 'Start date')}
                  <input type="date" value={jobStartDate} onChange={(event) => setJobStartDate(event.target.value)} />
                </label>
                <label className="toggle-row">
                  <span className={`switch ${jobHas13thSalary ? 'on' : ''}`} aria-hidden="true">
                    <input type="checkbox" checked={jobHas13thSalary} onChange={(event) => setJobHas13thSalary(event.target.checked)} />
                    <span className="thumb" />
                  </span>
                  <span>{tx(language, '13. Gehalt', '13th salary')}</span>
                </label>
                <label className="toggle-row">
                  <span className={`switch ${jobHas14thSalary ? 'on' : ''}`} aria-hidden="true">
                    <input type="checkbox" checked={jobHas14thSalary} onChange={(event) => setJobHas14thSalary(event.target.checked)} />
                    <span className="thumb" />
                  </span>
                  <span>{tx(language, '14. Gehalt', '14th salary')}</span>
                </label>
              </>
            )}
          </>
        ) : null}
      </div>

      {error ? <p className="error-text">{error}</p> : null}

      <div className="onboarding-progress" role="presentation" aria-hidden="true">
        {Array.from({ length: totalSteps }, (_, dotIndex) => (
          <span key={`onboarding-dot-${dotIndex}`} className={`onboarding-dot ${dotIndex === stepIndex ? 'active' : ''}`} />
        ))}
      </div>

      <div className="onboarding-actions">
        <div className="onboarding-actions-left">
          {canExit ? (
            <button type="button" className="button button-secondary" onClick={onExit} disabled={submitting}>
              {tx(language, 'Einrichtung verlassen', 'Leave setup')}
            </button>
          ) : null}
        </div>
        <div className="onboarding-actions-right">
          {stepIndex > 0 ? (
            <button type="button" className="button button-secondary" onClick={goToPreviousStep} disabled={submitting}>
              {tx(language, 'Zurück', 'Back')}
            </button>
          ) : null}
          <button
            type="button"
            className="button button-primary"
            onClick={isFinalStep ? () => void submit() : goToNextStep}
            disabled={submitting}
          >
            {isFinalStep
              ? submitting
                ? tx(language, 'Speichert...', 'Saving...')
                : tx(language, 'Einrichtung abschließen', 'Finish setup')
              : tx(language, 'Weiter', 'Next')}
          </button>
        </div>
      </div>
    </article>
  )
}
