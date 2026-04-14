import { Link } from 'react-router-dom'
import { CopyButton } from '../CopyButton'

export function CreateOrderSuccess({
  txHash,
  explorerUrl,
  onReset,
}: {
  txHash?: `0x${string}`
  explorerUrl?: string
  onReset: () => void
}) {
  return (
    <section className="ticket-panel mx-auto max-w-2xl text-center" role="status" aria-live="polite">
      <span className="status-pill status-active mx-auto mb-4">
        <span aria-hidden="true">{'\u2713'}</span> Order Created
      </span>
      <h1 className="workspace-title">Your OTC order is live.</h1>
      <p className="workspace-copy mx-auto">
        The transaction has been confirmed on-chain.
      </p>

      {txHash && (
        <div className="token-panel mt-6 text-left">
          <div className="eyebrow">Transaction Hash</div>
          <div className="mt-2 inline-flex items-center gap-2 break-all text-sm font-medium text-[var(--text-strong)]">
            <span className="numeric">{txHash}</span>
            <CopyButton value={txHash} label="Copy transaction hash" />
          </div>
        </div>
      )}

      <div className="mt-6 flex flex-wrap justify-center gap-2">
        <button type="button" onClick={onReset} className="primary-button">
          Create Another Order
        </button>
        {explorerUrl && (
          <a
            href={explorerUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="secondary-button"
          >
            View on Explorer ↗
          </a>
        )}
        <Link to="/" className="ghost-button">Back to Order Book</Link>
        <Link to="/my-orders" className="ghost-button">View My Orders</Link>
      </div>
    </section>
  )
}
