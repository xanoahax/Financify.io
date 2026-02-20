interface LineChartPoint {
  label: string
  value: number
}

interface LineChartProps {
  data: LineChartPoint[]
  height?: number
}

export function LineChart({ data, height = 180 }: LineChartProps): JSX.Element {
  if (data.length === 0) {
    return <p className="empty-inline">Noch keine Daten vorhanden.</p>
  }

  const width = 640
  const chartHeight = height
  const pointRadius = 3.5
  const paddingX = pointRadius + 5
  const paddingY = pointRadius + 5
  const plotWidth = Math.max(width - paddingX * 2, 1)
  const plotHeight = Math.max(chartHeight - paddingY * 2, 1)
  const maxValue = Math.max(...data.map((point) => point.value), 1)
  const minValue = Math.min(...data.map((point) => point.value), 0)
  const range = maxValue - minValue || 1

  const points = data.map((point, index) => {
    const ratio = data.length === 1 ? 0.5 : index / Math.max(data.length - 1, 1)
    const x = paddingX + ratio * plotWidth
    const normalized = (point.value - minValue) / range
    const y = paddingY + (1 - normalized) * plotHeight
    return `${x},${y}`
  })

  const path = `M ${points.join(' L ')}`

  return (
    <div className="chart chart-line">
      <svg viewBox={`0 0 ${width} ${chartHeight}`} role="img" aria-label="Liniendiagramm">
        <path d={path} className="line-path" />
        {points.map((point, index) => {
          const [x, y] = point.split(',').map(Number)
          return <circle key={data[index].label} cx={x} cy={y} r={pointRadius} className="line-point" />
        })}
      </svg>
      <div className="chart-labels">
        <span>{data[0]?.label}</span>
        <span>{data[Math.floor(data.length / 2)]?.label}</span>
        <span>{data[data.length - 1]?.label}</span>
      </div>
    </div>
  )
}
