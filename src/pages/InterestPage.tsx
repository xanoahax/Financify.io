import { useEffect, useMemo, useState } from 'react'
import { LineChart } from '../components/LineChart'
import { useAppContext } from '../state/useAppContext'
import type { InterestScenarioInput } from '../types/models'
import { formatMoney, toPercent } from '../utils/format'
import { calculateInterestScenario } from '../utils/interest'

function buildDefaultScenario(): InterestScenarioInput {
  return {
    name: 'Szenario A',
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
  const [input, setInput] = useState<InterestScenarioInput>(() => buildDefaultScenario())
  const [showDetails, setShowDetails] = useState(false)
  const [compareA, setCompareA] = useState<string>('')
  const [compareB, setCompareB] = useState<string>('')
  const [saveError, setSaveError] = useState('')
  const [confirmDeleteScenario, setConfirmDeleteScenario] = useState<{ id: string; name: string } | null>(null)

  const result = useMemo(() => calculateInterestScenario(input), [input])
  const chartData = result.timeline.map((item) => ({ label: `M${item.month}`, value: item.balance }))
  const contributionVsInterest = useMemo(
    () => [
      { label: 'Einzahlungen', value: result.totalContribution },
      { label: 'Zinsen', value: result.totalInterest },
    ],
    [result.totalContribution, result.totalInterest],
  )

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
      setSaveError(error instanceof Error ? error.message : 'Szenario konnte nicht gelöscht werden.')
      setConfirmDeleteScenario(null)
    }
  }

  return (
    <section className="page">
      <header className="page-header">
        <h1>Zinsrechner</h1>
        <p className="muted">Berechne Zinseszins mit optionaler Inflation und Steuerannahmen.</p>
      </header>

      <div className="two-column">
        <article className="card">
          <header className="section-header">
            <h2>Eingaben</h2>
          </header>
          <form className="form-grid" onSubmit={(event) => event.preventDefault()}>
            <label>
              Szenarioname
              <input value={input.name} onChange={(event) => setInput((current) => ({ ...current, name: event.target.value }))} />
            </label>
            <label>
              Startkapital
              <input
                type="number"
                min={0}
                step="0.01"
                value={input.startCapital}
                onChange={(event) => setInput((current) => ({ ...current, startCapital: Number(event.target.value) }))}
              />
            </label>
            <label>
              Regelmäßige Einzahlung
              <input
                type="number"
                min={0}
                step="0.01"
                value={input.recurringContribution}
                onChange={(event) => setInput((current) => ({ ...current, recurringContribution: Number(event.target.value) }))}
              />
            </label>
            <label>
              Einzahlungsintervall
              <select
                value={input.contributionFrequency}
                onChange={(event) => setInput((current) => ({ ...current, contributionFrequency: event.target.value as InterestScenarioInput['contributionFrequency'] }))}
              >
                <option value="monthly">Monatlich</option>
                <option value="yearly">Jährlich</option>
              </select>
            </label>
            <label>
              Zinssatz (p.a.)
              <input
                type="number"
                min={0}
                max={100}
                step="0.1"
                value={input.annualInterestRate}
                onChange={(event) => setInput((current) => ({ ...current, annualInterestRate: Number(event.target.value) }))}
              />
            </label>
            <label>
              Laufzeit (Monate)
              <input
                type="number"
                min={1}
                max={600}
                value={input.durationMonths}
                onChange={(event) => setInput((current) => ({ ...current, durationMonths: Number(event.target.value) }))}
              />
            </label>
            <label>
              Zinsintervall
              <select
                value={input.interestFrequency}
                onChange={(event) => setInput((current) => ({ ...current, interestFrequency: event.target.value as InterestScenarioInput['interestFrequency'] }))}
              >
                <option value="monthly">Monatlich</option>
                <option value="yearly">Jährlich</option>
              </select>
            </label>

            <label className="switch full-width">
              <input
                type="checkbox"
                checked={input.advancedEnabled}
                onChange={(event) => setInput((current) => ({ ...current, advancedEnabled: event.target.checked }))}
              />
              <span>Erweiterter Modus</span>
            </label>

            {input.advancedEnabled ? (
              <>
                <label>
                  Inflationsrate (p.a.)
                  <input
                    type="number"
                    min={0}
                    max={100}
                    step="0.1"
                    value={input.annualInflationRate}
                    onChange={(event) => setInput((current) => ({ ...current, annualInflationRate: Number(event.target.value) }))}
                  />
                </label>
                <label>
                  Kapitalertragssteuer (%)
                  <input
                    type="number"
                    min={0}
                    max={100}
                    step="0.1"
                    value={input.gainsTaxRate}
                    onChange={(event) => setInput((current) => ({ ...current, gainsTaxRate: Number(event.target.value) }))}
                  />
                </label>
                <label>
                  Erhöhung der Einzahlung p.a.
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
                    setSaveError(error instanceof Error ? error.message : 'Szenario konnte nicht gespeichert werden.')
                  })
                }}
              >
                Szenario speichern
              </button>
              <button type="button" className="button button-secondary" onClick={() => setInput(buildDefaultScenario())}>
                Zurücksetzen
              </button>
            </div>
          </form>
        </article>

        <article className="card">
          <header className="section-header">
            <h2>Ergebnisse</h2>
            <button type="button" className="button button-tertiary" onClick={() => setShowDetails((current) => !current)}>
              {showDetails ? 'Details ausblenden' : 'Details anzeigen'}
            </button>
          </header>
          <div className="stats-grid compact">
            <div className="stat-tile">
              <p className="muted">Endsaldo</p>
              <strong>{formatMoney(result.endBalance, settings.currency, settings.decimals, settings.privacyHideAmounts)}</strong>
            </div>
            <div className="stat-tile">
              <p className="muted">Gesamte Einzahlungen</p>
              <strong>{formatMoney(result.totalContribution, settings.currency, settings.decimals, settings.privacyHideAmounts)}</strong>
            </div>
            <div className="stat-tile">
              <p className="muted">Gesamte Zinsen</p>
              <strong>{formatMoney(result.totalInterest, settings.currency, settings.decimals, settings.privacyHideAmounts)}</strong>
            </div>
            {input.advancedEnabled ? (
              <div className="stat-tile">
                <p className="muted">Realer Endsaldo</p>
                <strong>{formatMoney(result.realEndBalance ?? 0, settings.currency, settings.decimals, settings.privacyHideAmounts)}</strong>
              </div>
            ) : null}
          </div>
          <LineChart data={chartData} />
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
            <h2>Verlaufsdetails</h2>
          </header>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Monat</th>
                  <th>Einzahlung</th>
                  <th>Zinsen</th>
                  <th>Saldo</th>
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
          <h2>Gespeicherte Szenarien</h2>
        </header>
        {scenarios.length === 0 ? <p className="empty-inline">Speichere dein erstes Szenario, um Optionen zu vergleichen.</p> : null}
        <ul className="clean-list">
          {scenarios.map((scenario) => {
            const computed = calculateInterestScenario(scenario.input)
            return (
              <li key={scenario.id}>
                <div>
                  <strong>{scenario.input.name}</strong>
                  <small>
                    {toPercent(scenario.input.annualInterestRate)} für {scenario.input.durationMonths} Monate
                  </small>
                </div>
                <div className="row-actions">
                  <span>{formatMoney(computed.endBalance, settings.currency, settings.decimals, settings.privacyHideAmounts)}</span>
                  <button
                    type="button"
                    className="button button-danger"
                    onClick={() => setConfirmDeleteScenario({ id: scenario.id, name: scenario.input.name })}
                  >
                    Löschen
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
              <h2>Szenario löschen?</h2>
              <button type="button" className="icon-button" onClick={() => setConfirmDeleteScenario(null)} aria-label="Popup schließen">
                x
              </button>
            </header>
            <p>Möchtest du "{confirmDeleteScenario.name}" wirklich löschen?</p>
            <div className="form-actions">
              <button type="button" className="button button-danger" onClick={() => void handleDeleteScenarioConfirmed()}>
                Löschen
              </button>
              <button type="button" className="button button-secondary" onClick={() => setConfirmDeleteScenario(null)}>
                Abbrechen
              </button>
            </div>
          </article>
        </div>
      ) : null}

      <article className="card">
        <header className="section-header">
          <h2>Szenariovergleich</h2>
        </header>
        <div className="inline-controls">
          <select value={compareA} onChange={(event) => setCompareA(event.target.value)}>
            <option value="">Szenario A wählen</option>
            {scenarios.map((scenario) => (
              <option key={`a-${scenario.id}`} value={scenario.id}>
                {scenario.input.name}
              </option>
            ))}
          </select>
          <select value={compareB} onChange={(event) => setCompareB(event.target.value)}>
            <option value="">Szenario B wählen</option>
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
          <p className="empty-inline">Waehle zwei Szenarien, um die Ergebnisse zu vergleichen.</p>
        )}
      </article>
    </section>
  )
}

