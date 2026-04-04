import type { AppLanguage } from '../types/models'
import { getSeriesColorByValue } from '../utils/chartColors'
import { tx } from '../utils/i18n'

interface DonutSlice {
  label: string
  value: number
}

interface DonutChartProps {
  data: DonutSlice[]
  language?: AppLanguage
  valueFormatter?: (value: number) => string
  reverseColorScale?: boolean
}

export function DonutChart({ data, language = 'de', valueFormatter, reverseColorScale = false }: DonutChartProps): JSX.Element {
  const t = (de: string, en: string) => tx(language, de, en)

  if (data.length === 0) {
    return <p className="empty-inline">{t('Noch keine Daten vorhanden.', 'No data available yet.')}</p>
  }

  const locale = language === 'de' ? 'de-DE' : 'en-US'
  const defaultValueFormatter = (value: number) =>
    new Intl.NumberFormat(locale, {
      minimumFractionDigits: value % 1 === 0 ? 0 : 2,
      maximumFractionDigits: 2,
    }).format(value)
  const total = data.reduce((sum, item) => sum + item.value, 0)
  const min = Math.min(...data.map((item) => item.value))
  const max = Math.max(...data.map((item) => item.value))
  const radius = 68
  const circumference = 2 * Math.PI * radius
  const slices = data.reduce<Array<{ label: string; ratio: number; offsetRatio: number }>>((acc, current) => {
    const consumedRatio = acc.length === 0 ? 0 : acc[acc.length - 1].offsetRatio + acc[acc.length - 1].ratio
    acc.push({ label: current.label, ratio: current.value / total, offsetRatio: consumedRatio })
    return acc
  }, [])

  return (
    <div className="chart chart-donut">
      <svg width="190" height="190" viewBox="0 0 190 190" role="img" aria-label={t('Donut-Diagramm', 'Donut chart')}>
        <g transform="translate(95,95) rotate(-90)">
          <circle cx="0" cy="0" r={radius} className="donut-track" />
          {slices.map((slice, index) => {
            const dashLength = slice.ratio * circumference
            const dashOffset = -slice.offsetRatio * circumference
            const sliceColor = getSeriesColorByValue(data[index].value, min, max, reverseColorScale)
            return (
              <circle
                key={slice.label}
                cx="0"
                cy="0"
                r={radius}
                className="donut-slice"
                stroke={sliceColor}
                strokeDasharray={`${dashLength} ${circumference - dashLength}`}
                strokeDashoffset={dashOffset}
              />
            )
          })}
        </g>
        <g className="donut-center" aria-hidden="true">
          <text className="donut-center-value" x="95" y="91">
            {(valueFormatter ?? defaultValueFormatter)(total)}
          </text>
          <text className="donut-center-label" x="95" y="112">
            {t('Gesamt', 'Total')}
          </text>
        </g>
      </svg>
      <ul className="donut-legend">
        {data.map((slice) => {
          const sliceColor = getSeriesColorByValue(slice.value, min, max, reverseColorScale)

          return (
          <li key={slice.label}>
            <div className="donut-legend-row">
              <div className="donut-legend-meta">
                <span style={{ backgroundColor: sliceColor }} />
                <strong>{slice.label}</strong>
              </div>
              <div className="donut-legend-values">
                <small>{(valueFormatter ?? defaultValueFormatter)(slice.value)}</small>
                <small>{((slice.value / total) * 100).toFixed(0)}%</small>
              </div>
            </div>
            <div className="donut-legend-track">
              <div
                className="donut-legend-fill"
                style={{
                  width: `${(slice.value / total) * 100}%`,
                  backgroundColor: sliceColor,
                }}
              />
            </div>
          </li>
        )})}
      </ul>
    </div>
  )
}
