import type { ReactNode } from 'react'

interface StatCardProps {
  label: string
  value: string
  hint?: string
  action?: ReactNode
}

export function StatCard({ label, value, hint, action }: StatCardProps): JSX.Element {
  return (
    <article className="card stat-card">
      <header>
        <p className="muted">{label}</p>
        {action}
      </header>
      <p className="stat-value">{value}</p>
      {hint ? <p className="hint">{hint}</p> : null}
    </article>
  )
}

