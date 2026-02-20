import { useState } from 'react'
import packageJson from '../../package.json'
import { useAppContext } from '../state/useAppContext'
import type { AppBackup, ShiftJobConfig } from '../types/models'
import { incomesToCsv, subscriptionsToCsv, triggerDownload } from '../utils/csv'
import { tx } from '../utils/i18n'

const accentPresets = ['#0a84ff', '#2ec4b6', '#ff9f0a', '#bf5af2', '#ff375f', '#6e6e73']

function makeJobId(): string {
  return `job-${crypto.randomUUID()}`
}

export function SettingsPage(): JSX.Element {
  const {
    settings,
    setSettings,
    backgroundImageDataUrl,
    setBackgroundImageFromFile,
    clearBackgroundImage,
    exportBackup,
    importBackup,
    subscriptions,
    incomeEntries,
  } = useAppContext()
  const [importMode, setImportMode] = useState<'replace' | 'merge'>('replace')
  const [importError, setImportError] = useState('')
  const [backgroundError, setBackgroundError] = useState('')
  const t = (de: string, en: string) => tx(settings.language, de, en)
  const hasBackgroundImage = Boolean(backgroundImageDataUrl)

  function exportJson(): void {
    const payload = exportBackup()
    triggerDownload(`financify-backup-${new Date().toISOString().slice(0, 10)}.json`, JSON.stringify(payload, null, 2), 'application/json')
  }

  function exportCsv(): void {
    triggerDownload('subscriptions.csv', subscriptionsToCsv(subscriptions), 'text/csv')
    triggerDownload('income.csv', incomesToCsv(incomeEntries), 'text/csv')
  }

  function updateShiftJobs(nextJobs: ShiftJobConfig[], nextDefaultId?: string): void {
    const resolvedDefaultId = nextJobs.length === 0 ? '' : nextDefaultId && nextJobs.some((job) => job.id === nextDefaultId) ? nextDefaultId : nextJobs[0].id
    setSettings({ shiftJobs: nextJobs, defaultShiftJobId: resolvedDefaultId })
  }

  function addJob(): void {
    const next = [...settings.shiftJobs, { id: makeJobId(), name: t('Neuer Job', 'New job'), hourlyRate: 18 }]
    updateShiftJobs(next, settings.defaultShiftJobId)
  }

  function updateJobName(id: string, value: string): void {
    const next = settings.shiftJobs.map((job) => (job.id === id ? { ...job, name: value } : job))
    updateShiftJobs(next, settings.defaultShiftJobId)
  }

  function updateJobRate(id: string, value: string): void {
    const parsed = Number(value)
    const next = settings.shiftJobs.map((job) =>
      job.id === id ? { ...job, hourlyRate: Number.isFinite(parsed) && parsed > 0 ? parsed : 18 } : job,
    )
    updateShiftJobs(next, settings.defaultShiftJobId)
  }

  function deleteJob(id: string): void {
    const remaining = settings.shiftJobs.filter((job) => job.id !== id)
    const nextDefaultId = settings.defaultShiftJobId === id ? remaining[0]?.id : settings.defaultShiftJobId
    updateShiftJobs(remaining, nextDefaultId)
  }

  async function onImport(event: React.ChangeEvent<HTMLInputElement>): Promise<void> {
    const file = event.target.files?.[0]
    if (!file) {
      return
    }
    try {
      setImportError('')
      const text = await file.text()
      const parsed = JSON.parse(text) as AppBackup
      await importBackup(parsed, importMode)
      event.target.value = ''
    } catch (error) {
      setImportError(error instanceof Error ? error.message : t('Import fehlgeschlagen. Bitte JSON-Format prüfen.', 'Import failed. Please verify JSON format.'))
    }
  }

  async function onBackgroundImageSelected(event: React.ChangeEvent<HTMLInputElement>): Promise<void> {
    const file = event.target.files?.[0]
    if (!file) {
      return
    }
    try {
      setBackgroundError('')
      await setBackgroundImageFromFile(file)
      event.target.value = ''
    } catch (error) {
      setBackgroundError(error instanceof Error ? error.message : t('Hintergrundbild konnte nicht gesetzt werden.', 'Background image could not be set.'))
    }
  }

  return (
    <section className="page">
      <header className="page-header">
        <div>
          <h1>{t('Einstellungen', 'Settings')}</h1>
          <p className="muted">{t('Oberfläche, Präferenzen und lokales Backup-Verhalten anpassen.', 'Adjust interface, preferences and local backup behavior.')}</p>
        </div>
        <p className="muted app-version">Version {packageJson.version}</p>
      </header>

      <div className="two-column">
        <article className="card">
          <header className="section-header">
            <h2>{t('Darstellung', 'Appearance')}</h2>
          </header>
          <div className="setting-list appearance-settings">
            <section className="settings-group">
              <p className="settings-group-title">{t('Thema', 'Theme')}</p>
              <label>
                <span>{t('Thema', 'Theme')}</span>
                <select value={settings.theme} onChange={(event) => setSettings({ theme: event.target.value as typeof settings.theme })}>
                  <option value="light">{t('Hell', 'Light')}</option>
                  <option value="dark">{t('Dunkel', 'Dark')}</option>
                  <option value="glass">{t('Glas', 'Glass')}</option>
                  <option value="system">{t('System', 'System')}</option>
                </select>
              </label>
            </section>

            <section className="settings-group">
              <p className="settings-group-title">{t('Farben', 'Colors')}</p>
              <label>
                <span>{t('Akzentfarbe', 'Accent color')}</span>
                <div className="color-row accent-picker">
                  {accentPresets.map((color) => (
                    <button
                      key={color}
                      type="button"
                      className={`color-swatch ${settings.accentColor === color ? 'active' : ''}`}
                      style={{ backgroundColor: color }}
                      onClick={() => setSettings({ accentColor: color })}
                      aria-label={t(`Akzentfarbe ${color} auswählen`, `Select accent color ${color}`)}
                    />
                  ))}
                  <input type="color" value={settings.accentColor} onChange={(event) => setSettings({ accentColor: event.target.value })} />
                </div>
              </label>
              <label className="switch">
                <input
                  type="checkbox"
                  checked={settings.gradientOverlayEnabled}
                  onChange={(event) => setSettings({ gradientOverlayEnabled: event.target.checked })}
                />
                <span>{t('Gradient-Overlay', 'Gradient overlay')}</span>
              </label>
              <label>
                <span>{t('Gradient-Farben', 'Gradient colors')}</span>
                <div className="color-row gradient-color-row">
                  <input
                    type="color"
                    value={settings.gradientColorA}
                    onChange={(event) => setSettings({ gradientColorA: event.target.value })}
                    aria-label={t('Gradient-Farbe A', 'Gradient color A')}
                  />
                  <input
                    type="color"
                    value={settings.gradientColorB}
                    onChange={(event) => setSettings({ gradientColorB: event.target.value })}
                    aria-label={t('Gradient-Farbe B', 'Gradient color B')}
                  />
                </div>
              </label>
            </section>

            <section className="settings-group">
              <p className="settings-group-title">{t('Hintergrund', 'Background')}</p>
              <label>
                <span>{t('Hintergrundbild', 'Background image')}</span>
                <div className="inline-controls">
                  <label className="button button-secondary file-picker">
                    {t('Bild wählen', 'Choose image')}
                    <input type="file" accept="image/*" onChange={(event) => void onBackgroundImageSelected(event)} />
                  </label>
                  <button type="button" className="button button-tertiary" onClick={clearBackgroundImage} disabled={!hasBackgroundImage}>
                    {t('Bild entfernen', 'Remove image')}
                  </button>
                </div>
              </label>
              {backgroundError ? <p className="error-text">{backgroundError}</p> : null}
              {hasBackgroundImage ? <img className="background-preview" src={backgroundImageDataUrl ?? ''} alt={t('Vorschau des gewählten Hintergrundbilds', 'Preview of selected background image')} /> : null}
              <label className={`switch ${!hasBackgroundImage ? 'switch-disabled' : ''}`}>
                <input
                  type="checkbox"
                  checked={settings.backgroundImageBlurEnabled}
                  onChange={(event) => setSettings({ backgroundImageBlurEnabled: event.target.checked })}
                  disabled={!hasBackgroundImage}
                />
                <span>{t('Gewähltes Hintergrundbild weichzeichnen', 'Blur selected background image')}</span>
              </label>
              {hasBackgroundImage && settings.backgroundImageBlurEnabled ? (
                <label>
                  <span>{t('Stärke der Hintergrund-Weichzeichnung', 'Background blur strength')}</span>
                  <input
                    type="range"
                    min={0}
                    max={20}
                    value={settings.backgroundImageBlurAmount}
                    onChange={(event) => setSettings({ backgroundImageBlurAmount: Number(event.target.value) })}
                  />
                  <small className="muted">{settings.backgroundImageBlurAmount}px</small>
                </label>
              ) : null}
            </section>

            <section className="settings-group">
              <p className="settings-group-title">{t('Bewegung', 'Motion')}</p>
              <label className="switch">
                <input type="checkbox" checked={settings.reducedMotion} onChange={(event) => setSettings({ reducedMotion: event.target.checked })} />
                <span>{t('Reduzierte Animationen', 'Reduced animations')}</span>
              </label>
            </section>
          </div>
        </article>

        <article className="card">
          <header className="section-header">
            <h2>{t('Präferenzen', 'Preferences')}</h2>
          </header>
          <div className="setting-list">
            <label>
              {t('Sprache', 'Language')}
              <select value={settings.language} onChange={(event) => setSettings({ language: event.target.value as typeof settings.language })}>
                <option value="de">Deutsch</option>
                <option value="en">English</option>
              </select>
            </label>
            <label>
              {t('Währung', 'Currency')}
              <input value={settings.currency} onChange={(event) => setSettings({ currency: event.target.value.toUpperCase() })} />
            </label>
            <label>
              {t('Dezimalstellen', 'Decimal places')}
              <input
                type="number"
                min={0}
                max={4}
                value={settings.decimals}
                onChange={(event) => setSettings({ decimals: Number(event.target.value) })}
              />
            </label>
            <label>
              {t('Datumsformat', 'Date format')}
              <select value={settings.dateFormat} onChange={(event) => setSettings({ dateFormat: event.target.value as typeof settings.dateFormat })}>
                <option value="DD.MM.YYYY">DD.MM.YYYY</option>
                <option value="MM/DD/YYYY">MM/DD/YYYY</option>
                <option value="YYYY-MM-DD">YYYY-MM-DD</option>
              </select>
            </label>
            <label>
              {t('Wochenstart', 'Week starts on')}
              <select value={settings.startOfWeek} onChange={(event) => setSettings({ startOfWeek: event.target.value as typeof settings.startOfWeek })}>
                <option value="monday">{t('Montag', 'Monday')}</option>
                <option value="sunday">{t('Sonntag', 'Sunday')}</option>
              </select>
            </label>
            <label className="switch">
              <input
                type="checkbox"
                checked={settings.privacyHideAmounts}
                onChange={(event) => setSettings({ privacyHideAmounts: event.target.checked })}
              />
              <span>{t('Beträge ausblenden (Privatsphäre-Modus)', 'Hide amounts (privacy mode)')}</span>
            </label>
          </div>
        </article>
      </div>

      <article className="card">
        <header className="section-header">
          <h2>{t('Jobs', 'Jobs')}</h2>
          <button type="button" className="button button-secondary" onClick={addJob}>
            {t('Job hinzufügen', 'Add job')}
          </button>
        </header>
        <p className="muted">
          {t(
            'Lege Jobs für das Dienst-Logging an. Der Standard-Job wird beim schnellen Dienst-Loggen vorausgewählt.',
            'Configure jobs for shift logging. The default job is preselected in quick shift logging.',
          )}
        </p>
        <div className="setting-list">
          {settings.shiftJobs.length === 0 ? (
            <p className="empty-inline">{t('Noch keine Jobs angelegt.', 'No jobs configured yet.')}</p>
          ) : null}
          {settings.shiftJobs.map((job) => (
            <div className="job-row" key={job.id}>
              <label>
                {t('Jobname', 'Job name')}
                <input value={job.name} onChange={(event) => updateJobName(job.id, event.target.value)} placeholder={t('z. B. FoodAffairs', 'e.g. FoodAffairs')} />
              </label>
              <label>
                {t('Stundensatz (€/h)', 'Hourly rate (€/h)')}
                <input type="number" min={0.01} step="0.01" value={job.hourlyRate} onChange={(event) => updateJobRate(job.id, event.target.value)} />
              </label>
              <div className="inline-controls">
                <button
                  type="button"
                  className={`button ${settings.defaultShiftJobId === job.id ? 'button-primary' : 'button-secondary'}`}
                  onClick={() => setSettings({ defaultShiftJobId: job.id })}
                >
                  {settings.defaultShiftJobId === job.id ? t('Standard', 'Default') : t('Als Standard setzen', 'Set as default')}
                </button>
                <button
                  type="button"
                  className="button button-danger"
                  onClick={() => deleteJob(job.id)}
                >
                  {t('Löschen', 'Delete')}
                </button>
              </div>
            </div>
          ))}
        </div>
      </article>

      <article className="card">
        <header className="section-header">
          <h2>{t('Datenverwaltung', 'Data management')}</h2>
        </header>
        {importError ? <p className="error-text">{importError}</p> : null}
        <div className="inline-controls">
          <button type="button" className="button button-secondary" onClick={exportJson}>
            {t('JSON-Backup exportieren', 'Export JSON backup')}
          </button>
          <button type="button" className="button button-secondary" onClick={exportCsv}>
            {t('CSV exportieren', 'Export CSV')}
          </button>
          <select value={importMode} onChange={(event) => setImportMode(event.target.value as 'replace' | 'merge')}>
            <option value="replace">{t('Importmodus: Ersetzen', 'Import mode: Replace')}</option>
            <option value="merge">{t('Importmodus: Zusammenführen', 'Import mode: Merge')}</option>
          </select>
          <label className="button button-primary file-picker">
            {t('JSON importieren', 'Import JSON')}
            <input type="file" accept="application/json" onChange={(event) => void onImport(event)} />
          </label>
        </div>
      </article>
    </section>
  )
}
