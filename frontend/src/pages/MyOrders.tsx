import { useState } from 'react'
import { useAccount } from 'wagmi'
import { useMakerOrderCount, useMakerOrders, usePairTokens } from '../hooks/useOrders'
import { useAllPairsLength, useAllPairs } from '../hooks/useFactory'
import { useCancelOrder } from '../hooks/useCancelOrder'
import { OrderTable } from '../components/OrderTable'
import { TokenBadge } from '../components/TokenBadge'
import { shortenAddress } from '../utils/format'

const PAGE_SIZE = 50

function MyPairOrders({
  pairAddress,
  isExpanded,
  onToggle,
}: {
  pairAddress: `0x${string}`
  isExpanded: boolean
  onToggle: () => void
}) {
  const { address } = useAccount()
  const { token0, token1 } = usePairTokens(pairAddress)
  const { data: makerCount, refetch: refetchCount } = useMakerOrderCount(pairAddress, address)
  const count = Number(makerCount ?? 0n)

  const { data, isLoading, refetch: refetchOrders } = useMakerOrders(
    isExpanded ? pairAddress : undefined,
    address,
    0,
    PAGE_SIZE,
  )

  const refetch = () => {
    refetchOrders()
    refetchCount()
  }

  const { cancelOrder, isPending: isCancelling } = useCancelOrder(refetch)

  const orderIds = data ? [...data[0]] : []
  const orders = data ? [...data[1]] : []
  const panelId = `my-pair-${pairAddress.toLowerCase()}`

  if (count === 0) return null

  return (
    <section className="pair-row" data-selected={isExpanded}>
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={isExpanded}
        aria-controls={isExpanded ? panelId : undefined}
        className="pair-row-button"
      >
        <div className="pair-main">
          <div className="pair-heading">
            <span className="eyebrow mb-0">Maker Inventory</span>
            <span className="status-pill status-active">
              <span className="numeric">{count}</span> live order{count === 1 ? '' : 's'}
            </span>
            <span className="pair-address">{shortenAddress(pairAddress)}</span>
          </div>

          <div className="pair-route">
            {token0 && <TokenBadge address={token0} />}
            <span className="text-sm font-semibold text-[var(--text-muted)]">/</span>
            {token1 && <TokenBadge address={token1} />}
          </div>
        </div>

        <div className="pair-sidecar">
          <span className="text-sm font-semibold text-[var(--text-soft)]">
            {isExpanded ? 'Managing' : 'Open'}
          </span>
          <span className="chevron" aria-hidden="true">{'\u25BE'}</span>
        </div>
      </button>

      {isExpanded && (
        <div id={panelId} className="pair-panel">
          {token0 && token1 ? (
            <OrderTable
              orders={orders}
              orderIds={orderIds.map(Number)}
              pairAddress={pairAddress}
              token0={token0}
              token1={token1}
              isLoading={isLoading}
              showCancelAction
              onCancel={(orderId) => cancelOrder(pairAddress, orderId)}
              isCancelling={isCancelling}
              refetch={refetch}
            />
          ) : (
            <p className="loading-state text-sm" aria-live="polite">
              <strong>Loading Tokens…</strong>
              Reading pair metadata.
            </p>
          )}
        </div>
      )}
    </section>
  )
}

export function MyOrders() {
  const { isConnected } = useAccount()
  const [expandedPair, setExpandedPair] = useState<string | null>(null)

  const { data: pairCount } = useAllPairsLength()
  const total = Number(pairCount ?? 0n)
  const { data: pairAddresses, isLoading } = useAllPairs(0, Math.min(total, 100))
  const pairs = pairAddresses ? [...pairAddresses] : []

  if (!isConnected) {
    return (
      <section className="workspace-header">
        <div>
          <p className="eyebrow">Wallet Required</p>
          <h1 className="workspace-title">Connect a wallet to inspect and cancel maker orders.</h1>
          <p className="workspace-copy">Pair-level inventory appears after wallet connection.</p>
        </div>
        <div className="workspace-meta">
          <span className="kpi-pill">Maker-only view</span>
        </div>
      </section>
    )
  }

  return (
    <div className="workspace">
      <section className="workspace-header">
        <div>
          <p className="eyebrow">Maker Control</p>
          <h1 className="workspace-title">Pair exposure and cancelable live orders.</h1>
          <p className="workspace-copy">
            Expand a route to review remaining size, fill progress, and cancellation actions.
          </p>
        </div>

        <div className="workspace-meta">
          <span className="kpi-pill numeric">{total} deployed pair{total === 1 ? '' : 's'}</span>
          <span className="kpi-pill">Maker orders only</span>
        </div>
      </section>

      <section className="market-list">
        {isLoading && (
          <section className="loading-state" aria-live="polite">
            <strong>Loading Deployed Pairs…</strong>
            Checking routes for maker inventory.
          </section>
        )}

        {!isLoading && pairs.length === 0 && (
          <section className="empty-state">
            <strong>No Pairs Deployed</strong>
            <p className="m-0 text-sm">
              Once a route exists, your maker orders will show up here pair by pair.
            </p>
          </section>
        )}

        {!isLoading && pairs.map((address) => {
          const pairAddress = address as `0x${string}`
          return (
            <MyPairOrders
              key={pairAddress}
              pairAddress={pairAddress}
              isExpanded={expandedPair === pairAddress}
              onToggle={() => setExpandedPair(expandedPair === pairAddress ? null : pairAddress)}
            />
          )
        })}
      </section>

      {!isLoading && pairs.length > 0 && (
        <p className="px-2 text-sm text-[var(--text-muted)]">
          Expand a pair to see only the orders where your wallet is the maker.
        </p>
      )}
    </div>
  )
}
