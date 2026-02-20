const DEFAULT_MONEY_DECIMALS = 2
const SUPPORTED_CURRENCIES = ['EUR', 'USD'] as const

type SupportedCurrency = (typeof SUPPORTED_CURRENCIES)[number]

function normalizeCurrency(input: string): SupportedCurrency {
  const upper = input.toUpperCase()
  return SUPPORTED_CURRENCIES.includes(upper as SupportedCurrency) ? (upper as SupportedCurrency) : 'EUR'
}

export function formatMoney(value: number, currency: string, masked: boolean): string {
  if (masked) {
    return '****'
  }
  const safeCurrency = normalizeCurrency(currency)
  return new Intl.NumberFormat(undefined, {
    style: 'currency',
    currency: safeCurrency,
    minimumFractionDigits: DEFAULT_MONEY_DECIMALS,
    maximumFractionDigits: DEFAULT_MONEY_DECIMALS,
  }).format(value)
}

export function getCurrencySymbol(currency: string): string {
  const safeCurrency = normalizeCurrency(currency)
  const parts = new Intl.NumberFormat(undefined, {
    style: 'currency',
    currency: safeCurrency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).formatToParts(0)
  return parts.find((part) => part.type === 'currency')?.value ?? safeCurrency
}

export function formatNumber(value: number, decimals = 2): string {
  return new Intl.NumberFormat(undefined, {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(value)
}

export function toPercent(value: number, decimals = 1): string {
  return `${formatNumber(value, decimals)}%`
}

export function median(values: number[]): number {
  if (values.length === 0) {
    return 0
  }
  const sorted = [...values].sort((a, b) => a - b)
  const middle = Math.floor(sorted.length / 2)
  if (sorted.length % 2 === 0) {
    return (sorted[middle - 1] + sorted[middle]) / 2
  }
  return sorted[middle]
}
