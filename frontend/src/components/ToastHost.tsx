import { toast, useToasts, type Toast } from '../lib/toast'

export function ToastHost() {
  const toasts = useToasts()

  return (
    <div
      className="toast-region"
      role="region"
      aria-label="Notifications"
      aria-live="polite"
    >
      {toasts.map(t => (
        <ToastCard key={t.id} toast={t} />
      ))}
    </div>
  )
}

function ToastCard({ toast: t }: { toast: Toast }) {
  return (
    <article className="toast-card" data-variant={t.variant} role="status">
      <div className="toast-icon" aria-hidden="true">
        {iconFor(t.variant)}
      </div>
      <div className="toast-body">
        <strong>{t.title}</strong>
        {t.message && <span>{t.message}</span>}
        {t.action && (
          <a
            href={t.action.href}
            target="_blank"
            rel="noopener noreferrer"
            className="toast-action"
          >
            {t.action.label} ↗
          </a>
        )}
      </div>
      <button
        type="button"
        className="toast-dismiss"
        aria-label="Dismiss notification"
        onClick={() => toast.dismiss(t.id)}
      >
        {'\u00D7'}
      </button>
    </article>
  )
}

function iconFor(variant: Toast['variant']): string {
  switch (variant) {
    case 'success': return '\u2713'
    case 'error': return '\u2715'
    case 'pending': return '\u25CB'
    default: return '\u2022'
  }
}
