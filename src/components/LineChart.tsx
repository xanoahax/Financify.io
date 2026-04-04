import { useId, useState } from 'react'
import type { AppLanguage } from '../types/models'
import { TREND_GRADIENT_STOPS, getTrendColorAt } from '../utils/chartColors'
import { tx } from '../utils/i18n'

interface LineChartPoint {
  label: string
  value: number
}

interface PlotPoint extends LineChartPoint {
  x: number
  y: number
}

interface LineChartProps {
  data: LineChartPoint[]
  language?: AppLanguage
  valueFormatter?: (value: number) => string
  reverseColorScale?: boolean
}

const SVG_WIDTH = 640
const SVG_HEIGHT = 240
const PLOT_PADDING_X = 10
const PLOT_PADDING_TOP = 18
const PLOT_PADDING_BOTTOM = 24
const GRID_LINE_COUNT = 4
const SMOOTHING = 0.16

function createSmoothPath(points: PlotPoint[]): string {
  if (points.length === 0) {
    return ''
  }

  if (points.length === 1) {
    return `M ${points[0].x} ${points[0].y}`
  }

  const segments = [`M ${points[0].x} ${points[0].y}`]

  for (let index = 0; index < points.length - 1; index += 1) {
    const current = points[index]
    const next = points[index + 1]
    const previous = points[index - 1] ?? current
    const nextNext = points[index + 2] ?? next

    const cp1x = current.x + (next.x - previous.x) * SMOOTHING
    const cp1y = current.y + (next.y - previous.y) * SMOOTHING
    const cp2x = next.x - (nextNext.x - current.x) * SMOOTHING
    const cp2y = next.y - (nextNext.y - current.y) * SMOOTHING

    segments.push(`C ${cp1x} ${cp1y}, ${cp2x} ${cp2y}, ${next.x} ${next.y}`)
  }

  return segments.join(' ')
}

export function LineChart({ data, language = 'de', valueFormatter, reverseColorScale = false }: LineChartProps): JSX.Element {
  const t = (de: string, en: string) => tx(language, de, en)
  const [activeIndex, setActiveIndex] = useState<number | null>(null)
  const gradientId = useId().replace(/:/g, '')

  if (data.length === 0) {
    return <p className="empty-inline">{t('Noch keine Daten vorhanden.', 'No data available yet.')}</p>
  }

  const locale = language === 'de' ? 'de-DE' : 'en-US'
  const defaultValueFormatter = (value: number) =>
    new Intl.NumberFormat(locale, {
      minimumFractionDigits: value % 1 === 0 ? 0 : 2,
      maximumFractionDigits: 2,
    }).format(value)

  const plotWidth = SVG_WIDTH - PLOT_PADDING_X * 2
  const plotHeight = SVG_HEIGHT - PLOT_PADDING_TOP - PLOT_PADDING_BOTTOM
  const values = data.map((item) => item.value)
  const rawMin = Math.min(...values)
  const rawMax = Math.max(...values)
  const rawRange = rawMax - rawMin
  const visualPadding = rawRange === 0 ? Math.max(Math.abs(rawMax) * 0.12, 1) : rawRange * 0.14
  const min = rawMin - visualPadding
  const max = rawMax + visualPadding
  const range = Math.max(max - min, 1)
  const stepX = data.length > 1 ? plotWidth / (data.length - 1) : 0

  const points = data.map<PlotPoint>((item, index) => ({
    ...item,
    x: PLOT_PADDING_X + stepX * index,
    y: PLOT_PADDING_TOP + ((max - item.value) / range) * plotHeight,
  }))

  const path = createSmoothPath(points)
  const gradientStops = TREND_GRADIENT_STOPS.map((stop) => ({
    offset: stop.offset,
    color: getTrendColorAt(reverseColorScale ? 1 - stop.offset : stop.offset),
  }))
  const pointColor = (point: PlotPoint) =>
    getTrendColorAt(reverseColorScale ? 1 - (point.y - PLOT_PADDING_TOP) / plotHeight : (point.y - PLOT_PADDING_TOP) / plotHeight)
  const gridLines = Array.from({ length: GRID_LINE_COUNT }, (_, index) => ({
    id: index,
    y: PLOT_PADDING_TOP + (plotHeight / (GRID_LINE_COUNT - 1)) * index,
  }))
  const activePoint = activeIndex == null ? null : points[activeIndex]
  const activePointValue = activePoint == null ? '' : (valueFormatter ?? defaultValueFormatter)(activePoint.value)
  const tooltipWidth = Math.max(64, activePointValue.length * 8 + 24)
  const tooltipHeight = 34
  const tooltipX =
    activePoint == null
      ? 0
      : Math.min(Math.max(activePoint.x - tooltipWidth / 2, PLOT_PADDING_X), SVG_WIDTH - PLOT_PADDING_X - tooltipWidth)
  const tooltipY = activePoint == null ? 0 : Math.max(activePoint.y - 52, 8)

  return (
    <div className="chart chart-line">
      <svg
        className="line-chart-svg"
        viewBox={`0 0 ${SVG_WIDTH} ${SVG_HEIGHT}`}
        role="img"
        aria-label={t('Liniendiagramm', 'Line chart')}
        preserveAspectRatio="xMidYMid meet"
      >
        <defs>
          <linearGradient id={gradientId} x1={0} x2={0} y1={PLOT_PADDING_TOP} y2={PLOT_PADDING_TOP + plotHeight} gradientUnits="userSpaceOnUse">
            {gradientStops.map((stop) => (
              <stop key={stop.offset} offset={stop.offset} stopColor={stop.color} />
            ))}
          </linearGradient>
        </defs>
        <g aria-hidden="true">
          {gridLines.map((line) => (
            <line
              key={line.id}
              className="chart-grid-line"
              x1={PLOT_PADDING_X}
              x2={SVG_WIDTH - PLOT_PADDING_X}
              y1={line.y}
              y2={line.y}
            />
          ))}
        </g>
        <path className="line-path" d={path} stroke={`url(#${gradientId})`} />
        {activePoint ? (
          <g className="line-tooltip" aria-hidden="true">
            <rect className="line-tooltip-pill" x={tooltipX} y={tooltipY} width={tooltipWidth} height={tooltipHeight} rx="17" ry="17" />
            <text className="line-tooltip-value" x={tooltipX + tooltipWidth / 2} y={tooltipY + 21}>
              {activePointValue}
            </text>
          </g>
        ) : null}
        {points.map((point, index) => (
          <g key={point.label}>
            <circle className="line-point" cx={point.x} cy={point.y} r="3.8" fill={pointColor(point)} />
            <circle
              className="line-point-hit"
              cx={point.x}
              cy={point.y}
              r="12"
              tabIndex={0}
              aria-label={`${point.label}: ${(valueFormatter ?? defaultValueFormatter)(point.value)}`}
              onMouseEnter={() => setActiveIndex(index)}
              onMouseLeave={() => setActiveIndex((current) => (current === index ? null : current))}
              onFocus={() => setActiveIndex(index)}
              onBlur={() => setActiveIndex((current) => (current === index ? null : current))}
            />
          </g>
        ))}
      </svg>
      <div className="chart-labels">
        {data.map((item) => (
          <span key={item.label}>{item.label}</span>
        ))}
      </div>
    </div>
  )
}
