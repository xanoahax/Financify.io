import type { ToastMessage } from '../types/models'

interface ToastHostProps {
  toasts: ToastMessage[]
  onDismiss: (id: string) => void
}

export function ToastHost({ toasts, onDismiss }: ToastHostProps): JSX.Element {
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
            <button type="button" className="icon-button" onClick={() => onDismiss(toast.id)} aria-label="Benachrichtigung schließen">
              x
            </button>
          </div>
        </div>
      ))}
    </div>
  )
}

