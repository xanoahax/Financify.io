export const TREND_GRADIENT_STOPS = [
  { offset: 0, color: '#59f25c' },
  { offset: 0.34, color: '#c7ee4b' },
  { offset: 0.62, color: '#ffb12a' },
  { offset: 1, color: '#ff5f3c' },
]

function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const normalized = hex.replace('#', '')

  return {
    r: Number.parseInt(normalized.slice(0, 2), 16),
    g: Number.parseInt(normalized.slice(2, 4), 16),
    b: Number.parseInt(normalized.slice(4, 6), 16),
  }
}

function rgbToHex({ r, g, b }: { r: number; g: number; b: number }): string {
  const clampChannel = (value: number) => Math.max(0, Math.min(255, Math.round(value)))

  return `#${[r, g, b]
    .map((channel) => clampChannel(channel).toString(16).padStart(2, '0'))
    .join('')}`
}

function mixColor(start: string, end: string, ratio: number): string {
  const safeRatio = Math.max(0, Math.min(1, ratio))
  const from = hexToRgb(start)
  const to = hexToRgb(end)

  return rgbToHex({
    r: from.r + (to.r - from.r) * safeRatio,
    g: from.g + (to.g - from.g) * safeRatio,
    b: from.b + (to.b - from.b) * safeRatio,
  })
}

export function getTrendColorAt(progress: number): string {
  const safeProgress = Math.max(0, Math.min(1, progress))

  for (let index = 0; index < TREND_GRADIENT_STOPS.length - 1; index += 1) {
    const current = TREND_GRADIENT_STOPS[index]
    const next = TREND_GRADIENT_STOPS[index + 1]

    if (safeProgress <= next.offset) {
      const localRange = next.offset - current.offset || 1
      const localProgress = (safeProgress - current.offset) / localRange
      return mixColor(current.color, next.color, localProgress)
    }
  }

  return TREND_GRADIENT_STOPS[TREND_GRADIENT_STOPS.length - 1].color
}

export function getSeriesColorByValue(value: number, min: number, max: number, reverse = false): string {
  const range = max - min

  if (range <= 0) {
    return getTrendColorAt(0.5)
  }

  const normalized = (value - min) / range
  return getTrendColorAt(reverse ? normalized : 1 - normalized)
}
