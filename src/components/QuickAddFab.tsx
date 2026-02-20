import { useState } from 'react'

interface QuickAddFabProps {
  onAddSubscription: () => void
  onAddIncome: () => void
}

export function QuickAddFab({ onAddIncome, onAddSubscription }: QuickAddFabProps): JSX.Element {
  const [open, setOpen] = useState(false)
  return (
    <div className={`quick-fab ${open ? 'open' : ''}`}>
      {open ? (
        <div className="quick-fab-menu">
          <button type="button" className="button button-secondary" onClick={onAddSubscription}>
            + Abo
          </button>
          <button type="button" className="button button-secondary" onClick={onAddIncome}>
            + Einkommen
          </button>
        </div>
      ) : null}
      <button type="button" className="button button-primary fab-main" onClick={() => setOpen((current) => !current)} aria-label="Schnell hinzufügen">
        +
      </button>
    </div>
  )
}
