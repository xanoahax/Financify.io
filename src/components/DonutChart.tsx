interface DonutSlice {
  label: string
  value: number
}

interface DonutChartProps {
  data: DonutSlice[]
}

const palette = ['#0a84ff', '#2ec4b6', '#ff9f0a', '#30d158', '#bf5af2', '#ff375f', '#64d2ff']

export function DonutChart({ data }: DonutChartProps): JSX.Element {
  if (data.length === 0) {
    return <p className="empty-inline">Noch keine Daten vorhanden.</p>
  }

  const total = data.reduce((sum, item) => sum + item.value, 0)
  const radius = 54
  const circumference = 2 * Math.PI * radius
  const slices = data.reduce<Array<{ label: string; ratio: number; offsetRatio: number }>>((acc, current) => {
    const consumedRatio = acc.length === 0 ? 0 : acc[acc.length - 1].offsetRatio + acc[acc.length - 1].ratio
    acc.push({ label: current.label, ratio: current.value / total, offsetRatio: consumedRatio })
    return acc
  }, [])

  return (
    <div className="chart chart-donut">
      <svg width="140" height="140" viewBox="0 0 140 140" role="img" aria-label="Donut-Diagramm">
        <g transform="translate(70,70) rotate(-90)">
          <circle cx="0" cy="0" r={radius} className="donut-track" />
          {slices.map((slice, index) => {
            const dashLength = slice.ratio * circumference
            const dashOffset = -slice.offsetRatio * circumference
            return (
              <circle
                key={slice.label}
                cx="0"
                cy="0"
                r={radius}
                className="donut-slice"
                stroke={palette[index % palette.length]}
                strokeDasharray={`${dashLength} ${circumference - dashLength}`}
                strokeDashoffset={dashOffset}
              />
            )
          })}
        </g>
      </svg>
      <ul className="donut-legend">
        {data.map((slice, index) => (
          <li key={slice.label}>
            <span style={{ backgroundColor: palette[index % palette.length] }} />
            <strong>{slice.label}</strong>
            <small>{((slice.value / total) * 100).toFixed(0)}%</small>
          </li>
        ))}
      </ul>
    </div>
  )
}
