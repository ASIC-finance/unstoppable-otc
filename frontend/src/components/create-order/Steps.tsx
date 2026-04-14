const STEP_LABELS = ['Sell Token', 'Sell Size', 'Buy Token', 'Review'] as const

export function Steps({ current }: { current: number }) {
  return (
    <ol className="ticket-steps" aria-label="Create order progress">
      {STEP_LABELS.map((label, i) => {
        const state = i < current ? 'done' : i === current ? 'current' : 'pending'
        return (
          <li
            key={label}
            className="ticket-step"
            data-state={state}
            aria-current={i === current ? 'step' : undefined}
          >
            <span className="ticket-step-index" aria-hidden="true">
              {i < current ? '\u2713' : i + 1}
            </span>
            <span className="truncate">{label}</span>
          </li>
        )
      })}
    </ol>
  )
}
