import { useEffect, useMemo, useState } from 'react'
import { LineChart } from '../components/LineChart'
import { useAppContext } from '../state/useAppContext'
import type { InterestScenarioInput } from '../types/models'
import { formatMoney, toPercent } from '../utils/format'
import { tx } from '../utils/i18n'
import { calculateInterestScenario } from '../utils/interest'

function buildDefaultScenario(language: 'de' | 'en'): InterestScenarioInput {
  return {
    name: tx(language, 'Szenario A', 'Scenario A'),
    startCapital: 5000,
    recurringContribution: 250,
    contributionFrequency: 'monthly',
    annualInterestRate: 5,
    durationMonths: 120,
    interestFrequency: 'monthly',
    advancedEnabled: false,
    annualInflationRate: 2,
    gainsTaxRate: 0,
    annualContributionIncrease: 0,
  }
}

export function InterestPage(): JSX.Element {
  const { settings, scenarios, addScenario, deleteScenario } = useAppContext()
  const [input, setInput] = useState<InterestScenarioInput>(() => buildDefaultScenario(settings.language))
  const [showDetails, setShowDetails] = useState(false)
  const [compareA, setCompareA] = useState<string>('')
  const [compareB, setCompareB] = useState<string>('')
  const [saveError, setSaveError] = useState('')
  const [confirmDeleteScenario, setConfirmDeleteScenario] = useState<{ id: string; name: string } | null>(null)
  const t = (de: string, en: string) => tx(settings.language, de, en)

  const result = useMemo(() => calculateInterestScenario(input), [input])
  const chartData = result.timeline.map((item) => ({ label: `M${item.month}`, value: item.balance }))
  const contributionVsInterest = [
    { label: t('Einzahlungen', 'Contributions'), value: result.totalContribution },
    { label: t('Zinsen', 'Interest'), value: result.totalInterest },
  ]

  const compared = useMemo(() => {
    const scenarioA = scenarios.find((item) => item.id === compareA)
    const scenarioB = scenarios.find((item) => item.id === compareB)
    if (!scenarioA || !scenarioB) {
      return null
    }
    return {
      a: { scenario: scenarioA, result: calculateInterestScenario(scenarioA.input) },
      b: { scenario: scenarioB, result: calculateInterestScenario(scenarioB.input) },
    }
  }, [compareA, compareB, scenarios])

  useEffect(() => {
    if (!confirmDeleteScenario) {
      return
    }
    function onEscape(event: KeyboardEvent): void {
      if (event.key === 'Escape') {
        setConfirmDeleteScenario(null)
      }
    }
    window.addEventListener('keydown', onEscape)
    return () => window.removeEventListener('keydown', onEscape)
  }, [confirmDeleteScenario])

  async function handleDeleteScenarioConfirmed(): Promise<void> {
    if (!confirmDeleteScenario) {
      return
    }
    try {
      await deleteScenario(confirmDeleteScenario.id)
      setConfirmDeleteScenario(null)
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : t('Szenario konnte nicht gelöscht werden.', 'Scenario could not be deleted.'))
      setConfirmDeleteScenario(null)
    }
  }

  return (
    <section className="page">
      <header className="page-header">
        <h1>{t('Zinsrechner', 'Interest calculator')}</h1>
        <p className="muted">{t('Berechne Zinseszins mit optionaler Inflation und Steuerannahmen.', 'Calculate compound interest with optional inflation and tax assumptions.')}</p>
      </header>

      <div className="two-column">
        <article className="card">
          <header className="section-header">
            <h2>{t('Eingaben', 'Inputs')}</h2>
          </header>
          <form className="form-grid" onSubmit={(event) => event.preventDefault()}>
            <label>
              {t('Szenarioname', 'Scenario name')}
              <input value={input.name} onChange={(event) => setInput((current) => ({ ...current, name: event.target.value }))} />
            </label>
            <label>
              {t('Startkapital', 'Initial capital')}
              <input type="number" min={0} step="0.01" value={input.startCapital} onChange={(event) => setInput((current) => ({ ...current, startCapital: Number(event.target.value) }))} />
            </label>
            <label>
              {t('Regelmäßige Einzahlung', 'Recurring contribution')}
              <input
                type="number"
                min={0}
                step="0.01"
                value={input.recurringContribution}
                onChange={(event) => setInput((current) => ({ ...current, recurringContribution: Number(event.target.value) }))}
              />
            </label>
            <label>
              {t('Einzahlungsintervall', 'Contribution interval')}
              <select
                value={input.contributionFrequency}
                onChange={(event) => setInput((current) => ({ ...current, contributionFrequency: event.target.value as InterestScenarioInput['contributionFrequency'] }))}
              >
                <option value="monthly">{t('Monatlich', 'Monthly')}</option>
                <option value="yearly">{t('Jährlich', 'Yearly')}</option>
              </select>
            </label>
            <label>
              {t('Zinssatz (p.a.)', 'Interest rate (p.a.)')}
              <input type="number" min={0} max={100} step="0.1" value={input.annualInterestRate} onChange={(event) => setInput((current) => ({ ...current, annualInterestRate: Number(event.target.value) }))} />
            </label>
            <label>
              {t('Laufzeit (Monate)', 'Duration (months)')}
              <input type="number" min={1} max={600} value={input.durationMonths} onChange={(event) => setInput((current) => ({ ...current, durationMonths: Number(event.target.value) }))} />
            </label>
            <label>
              {t('Zinsintervall', 'Interest interval')}
              <select
                value={input.interestFrequency}
                onChange={(event) => setInput((current) => ({ ...current, interestFrequency: event.target.value as InterestScenarioInput['interestFrequency'] }))}
              >
                <option value="monthly">{t('Monatlich', 'Monthly')}</option>
                <option value="yearly">{t('Jährlich', 'Yearly')}</option>
              </select>
            </label>

            <label className="switch full-width">
              <input type="checkbox" checked={input.advancedEnabled} onChange={(event) => setInput((current) => ({ ...current, advancedEnabled: event.target.checked }))} />
              <span>{t('Erweiterter Modus', 'Advanced mode')}</span>
            </label>

            {input.advancedEnabled ? (
              <>
                <label>
                  {t('Inflationsrate (p.a.)', 'Inflation rate (p.a.)')}
                  <input type="number" min={0} max={100} step="0.1" value={input.annualInflationRate} onChange={(event) => setInput((current) => ({ ...current, annualInflationRate: Number(event.target.value) }))} />
                </label>
                <label>
                  {t('Kapitalertragssteuer (%)', 'Capital gains tax (%)')}
                  <input type="number" min={0} max={100} step="0.1" value={input.gainsTaxRate} onChange={(event) => setInput((current) => ({ ...current, gainsTaxRate: Number(event.target.value) }))} />
                </label>
                <label>
                  {t('Erhöhung der Einzahlung p.a.', 'Annual contribution increase')}
                  <input
                    type="number"
                    min={0}
                    max={100}
                    step="0.1"
                    value={input.annualContributionIncrease}
                    onChange={(event) => setInput((current) => ({ ...current, annualContributionIncrease: Number(event.target.value) }))}
                  />
                </label>
              </>
            ) : null}
            {saveError ? <p className="error-text full-width">{saveError}</p> : null}
            <div className="form-actions full-width">
              <button
                type="button"
                className="button button-primary"
                onClick={() => {
                  setSaveError('')
                  void addScenario(input).catch((error) => {
                    setSaveError(error instanceof Error ? error.message : t('Szenario konnte nicht gespeichert werden.', 'Scenario could not be saved.'))
                  })
                }}
              >
                {t('Szenario speichern', 'Save scenario')}
              </button>
              <button type="button" className="button button-secondary" onClick={() => setInput(buildDefaultScenario(settings.language))}>
                {t('Zurücksetzen', 'Reset')}
              </button>
            </div>
          </form>
        </article>

        <article className="card">
          <header className="section-header">
            <h2>{t('Ergebnisse', 'Results')}</h2>
            <button type="button" className="button button-tertiary" onClick={() => setShowDetails((current) => !current)}>
              {showDetails ? t('Details ausblenden', 'Hide details') : t('Details anzeigen', 'Show details')}
            </button>
          </header>
          <div className="stats-grid compact">
            <div className="stat-tile">
              <p className="muted">{t('Endsaldo', 'Final balance')}</p>
              <strong>{formatMoney(result.endBalance, settings.currency, settings.decimals, settings.privacyHideAmounts)}</strong>
            </div>
            <div className="stat-tile">
              <p className="muted">{t('Gesamte Einzahlungen', 'Total contributions')}</p>
              <strong>{formatMoney(result.totalContribution, settings.currency, settings.decimals, settings.privacyHideAmounts)}</strong>
            </div>
            <div className="stat-tile">
              <p className="muted">{t('Gesamte Zinsen', 'Total interest')}</p>
              <strong>{formatMoney(result.totalInterest, settings.currency, settings.decimals, settings.privacyHideAmounts)}</strong>
            </div>
            {input.advancedEnabled ? (
              <div className="stat-tile">
                <p className="muted">{t('Realer Endsaldo', 'Real final balance')}</p>
                <strong>{formatMoney(result.realEndBalance ?? 0, settings.currency, settings.decimals, settings.privacyHideAmounts)}</strong>
              </div>
            ) : null}
          </div>
          <LineChart data={chartData} language={settings.language} />
          <div className="chips">
            {contributionVsInterest.map((item) => (
              <span key={item.label} className="chip">
                {item.label}: {formatMoney(item.value, settings.currency, settings.decimals, settings.privacyHideAmounts)}
              </span>
            ))}
          </div>
        </article>
      </div>

      {showDetails ? (
        <article className="card">
          <header className="section-header">
            <h2>{t('Verlaufsdetails', 'Timeline details')}</h2>
          </header>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>{t('Monat', 'Month')}</th>
                  <th>{t('Einzahlung', 'Contribution')}</th>
                  <th>{t('Zinsen', 'Interest')}</th>
                  <th>{t('Saldo', 'Balance')}</th>
                </tr>
              </thead>
              <tbody>
                {result.timeline.map((item) => (
                  <tr key={item.month}>
                    <td>{item.month}</td>
                    <td>{formatMoney(item.contribution, settings.currency, settings.decimals, settings.privacyHideAmounts)}</td>
                    <td>{formatMoney(item.interestEarned, settings.currency, settings.decimals, settings.privacyHideAmounts)}</td>
                    <td>{formatMoney(item.balance, settings.currency, settings.decimals, settings.privacyHideAmounts)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </article>
      ) : null}

      <article className="card">
        <header className="section-header">
          <h2>{t('Gespeicherte Szenarien', 'Saved scenarios')}</h2>
        </header>
        {scenarios.length === 0 ? <p className="empty-inline">{t('Speichere dein erstes Szenario, um Optionen zu vergleichen.', 'Save your first scenario to compare options.')}</p> : null}
        <ul className="clean-list">
          {scenarios.map((scenario) => {
            const computed = calculateInterestScenario(scenario.input)
            return (
              <li key={scenario.id}>
                <div>
                  <strong>{scenario.input.name}</strong>
                  <small>
                    {toPercent(scenario.input.annualInterestRate)} {t('für', 'for')} {scenario.input.durationMonths} {t('Monate', 'months')}
                  </small>
                </div>
                <div className="row-actions">
                  <span>{formatMoney(computed.endBalance, settings.currency, settings.decimals, settings.privacyHideAmounts)}</span>
                  <button type="button" className="button button-danger" onClick={() => setConfirmDeleteScenario({ id: scenario.id, name: scenario.input.name })}>
                    {t('Löschen', 'Delete')}
                  </button>
                </div>
              </li>
            )
          })}
        </ul>
      </article>

      {confirmDeleteScenario ? (
        <div className="form-modal-backdrop" onClick={() => setConfirmDeleteScenario(null)} role="presentation">
          <article className="card form-modal confirm-modal" onClick={(event) => event.stopPropagation()}>
            <header className="section-header">
              <h2>{t('Szenario löschen?', 'Delete scenario?')}</h2>
              <button type="button" className="icon-button" onClick={() => setConfirmDeleteScenario(null)} aria-label={t('Popup schließen', 'Close popup')}>
                x
              </button>
            </header>
            <p>{t(`Möchtest du "${confirmDeleteScenario.name}" wirklich löschen?`, `Do you really want to delete "${confirmDeleteScenario.name}"?`)}</p>
            <div className="form-actions">
              <button type="button" className="button button-danger" onClick={() => void handleDeleteScenarioConfirmed()}>
                {t('Löschen', 'Delete')}
              </button>
              <button type="button" className="button button-secondary" onClick={() => setConfirmDeleteScenario(null)}>
                {t('Abbrechen', 'Cancel')}
              </button>
            </div>
          </article>
        </div>
      ) : null}

      <article className="card">
        <header className="section-header">
          <h2>{t('Szenariovergleich', 'Scenario comparison')}</h2>
        </header>
        <div className="inline-controls">
          <select value={compareA} onChange={(event) => setCompareA(event.target.value)}>
            <option value="">{t('Szenario A wählen', 'Select scenario A')}</option>
            {scenarios.map((scenario) => (
              <option key={`a-${scenario.id}`} value={scenario.id}>
                {scenario.input.name}
              </option>
            ))}
          </select>
          <select value={compareB} onChange={(event) => setCompareB(event.target.value)}>
            <option value="">{t('Szenario B wählen', 'Select scenario B')}</option>
            {scenarios.map((scenario) => (
              <option key={`b-${scenario.id}`} value={scenario.id}>
                {scenario.input.name}
              </option>
            ))}
          </select>
        </div>
        {compared ? (
          <div className="compare-grid">
            <article className="card compact">
              <h3>{compared.a.scenario.input.name}</h3>
              <p>{formatMoney(compared.a.result.endBalance, settings.currency, settings.decimals, settings.privacyHideAmounts)}</p>
            </article>
            <article className="card compact">
              <h3>{compared.b.scenario.input.name}</h3>
              <p>{formatMoney(compared.b.result.endBalance, settings.currency, settings.decimals, settings.privacyHideAmounts)}</p>
            </article>
          </div>
        ) : (
          <p className="empty-inline table-empty-message">{t('Wähle zwei Szenarien, um die Ergebnisse zu vergleichen.', 'Choose two scenarios to compare results.')}</p>
        )}
      </article>
    </section>
  )
}
