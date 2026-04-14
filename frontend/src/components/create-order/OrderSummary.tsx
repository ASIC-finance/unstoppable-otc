import { shortenAddress } from '../../utils/format'

export function OrderSummary({
  walletAddress,
  sellSummary,
  buySummary,
  pairSummary,
  allowanceSummary,
}: {
  walletAddress?: `0x${string}`
  sellSummary: string
  buySummary: string
  pairSummary: string
  allowanceSummary: string
}) {
  return (
    <aside className="ticket-summary" aria-label="Order summary">
      <div>
        <p className="eyebrow">Ticket Summary</p>
        <h2 className="m-0 text-lg font-extrabold text-[var(--text-strong)]">Pre-trade checks</h2>
      </div>
      <Row label="Wallet" value={walletAddress ? shortenAddress(walletAddress) : 'Not Connected'} />
      <Row label="Selling" value={sellSummary} />
      <Row label="Receiving" value={buySummary} />
      <Row label="Pair" value={pairSummary} />
      <Row label="Allowance" value={allowanceSummary} />
    </aside>
  )
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="summary-row">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  )
}
