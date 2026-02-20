import type { AppLanguage } from '../types/models'
import { tx } from '../utils/i18n'

interface BarChartPoint {
  label: string
  value: number
}

interface BarChartProps {
  data: BarChartPoint[]
  language?: AppLanguage
}

export function BarChart({ data, language = 'de' }: BarChartProps): JSX.Element {
  const t = (de: string, en: string) => tx(language, de, en)

  if (data.length === 0) {
    return <p className="empty-inline">{t('Noch keine Daten vorhanden.', 'No data available yet.')}</p>
  }

  const max = Math.max(...data.map((item) => item.value), 1)
  return (
    <div className="chart chart-bars">
      {data.map((item) => (
        <div key={item.label} className="bar-row">
          <span className="bar-label">{item.label}</span>
          <div className="bar-track">
            <div className="bar-fill" style={{ width: `${(item.value / max) * 100}%` }} />
          </div>
          <span className="bar-value">{item.value.toFixed(0)}</span>
        </div>
      ))}
    </div>
  )
}
