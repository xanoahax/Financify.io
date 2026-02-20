interface BarChartPoint {
  label: string
  value: number
}

interface BarChartProps {
  data: BarChartPoint[]
}

export function BarChart({ data }: BarChartProps): JSX.Element {
  if (data.length === 0) {
    return <p className="empty-inline">Noch keine Daten vorhanden.</p>
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
