const DEFAULT_MONEY_DECIMALS = 2

export function formatMoney(value: number, currency: string, masked: boolean): string {
  if (masked) {
    return '****'
  }
  return new Intl.NumberFormat(undefined, {
    style: 'currency',
    currency,
    minimumFractionDigits: DEFAULT_MONEY_DECIMALS,
    maximumFractionDigits: DEFAULT_MONEY_DECIMALS,
  }).format(value)
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

