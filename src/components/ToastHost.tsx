import type { AppLanguage, ToastMessage } from '../types/models'
import { tx } from '../utils/i18n'

interface ToastHostProps {
  toasts: ToastMessage[]
  onDismiss: (id: string) => void
  language: AppLanguage
}

export function ToastHost({ toasts, onDismiss, language }: ToastHostProps): JSX.Element {
  const t = (de: string, en: string) => tx(language, de, en)

  return (
    <div className="toast-host" aria-live="polite">
      {toasts.map((toast) => (
        <div className={`toast toast-${toast.tone}`} key={toast.id}>
          <p>{toast.text}</p>
          <div className="toast-actions">
            {toast.action && toast.actionLabel ? (
              <button
                type="button"
                className="button button-tertiary"
                onClick={() => {
                  toast.action?.()
                  onDismiss(toast.id)
                }}
              >
                {toast.actionLabel}
              </button>
            ) : null}
            <button
              type="button"
              className="icon-button"
              onClick={() => onDismiss(toast.id)}
              aria-label={t('Benachrichtigung schließen', 'Close notification')}
            >
              x
            </button>
          </div>
        </div>
      ))}
    </div>
  )
}
