import type { IncomeEntry, Subscription } from '../types/models'

function escapeCsv(value: string | number): string {
  const raw = String(value)
  if (raw.includes(',') || raw.includes('"') || raw.includes('\n')) {
    return `"${raw.replaceAll('"', '""')}"`
  }
  return raw
}

function toRows(headers: string[], rows: Array<Array<string | number>>): string {
  const headerLine = headers.map(escapeCsv).join(',')
  const rowLines = rows.map((row) => row.map(escapeCsv).join(','))
  return [headerLine, ...rowLines].join('\n')
}

export function subscriptionsToCsv(subscriptions: Subscription[]): string {
  const headers = [
    'id',
    'name',
    'provider',
    'category',
    'tags',
    'amount',
    'currency',
    'interval',
    'customIntervalMonths',
    'startDate',
    'nextPaymentOverride',
    'noticePeriodDays',
    'notes',
    'link',
    'status',
    'endDate',
    'createdAt',
    'updatedAt',
  ]

  const rows = subscriptions.map((item) => [
    item.id,
    item.name,
    item.provider,
    item.category,
    item.tags.join('|'),
    item.amount,
    item.currency ?? '',
    item.interval,
    item.customIntervalMonths ?? '',
    item.startDate,
    item.nextPaymentOverride ?? '',
    item.noticePeriodDays,
    item.notes,
    item.link,
    item.status,
    item.endDate ?? '',
    item.createdAt,
    item.updatedAt,
  ])

  return toRows(headers, rows)
}

export function incomesToCsv(entries: IncomeEntry[]): string {
  const headers = ['id', 'amount', 'date', 'source', 'tags', 'notes', 'recurring', 'recurringIntervalDays', 'createdAt', 'updatedAt']

  const rows = entries.map((item) => [
    item.id,
    item.amount,
    item.date,
    item.source,
    item.tags.join('|'),
    item.notes,
    item.recurring,
    item.recurringIntervalDays ?? '',
    item.createdAt,
    item.updatedAt,
  ])

  return toRows(headers, rows)
}

export function triggerDownload(fileName: string, content: string, mimeType: string): void {
  const blob = new Blob([content], { type: mimeType })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = fileName
  document.body.append(anchor)
  anchor.click()
  anchor.remove()
  URL.revokeObjectURL(url)
}

