import { useState } from 'react'
import { useAppContext } from '../state/useAppContext'
import type { AppBackup } from '../types/models'
import { incomesToCsv, subscriptionsToCsv, triggerDownload } from '../utils/csv'

const accentPresets = ['#0a84ff', '#2ec4b6', '#ff9f0a', '#bf5af2', '#ff375f', '#6e6e73']

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

  function exportJson(): void {
    const payload = exportBackup()
    triggerDownload(`financify-backup-${new Date().toISOString().slice(0, 10)}.json`, JSON.stringify(payload, null, 2), 'application/json')
  }

  function exportCsv(): void {
    triggerDownload('subscriptions.csv', subscriptionsToCsv(subscriptions), 'text/csv')
    triggerDownload('income.csv', incomesToCsv(incomeEntries), 'text/csv')
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
      setImportError(error instanceof Error ? error.message : 'Import fehlgeschlagen. Bitte JSON-Format prüfen.')
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
      setBackgroundError(error instanceof Error ? error.message : 'Hintergrundbild konnte nicht gesetzt werden.')
    }
  }

  return (
    <section className="page">
      <header className="page-header">
        <div>
          <h1>Einstellungen</h1>
          <p className="muted">Oberfläche, Präferenzen und lokales Backup-Verhalten anpassen.</p>
        </div>
        <p className="muted app-version">Version {__APP_VERSION__}</p>
      </header>

      <div className="two-column">
        <article className="card">
          <header className="section-header">
            <h2>Darstellung</h2>
          </header>
          <div className="setting-list">
            <label>
              Thema
              <select value={settings.theme} onChange={(event) => setSettings({ theme: event.target.value as typeof settings.theme })}>
                <option value="light">Hell</option>
                <option value="dark">Dunkel</option>
                <option value="glass">Glas</option>
                <option value="system">System</option>
              </select>
            </label>
            <label>
              Akzentfarbe
              <div className="color-row">
                {accentPresets.map((color) => (
                  <button
                    key={color}
                    type="button"
                    className={`color-swatch ${settings.accentColor === color ? 'active' : ''}`}
                    style={{ backgroundColor: color }}
                    onClick={() => setSettings({ accentColor: color })}
                    aria-label={`Akzentfarbe ${color} auswählen`}
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
              <span>Gradient-Overlay</span>
            </label>
            <label>
              Gradient-Farben
              <div className="color-row">
                <input
                  type="color"
                  value={settings.gradientColorA}
                  onChange={(event) => setSettings({ gradientColorA: event.target.value })}
                  aria-label="Gradient-Farbe A"
                />
                <input
                  type="color"
                  value={settings.gradientColorB}
                  onChange={(event) => setSettings({ gradientColorB: event.target.value })}
                  aria-label="Gradient-Farbe B"
                />
              </div>
            </label>
            <label>
              Hintergrundbild
              <div className="inline-controls">
                <label className="button button-secondary file-picker">
                  Bild wählen
                  <input type="file" accept="image/*" onChange={(event) => void onBackgroundImageSelected(event)} />
                </label>
                <button type="button" className="button button-tertiary" onClick={clearBackgroundImage} disabled={!backgroundImageDataUrl}>
                  Bild entfernen
                </button>
              </div>
            </label>
            {backgroundError ? <p className="error-text">{backgroundError}</p> : null}
            {backgroundImageDataUrl ? <img className="background-preview" src={backgroundImageDataUrl} alt="Vorschau des gewählten Hintergrundbilds" /> : null}
            <label className="switch">
              <input
                type="checkbox"
                checked={settings.backgroundImageBlurEnabled}
                onChange={(event) => setSettings({ backgroundImageBlurEnabled: event.target.checked })}
                disabled={!backgroundImageDataUrl}
              />
              <span>Gewähltes Hintergrundbild weichzeichnen</span>
            </label>
            <label>
              Stärke der Hintergrund-Weichzeichnung
              <input
                type="range"
                min={0}
                max={20}
                value={settings.backgroundImageBlurAmount}
                onChange={(event) => setSettings({ backgroundImageBlurAmount: Number(event.target.value) })}
                disabled={!backgroundImageDataUrl || !settings.backgroundImageBlurEnabled}
              />
              <small className="muted">{settings.backgroundImageBlurAmount}px</small>
            </label>
            <label className="switch">
              <input type="checkbox" checked={settings.reducedMotion} onChange={(event) => setSettings({ reducedMotion: event.target.checked })} />
              <span>Reduzierte Animationen</span>
            </label>
          </div>
        </article>

        <article className="card">
          <header className="section-header">
            <h2>Präferenzen</h2>
          </header>
          <div className="setting-list">
            <label>
              Währung
              <input value={settings.currency} onChange={(event) => setSettings({ currency: event.target.value.toUpperCase() })} />
            </label>
            <label>
              Dezimalstellen
              <input
                type="number"
                min={0}
                max={4}
                value={settings.decimals}
                onChange={(event) => setSettings({ decimals: Number(event.target.value) })}
              />
            </label>
            <label>
              FoodAffairs-Stundensatz (€/h)
              <input
                type="number"
                min={0.01}
                step="0.01"
                value={settings.foodAffairsHourlyRate}
                onChange={(event) => {
                  const next = Number(event.target.value)
                  setSettings({ foodAffairsHourlyRate: Number.isFinite(next) && next > 0 ? next : 18 })
                }}
              />
            </label>
            <label>
              Datumsformat
              <select value={settings.dateFormat} onChange={(event) => setSettings({ dateFormat: event.target.value as typeof settings.dateFormat })}>
                <option value="DD.MM.YYYY">DD.MM.YYYY</option>
                <option value="MM/DD/YYYY">MM/DD/YYYY</option>
                <option value="YYYY-MM-DD">YYYY-MM-DD</option>
              </select>
            </label>
            <label>
              Wochenstart
              <select value={settings.startOfWeek} onChange={(event) => setSettings({ startOfWeek: event.target.value as typeof settings.startOfWeek })}>
                <option value="monday">Montag</option>
                <option value="sunday">Sonntag</option>
              </select>
            </label>
            <label className="switch">
              <input
                type="checkbox"
                checked={settings.privacyHideAmounts}
                onChange={(event) => setSettings({ privacyHideAmounts: event.target.checked })}
              />
              <span>Beträge ausblenden (Privatsphäre-Modus)</span>
            </label>
          </div>
        </article>
      </div>

      <article className="card">
        <header className="section-header">
          <h2>Datenverwaltung</h2>
        </header>
        {importError ? <p className="error-text">{importError}</p> : null}
        <div className="inline-controls">
          <button type="button" className="button button-secondary" onClick={exportJson}>
            JSON-Backup exportieren
          </button>
          <button type="button" className="button button-secondary" onClick={exportCsv}>
            CSV exportieren
          </button>
          <select value={importMode} onChange={(event) => setImportMode(event.target.value as 'replace' | 'merge')}>
            <option value="replace">Importmodus: Ersetzen</option>
            <option value="merge">Importmodus: Zusammenführen</option>
          </select>
          <label className="button button-primary file-picker">
            JSON importieren
            <input type="file" accept="application/json" onChange={(event) => void onImport(event)} />
          </label>
        </div>
      </article>
    </section>
  )
}


