import { useState } from 'react'
import type { AppLanguage } from '../types/models'
import { tx } from '../utils/i18n'

interface QuickAddFabProps {
  onAddSubscription: () => void
  onAddIncome: () => void
  language: AppLanguage
}

export function QuickAddFab({ onAddIncome, onAddSubscription, language }: QuickAddFabProps): JSX.Element {
  const [open, setOpen] = useState(false)
  const t = (de: string, en: string) => tx(language, de, en)

  return (
    <div className={`quick-fab ${open ? 'open' : ''}`}>
      {open ? (
        <div className="quick-fab-menu">
          <button type="button" className="button button-secondary" onClick={onAddSubscription}>
            + {t('Abo', 'Subscription')}
          </button>
          <button type="button" className="button button-secondary" onClick={onAddIncome}>
            + {t('Einkommen', 'Income')}
          </button>
        </div>
      ) : null}
      <button
        type="button"
        className="button button-primary fab-main"
        onClick={() => setOpen((current) => !current)}
        aria-label={t('Schnell hinzufügen', 'Quick add')}
      >
        +
      </button>
    </div>
  )
}
