import { useCallback, useEffect, useMemo, useState } from 'react'
import { BarChart } from '../components/BarChart'
import { DonutChart } from '../components/DonutChart'
import { LineChart } from '../components/LineChart'
import { useGuardedBackdropClose } from '../hooks/useGuardedBackdropClose'
import { useAppContext } from '../state/useAppContext'
import type { HouseholdCostFrequency, HouseholdSplitType, HouseholdType } from '../types/models'
import { compareDateStrings, monthLabel, todayString } from '../utils/date'
import { formatMoney } from '../utils/format'
import {
  householdCategoryBreakdown,
  householdMemberBreakdown,
  householdTrend,
  HOUSEHOLD_CATEGORY_SUBCATEGORIES,
  monthlyEquivalentHouseholdCost,
  monthlyExternalPayerTotal,
  monthlyHouseholdTotal,
  monthlyResidentNetTotal,
} from '../utils/household'
import { tx } from '../utils/i18n'

type DeleteTarget = { kind: 'household' | 'member' | 'payer' | 'cost'; id: string; label: string } | null
type HouseholdForm = { name: string; type: HouseholdType; currency: 'EUR' | 'USD'; billingStart: string }
type MemberForm = { householdId: string; name: string; role: string; activeFrom: string }
type PayerForm = { householdId: string; name: string }
type CostForm = {
  householdId: string
  title: string
  category: string
  subcategory: string
  amount: number
  frequency: HouseholdCostFrequency
  startDate: string
  payerId: string
  isShared: boolean
  splitType: HouseholdSplitType
}

const HOUSEHOLD_TYPES: Array<{ value: HouseholdType; de: string; en: string }> = [
  { value: 'house', de: 'Haus', en: 'House' },
  { value: 'rental', de: 'Mietwohnung', en: 'Rental apartment' },
  { value: 'owned', de: 'Eigentumswohnung', en: 'Condominium' },
  { value: 'shared', de: 'WG', en: 'Shared flat' },
  { value: 'other', de: 'Sonstiges', en: 'Other' },
]

const FREQUENCIES: Array<{ value: HouseholdCostFrequency; de: string; en: string }> = [
  { value: 'weekly', de: 'Wöchentlich', en: 'Weekly' },
  { value: 'biweekly', de: '2-wöchentlich', en: 'Biweekly' },
  { value: 'monthly', de: 'Monatlich', en: 'Monthly' },
  { value: 'yearly', de: 'Jährlich', en: 'Yearly' },
  { value: 'one_time', de: 'Einmalig', en: 'One-time' },
]

const SPLIT_TYPES: Array<{ value: HouseholdSplitType; de: string; en: string }> = [
  { value: 'equal', de: 'Gleichmäßig', en: 'Equal' },
  { value: 'weighted', de: 'Gewichtet (%)', en: 'Weighted (%)' },
  { value: 'fixed_amount', de: 'Fixbetrag', en: 'Fixed amount' },
  { value: 'custom', de: 'Benutzerdefiniert (%)', en: 'Custom (%)' },
]

const CATEGORY_LABELS: Record<string, { de: string; en: string }> = {
  Housing: { de: 'Wohnen', en: 'Housing' },
  Energy: { de: 'Energie', en: 'Energy' },
  Water: { de: 'Wasser & Abwasser', en: 'Water & wastewater' },
  InternetCommunication: { de: 'Internet & Kommunikation', en: 'Internet & communication' },
  Insurance: { de: 'Versicherung', en: 'Insurance' },
  Household: { de: 'Haushalt & Reinigung', en: 'Household & cleaning' },
  Groceries: { de: 'Lebensmittel', en: 'Groceries' },
  Mobility: { de: 'Mobilität', en: 'Mobility' },
  Maintenance: { de: 'Rücklagen/Instandhaltung', en: 'Maintenance' },
  Other: { de: 'Sonstiges', en: 'Other' },
}

const SUBCATEGORY_LABELS: Record<string, { de: string; en: string }> = {
  Rent: { de: 'Miete', en: 'Rent' },
  Mortgage: { de: 'Kreditrate', en: 'Mortgage' },
  'Building fees': { de: 'Betriebskosten', en: 'Building fees' },
  Electricity: { de: 'Strom', en: 'Electricity' },
  Gas: { de: 'Gas', en: 'Gas' },
  Heating: { de: 'Heizung', en: 'Heating' },
  Water: { de: 'Wasser', en: 'Water' },
  Wastewater: { de: 'Abwasser', en: 'Wastewater' },
  Internet: { de: 'Internet', en: 'Internet' },
  'Mobile phone': { de: 'Mobilfunk', en: 'Mobile phone' },
  TV: { de: 'TV', en: 'TV' },
  'Household insurance': { de: 'Haushaltsversicherung', en: 'Household insurance' },
  'Building insurance': { de: 'Gebäudeversicherung', en: 'Building insurance' },
  'Legal insurance': { de: 'Rechtsschutz', en: 'Legal insurance' },
  'Cleaning supplies': { de: 'Reinigungsmittel', en: 'Cleaning supplies' },
  'Home service': { de: 'Hausservice', en: 'Home service' },
  'Waste disposal': { de: 'Müllentsorgung', en: 'Waste disposal' },
  Supermarket: { de: 'Supermarkt', en: 'Supermarket' },
  'Household goods': { de: 'Haushaltswaren', en: 'Household goods' },
  'Public transport': { de: 'Öffi-Ticket', en: 'Public transport' },
  Fuel: { de: 'Treibstoff', en: 'Fuel' },
  Parking: { de: 'Parken', en: 'Parking' },
  'Repair fund': { de: 'Reparaturfonds', en: 'Repair fund' },
  Maintenance: { de: 'Wartung', en: 'Maintenance' },
  Other: { de: 'Sonstiges', en: 'Other' },
}

function defaultSubcategory(category: string): string {
  return HOUSEHOLD_CATEGORY_SUBCATEGORIES[category]?.[0] ?? 'Other'
}

function buildDefaultCostForm(householdId: string): CostForm {
  return {
    householdId,
    title: '',
    category: 'Housing',
    subcategory: 'Rent',
    amount: Number.NaN,
    frequency: 'monthly',
    startDate: todayString(),
    payerId: '',
    isShared: true,
    splitType: 'equal',
  }
}

export function HouseholdsPage(): JSX.Element {
  const {
    settings, uiState, setUiState,
    households, householdMembers, householdPayers, householdCosts, householdCostSplits,
    addHousehold, deleteHousehold, addHouseholdMember, deleteHouseholdMember,
    addHouseholdPayer, deleteHouseholdPayer,
    addHouseholdCost, updateHouseholdCost, deleteHouseholdCost,
  } = useAppContext()

  const t = (de: string, en: string) => tx(settings.language, de, en)
  const language = settings.language
  const monthLocale = language === 'de' ? 'de-DE' : 'en-US'
  const today = todayString()

  const [selectedHouseholdId, setSelectedHouseholdId] = useState('')
  const [householdOpen, setHouseholdOpen] = useState(false)
  const [memberOpen, setMemberOpen] = useState(false)
  const [payerOpen, setPayerOpen] = useState(false)
  const [costOpen, setCostOpen] = useState(false)
  const [editCostId, setEditCostId] = useState<string | null>(null)
  const [effectiveFromDate, setEffectiveFromDate] = useState(todayString())
  const [deleteTarget, setDeleteTarget] = useState<DeleteTarget>(null)
  const [errorText, setErrorText] = useState('')

  const [householdForm, setHouseholdForm] = useState<HouseholdForm>({ name: '', type: 'rental', currency: settings.currency, billingStart: todayString() })
  const [memberForm, setMemberForm] = useState<MemberForm>({ householdId: '', name: '', role: '', activeFrom: todayString() })
  const [payerForm, setPayerForm] = useState<PayerForm>({ householdId: '', name: '' })
  const [costForm, setCostForm] = useState<CostForm>(buildDefaultCostForm(''))

  const closeHousehold = useCallback(() => { setHouseholdOpen(false); setErrorText('') }, [])
  const closeMember = useCallback(() => { setMemberOpen(false); setErrorText('') }, [])
  const closePayer = useCallback(() => { setPayerOpen(false); setErrorText('') }, [])
  const closeCost = useCallback(() => { setCostOpen(false); setEditCostId(null); setEffectiveFromDate(todayString()); setErrorText('') }, [])
  const closeDelete = useCallback(() => setDeleteTarget(null), [])

  const householdClose = useGuardedBackdropClose(closeHousehold)
  const memberClose = useGuardedBackdropClose(closeMember)
  const payerClose = useGuardedBackdropClose(closePayer)
  const costClose = useGuardedBackdropClose(closeCost)
  const deleteClose = useGuardedBackdropClose(closeDelete)

  const sortedHouseholds = useMemo(() => [...households].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)), [households])
  useEffect(() => {
    if (sortedHouseholds.length === 0) { setSelectedHouseholdId(''); return }
    if (!selectedHouseholdId || !sortedHouseholds.some((h) => h.id === selectedHouseholdId)) setSelectedHouseholdId(sortedHouseholds[0].id)
  }, [selectedHouseholdId, sortedHouseholds])

  const selectedHousehold = useMemo(() => sortedHouseholds.find((h) => h.id === selectedHouseholdId) ?? null, [selectedHouseholdId, sortedHouseholds])
  const members = useMemo(() => householdMembers.filter((m) => m.householdId === selectedHouseholdId), [householdMembers, selectedHouseholdId])
  const payers = useMemo(() => householdPayers.filter((p) => p.householdId === selectedHouseholdId), [householdPayers, selectedHouseholdId])
  const costs = useMemo(() => householdCosts.filter((c) => c.householdId === selectedHouseholdId), [householdCosts, selectedHouseholdId])
  const costIds = useMemo(() => new Set(costs.map((c) => c.id)), [costs])
  const splits = useMemo(() => householdCostSplits.filter((s) => costIds.has(s.costId)), [costIds, householdCostSplits])

  const query = uiState.globalSearch.trim().toLowerCase()
  const filteredCosts = useMemo(() => (!query ? costs : costs.filter((c) => `${c.title} ${c.category} ${c.subcategory}`.toLowerCase().includes(query))), [costs, query])
  const tableCosts = useMemo(() => filteredCosts.filter((c) => c.status === 'active' && (!c.endDate || compareDateStrings(c.endDate, today) >= 0)), [filteredCosts, today])
  const modalPayers = useMemo(() => householdPayers.filter((p) => p.householdId === costForm.householdId).sort((a, b) => a.name.localeCompare(b.name)), [costForm.householdId, householdPayers])
  const payerLabelById = useMemo(() => new Map(payers.map((p) => [p.id, p.name])), [payers])

  const categorySeries = useMemo(() => householdCategoryBreakdown(filteredCosts).map((item) => ({ label: CATEGORY_LABELS[item.label]?.[language] ?? item.label, value: item.value })), [filteredCosts, language])
  const memberSeries = useMemo(() => {
    const map = new Map(members.map((m) => [m.id, m.name]))
    return householdMemberBreakdown(filteredCosts, members, payers, splits).map((item) => ({ label: map.get(item.memberId) ?? t('Unbekannt', 'Unknown'), value: item.value }))
  }, [filteredCosts, members, payers, splits, t])
  const trend = useMemo(() => householdTrend(filteredCosts, 12).map((item) => ({ label: monthLabel(item.month, monthLocale), value: item.value })), [filteredCosts, monthLocale])

  const monthlyGross = useMemo(() => monthlyHouseholdTotal(filteredCosts), [filteredCosts])
  const monthlyExternal = useMemo(() => monthlyExternalPayerTotal(filteredCosts, payers), [filteredCosts, payers])
  const monthlyResidents = useMemo(() => monthlyResidentNetTotal(filteredCosts, payers), [filteredCosts, payers])

  async function submitHousehold(event: React.FormEvent): Promise<void> { event.preventDefault(); try { await addHousehold(householdForm); setHouseholdOpen(false); setHouseholdForm({ name: '', type: 'rental', currency: settings.currency, billingStart: todayString() }); setErrorText('') } catch (error) { setErrorText(error instanceof Error ? error.message : t('Haushalt konnte nicht gespeichert werden.', 'Household could not be saved.')) } }
  async function submitMember(event: React.FormEvent): Promise<void> { event.preventDefault(); try { await addHouseholdMember({ householdId: memberForm.householdId, name: memberForm.name, role: memberForm.role, activeFrom: memberForm.activeFrom, activeTo: null, isActive: true }); setMemberOpen(false); setMemberForm({ householdId: selectedHouseholdId, name: '', role: '', activeFrom: todayString() }); setErrorText('') } catch (error) { setErrorText(error instanceof Error ? error.message : t('Mitglied konnte nicht gespeichert werden.', 'Member could not be saved.')) } }
  async function submitPayer(event: React.FormEvent): Promise<void> { event.preventDefault(); try { await addHouseholdPayer({ householdId: payerForm.householdId, name: payerForm.name, type: 'external', linkedMemberId: '' }); setPayerOpen(false); setPayerForm({ householdId: selectedHouseholdId, name: '' }); setErrorText('') } catch (error) { setErrorText(error instanceof Error ? error.message : t('Zahler konnte nicht gespeichert werden.', 'Payer could not be saved.')) } }
  async function submitCost(event: React.FormEvent): Promise<void> {
    event.preventDefault()
    try {
      const payload = { householdId: costForm.householdId, title: costForm.title, category: costForm.category, subcategory: costForm.subcategory, amount: Number(costForm.amount), frequency: costForm.frequency, startDate: costForm.startDate, endDate: null, payerId: costForm.payerId || null, responsibleMemberId: null, isShared: costForm.isShared, splitType: costForm.splitType, notes: '', status: 'active' as const }
      if (editCostId) {
        const retainedSplits = householdCostSplits.filter((split) => split.costId === editCostId).map((split) => ({ memberId: split.memberId, sharePercent: split.sharePercent, shareAmount: split.shareAmount }))
        await updateHouseholdCost(editCostId, payload, retainedSplits, { effectiveFrom: effectiveFromDate })
      } else {
        await addHouseholdCost(payload, [])
      }
      setCostOpen(false); setEditCostId(null); setEffectiveFromDate(todayString()); setCostForm(buildDefaultCostForm(selectedHouseholdId)); setErrorText('')
    } catch (error) {
      setErrorText(error instanceof Error ? error.message : t('Kosten konnten nicht gespeichert werden.', 'Costs could not be saved.'))
    }
  }

  async function confirmDelete(): Promise<void> {
    if (!deleteTarget) return
    if (deleteTarget.kind === 'household') await deleteHousehold(deleteTarget.id)
    if (deleteTarget.kind === 'member') await deleteHouseholdMember(deleteTarget.id)
    if (deleteTarget.kind === 'payer') await deleteHouseholdPayer(deleteTarget.id)
    if (deleteTarget.kind === 'cost') await deleteHouseholdCost(deleteTarget.id)
    setDeleteTarget(null)
  }

  return (
    <section className="page">
      <header className="page-header">
        <div className="page-title-actions">
          <h1>{t('Haushaltskosten', 'Household costs')}</h1>
          <button type="button" className="button button-primary" onClick={() => { setHouseholdOpen(true); setHouseholdForm({ name: '', type: 'rental', currency: settings.currency, billingStart: todayString() }) }}>{t('Haushalt hinzufügen', 'Add household')}</button>
          <button type="button" className="button button-secondary" onClick={() => { setMemberOpen(true); setMemberForm({ householdId: selectedHouseholdId, name: '', role: '', activeFrom: todayString() }) }} disabled={!selectedHouseholdId}>{t('Mitglied hinzufügen', 'Add member')}</button>
          <button type="button" className="button button-secondary" onClick={() => { setPayerOpen(true); setPayerForm({ householdId: selectedHouseholdId, name: '' }) }} disabled={!selectedHouseholdId}>{t('Externer Zahler', 'External payer')}</button>
          <button type="button" className="button button-secondary" onClick={() => { setEditCostId(null); setEffectiveFromDate(todayString()); setCostOpen(true); setCostForm(buildDefaultCostForm(selectedHouseholdId)) }} disabled={!selectedHouseholdId}>{t('Kosten hinzufügen', 'Add cost')}</button>
        </div>
        <div className="page-actions"><input value={uiState.globalSearch} onChange={(event) => setUiState({ globalSearch: event.target.value })} placeholder={t('Haushaltskosten suchen...', 'Search household costs...')} /></div>
      </header>

      <article className="card">
        <header className="section-header">
          <h2>{t('Haushalt', 'Household')}</h2>
          <div className="filters">
            <select value={selectedHouseholdId} onChange={(event) => setSelectedHouseholdId(event.target.value)}>{sortedHouseholds.map((h) => <option key={h.id} value={h.id}>{h.name}</option>)}</select>
            {selectedHousehold ? <button type="button" className="button button-danger" onClick={() => setDeleteTarget({ kind: 'household', id: selectedHousehold.id, label: selectedHousehold.name })}>{t('Löschen', 'Delete')}</button> : null}
          </div>
        </header>
      </article>

      <div className="stats-grid">
        <article className="card stat-card"><p className="muted">{t('Gesamtkosten (monatlich)', 'Total costs (monthly)')}</p><p className="stat-value">{formatMoney(monthlyGross, settings.currency, settings.privacyHideAmounts)}</p></article>
        <article className="card stat-card"><p className="muted">{t('Von Bewohnern zu tragen', 'Resident share')}</p><p className="stat-value">{formatMoney(monthlyResidents, settings.currency, settings.privacyHideAmounts)}</p></article>
        <article className="card stat-card"><p className="muted">{t('Extern bezahlt', 'Paid by externals')}</p><p className="stat-value">{formatMoney(monthlyExternal, settings.currency, settings.privacyHideAmounts)}</p></article>
        <article className="card stat-card"><p className="muted">{t('Bewohner', 'Residents')}</p><p className="stat-value">{members.length}</p></article>
      </div>

      <div className="two-column two-column-equal">
        <article className="card"><h2>{t('Kategorienverteilung', 'Category breakdown')}</h2><DonutChart data={categorySeries} language={settings.language} /></article>
        <article className="card"><h2>{t('Anteil je Bewohner', 'Share per resident')}</h2><BarChart data={memberSeries} language={settings.language} valueFormatter={(value) => formatMoney(value, settings.currency, settings.privacyHideAmounts)} /></article>
      </div>
      <article className="card"><h2>{t('Trend (12 Monate)', 'Trend (12 months)')}</h2><LineChart data={trend} language={settings.language} /></article>

      <article className="card">
        <h2>{t('Kostenübersicht', 'Cost overview')}</h2>
        <div className="table-wrap"><table><thead><tr><th>{t('Titel', 'Title')}</th><th>{t('Kategorie', 'Category')}</th><th>{t('Intervall', 'Frequency')}</th><th>{t('Zahler', 'Payer')}</th><th>{t('Monatlich', 'Monthly')}</th><th>{t('Aktionen', 'Actions')}</th></tr></thead><tbody>
          {tableCosts.map((cost) => (
            <tr key={cost.id}>
              <td><strong>{cost.title}</strong></td>
              <td>{CATEGORY_LABELS[cost.category]?.[language] ?? cost.category} · {SUBCATEGORY_LABELS[cost.subcategory]?.[language] ?? cost.subcategory}</td>
              <td>{FREQUENCIES.find((f) => f.value === cost.frequency)?.[language] ?? cost.frequency}</td>
              <td>{cost.payerId ? (payerLabelById.get(cost.payerId) ?? t('Unbekannt', 'Unknown')) : t('Haushalt', 'Household')}</td>
              <td>{formatMoney(monthlyEquivalentHouseholdCost(cost), settings.currency, settings.privacyHideAmounts)}</td>
              <td>
                <div className="row-actions">
                  <button type="button" className="button button-tertiary" onClick={() => { setEditCostId(cost.id); setEffectiveFromDate(todayString()); setCostForm({ householdId: cost.householdId, title: cost.title, category: cost.category, subcategory: cost.subcategory, amount: cost.amount, frequency: cost.frequency, startDate: cost.startDate, payerId: cost.payerId ?? '', isShared: cost.isShared, splitType: cost.splitType }); setCostOpen(true) }}>{t('Bearbeiten', 'Edit')}</button>
                  <button type="button" className="button button-danger" onClick={() => setDeleteTarget({ kind: 'cost', id: cost.id, label: cost.title })}>{t('Löschen', 'Delete')}</button>
                </div>
              </td>
            </tr>
          ))}
        </tbody></table>{tableCosts.length === 0 ? <p className="empty-inline table-empty-message">{t('Keine Kosten für die aktuelle Auswahl.', 'No costs for current selection.')}</p> : null}</div>
      </article>

      <div className="two-column two-column-equal">
        <article className="card"><h2>{t('Bewohner', 'Residents')}</h2><ul className="clean-list">{members.map((member) => <li key={member.id}><div><strong>{member.name}</strong><small>{member.role || t('Ohne Rolle', 'No role')}</small></div><button type="button" className="button button-danger" onClick={() => setDeleteTarget({ kind: 'member', id: member.id, label: member.name })}>{t('Löschen', 'Delete')}</button></li>)}</ul></article>
        <article className="card"><h2>{t('Zahler', 'Payers')}</h2><ul className="clean-list">{payers.map((payer) => <li key={payer.id}><div><strong>{payer.name}</strong><small>{payer.type === 'external' ? t('Extern', 'External') : t('Bewohner', 'Resident')}</small></div>{payer.type === 'external' ? <button type="button" className="button button-danger" onClick={() => setDeleteTarget({ kind: 'payer', id: payer.id, label: payer.name })}>{t('Löschen', 'Delete')}</button> : null}</li>)}</ul></article>
      </div>

      {householdOpen ? <div className="form-modal-backdrop" onMouseDown={householdClose.onBackdropMouseDown} onClick={householdClose.onBackdropClick} role="presentation"><article className="card form-modal" onMouseDownCapture={householdClose.onModalMouseDownCapture} onClick={(event) => event.stopPropagation()}><header className="section-header"><h2>{t('Haushalt hinzufügen', 'Add household')}</h2><button type="button" className="icon-button" onClick={closeHousehold}>x</button></header>{errorText ? <p className="error-text">{errorText}</p> : null}<form className="form-grid" onSubmit={(event) => void submitHousehold(event)}><label>{t('Name', 'Name')}<input value={householdForm.name} onChange={(event) => setHouseholdForm((cur) => ({ ...cur, name: event.target.value }))} required /></label><label>{t('Typ', 'Type')}<select value={householdForm.type} onChange={(event) => setHouseholdForm((cur) => ({ ...cur, type: event.target.value as HouseholdType }))}>{HOUSEHOLD_TYPES.map((opt) => <option key={opt.value} value={opt.value}>{opt[language]}</option>)}</select></label><label>{t('Währung', 'Currency')}<select value={householdForm.currency} onChange={(event) => setHouseholdForm((cur) => ({ ...cur, currency: event.target.value as 'EUR' | 'USD' }))}><option value="EUR">EUR</option><option value="USD">USD</option></select></label><label>{t('Abrechnungsstart', 'Billing start')}<input type="date" value={householdForm.billingStart} onChange={(event) => setHouseholdForm((cur) => ({ ...cur, billingStart: event.target.value }))} required /></label><div className="form-actions full-width"><button type="submit" className="button button-primary">{t('Speichern', 'Save')}</button><button type="button" className="button button-secondary" onClick={closeHousehold}>{t('Abbrechen', 'Cancel')}</button></div></form></article></div> : null}

      {memberOpen ? <div className="form-modal-backdrop" onMouseDown={memberClose.onBackdropMouseDown} onClick={memberClose.onBackdropClick} role="presentation"><article className="card form-modal" onMouseDownCapture={memberClose.onModalMouseDownCapture} onClick={(event) => event.stopPropagation()}><header className="section-header"><h2>{t('Mitglied hinzufügen', 'Add member')}</h2><button type="button" className="icon-button" onClick={closeMember}>x</button></header>{errorText ? <p className="error-text">{errorText}</p> : null}<form className="form-grid" onSubmit={(event) => void submitMember(event)}><label>{t('Haushalt', 'Household')}<select value={memberForm.householdId} onChange={(event) => setMemberForm((cur) => ({ ...cur, householdId: event.target.value }))}>{sortedHouseholds.map((h) => <option key={h.id} value={h.id}>{h.name}</option>)}</select></label><label>{t('Name', 'Name')}<input value={memberForm.name} onChange={(event) => setMemberForm((cur) => ({ ...cur, name: event.target.value }))} required /></label><label>{t('Rolle', 'Role')}<input value={memberForm.role} onChange={(event) => setMemberForm((cur) => ({ ...cur, role: event.target.value }))} /></label><label>{t('Aktiv ab', 'Active from')}<input type="date" value={memberForm.activeFrom} onChange={(event) => setMemberForm((cur) => ({ ...cur, activeFrom: event.target.value }))} required /></label><div className="form-actions full-width"><button type="submit" className="button button-primary">{t('Speichern', 'Save')}</button><button type="button" className="button button-secondary" onClick={closeMember}>{t('Abbrechen', 'Cancel')}</button></div></form></article></div> : null}

      {payerOpen ? <div className="form-modal-backdrop" onMouseDown={payerClose.onBackdropMouseDown} onClick={payerClose.onBackdropClick} role="presentation"><article className="card form-modal" onMouseDownCapture={payerClose.onModalMouseDownCapture} onClick={(event) => event.stopPropagation()}><header className="section-header"><h2>{t('Externer Zahler', 'External payer')}</h2><button type="button" className="icon-button" onClick={closePayer}>x</button></header>{errorText ? <p className="error-text">{errorText}</p> : null}<form className="form-grid" onSubmit={(event) => void submitPayer(event)}><label>{t('Haushalt', 'Household')}<select value={payerForm.householdId} onChange={(event) => setPayerForm((cur) => ({ ...cur, householdId: event.target.value }))}>{sortedHouseholds.map((h) => <option key={h.id} value={h.id}>{h.name}</option>)}</select></label><label>{t('Name', 'Name')}<input value={payerForm.name} onChange={(event) => setPayerForm((cur) => ({ ...cur, name: event.target.value }))} required /></label><div className="form-actions full-width"><button type="submit" className="button button-primary">{t('Speichern', 'Save')}</button><button type="button" className="button button-secondary" onClick={closePayer}>{t('Abbrechen', 'Cancel')}</button></div></form></article></div> : null}

      {costOpen ? <div className="form-modal-backdrop" onMouseDown={costClose.onBackdropMouseDown} onClick={costClose.onBackdropClick} role="presentation"><article className="card form-modal" onMouseDownCapture={costClose.onModalMouseDownCapture} onClick={(event) => event.stopPropagation()}><header className="section-header"><h2>{editCostId ? t('Kosten bearbeiten', 'Edit cost') : t('Kosten hinzufügen', 'Add cost')}</h2><button type="button" className="icon-button" onClick={closeCost}>x</button></header>{errorText ? <p className="error-text">{errorText}</p> : null}<form className="form-grid" onSubmit={(event) => void submitCost(event)}><label>{t('Haushalt', 'Household')}<select value={costForm.householdId} onChange={(event) => setCostForm((cur) => ({ ...cur, householdId: event.target.value }))}>{sortedHouseholds.map((h) => <option key={h.id} value={h.id}>{h.name}</option>)}</select></label><label>{t('Titel', 'Title')}<input value={costForm.title} onChange={(event) => setCostForm((cur) => ({ ...cur, title: event.target.value }))} required /></label><label>{t('Kategorie', 'Category')}<select value={costForm.category} onChange={(event) => { const category = event.target.value; setCostForm((cur) => ({ ...cur, category, subcategory: defaultSubcategory(category) })) }}>{Object.keys(HOUSEHOLD_CATEGORY_SUBCATEGORIES).map((category) => <option key={category} value={category}>{CATEGORY_LABELS[category]?.[language] ?? category}</option>)}</select></label><label>{t('Unterkategorie', 'Subcategory')}<select value={costForm.subcategory} onChange={(event) => setCostForm((cur) => ({ ...cur, subcategory: event.target.value }))}>{(HOUSEHOLD_CATEGORY_SUBCATEGORIES[costForm.category] ?? ['Other']).map((sub) => <option key={sub} value={sub}>{SUBCATEGORY_LABELS[sub]?.[language] ?? sub}</option>)}</select></label><label>{t('Betrag', 'Amount')}<input type="number" min={0} step="0.01" value={Number.isFinite(costForm.amount) ? costForm.amount : ''} onChange={(event) => setCostForm((cur) => ({ ...cur, amount: parseFloat(event.target.value) || Number.NaN }))} required /></label><label>{t('Intervall', 'Frequency')}<select value={costForm.frequency} onChange={(event) => setCostForm((cur) => ({ ...cur, frequency: event.target.value as HouseholdCostFrequency }))}>{FREQUENCIES.map((freq) => <option key={freq.value} value={freq.value}>{freq[language]}</option>)}</select></label><label>{t('Startdatum', 'Start date')}<input type="date" value={costForm.startDate} onChange={(event) => setCostForm((cur) => ({ ...cur, startDate: event.target.value }))} required /></label><label>{t('Zahler', 'Payer')}<select value={costForm.payerId} onChange={(event) => setCostForm((cur) => ({ ...cur, payerId: event.target.value }))}><option value="">{t('Haushalt (kein externer Zahler)', 'Household (no external payer)')}</option>{modalPayers.map((payer) => <option key={payer.id} value={payer.id}>{payer.name} · {payer.type === 'external' ? t('Extern', 'External') : t('Bewohner', 'Resident')}</option>)}</select></label>{editCostId ? <label>{t('Änderung wirksam ab', 'Change effective from')}<input type="date" value={effectiveFromDate} onChange={(event) => setEffectiveFromDate(event.target.value)} required /></label> : null}<label className="switch"><input type="checkbox" checked={costForm.isShared} onChange={(event) => setCostForm((cur) => ({ ...cur, isShared: event.target.checked }))} /><span>{t('Kosten aufteilen', 'Split costs')}</span></label>{costForm.isShared ? <label>{t('Aufteilungsart', 'Split type')}<select value={costForm.splitType} onChange={(event) => setCostForm((cur) => ({ ...cur, splitType: event.target.value as HouseholdSplitType }))}>{SPLIT_TYPES.map((split) => <option key={split.value} value={split.value}>{split[language]}</option>)}</select></label> : null}<div className="form-actions full-width"><button type="submit" className="button button-primary">{editCostId ? t('Aktualisieren', 'Update') : t('Speichern', 'Save')}</button><button type="button" className="button button-secondary" onClick={closeCost}>{t('Abbrechen', 'Cancel')}</button></div></form></article></div> : null}

      {deleteTarget ? <div className="form-modal-backdrop" onMouseDown={deleteClose.onBackdropMouseDown} onClick={deleteClose.onBackdropClick} role="presentation"><article className="card form-modal confirm-modal" onMouseDownCapture={deleteClose.onModalMouseDownCapture} onClick={(event) => event.stopPropagation()}><header className="section-header"><h2>{t('Löschen bestätigen', 'Confirm delete')}</h2><button type="button" className="icon-button" onClick={closeDelete}>x</button></header><p>{t('Möchtest du wirklich löschen:', 'Do you really want to delete:')} "{deleteTarget.label}"?</p><div className="form-actions"><button type="button" className="button button-danger" onClick={() => void confirmDelete()}>{t('Löschen', 'Delete')}</button><button type="button" className="button button-secondary" onClick={closeDelete}>{t('Abbrechen', 'Cancel')}</button></div></article></div> : null}
    </section>
  )
}

