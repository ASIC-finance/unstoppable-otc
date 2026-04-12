import { useEffect, useState } from 'react'
import { useAccount } from 'wagmi'
import { useMakerOrderCount, useMakerOrders, usePairTokens } from '../hooks/useOrders'
import { useAllPairsLength, useAllPairs } from '../hooks/useFactory'
import { useCancelOrder } from '../hooks/useCancelOrder'
import { OrderTable } from '../components/OrderTable'
import { TokenBadge } from '../components/TokenBadge'

const PAGE_SIZE = 50

function MyPairOrders({ pairAddress, isExpanded, onToggle }: {
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
  const { cancelOrder, isPending: isCancelling, isSuccess, reset } = useCancelOrder()

  const refetch = () => {
    refetchOrders()
    refetchCount()
  }

  useEffect(() => {
    if (isSuccess) {
      reset()
      refetch()
    }
  }, [isSuccess]) // eslint-disable-line react-hooks/exhaustive-deps

  const orderIds = data ? [...data[0]] : []
  const orders = data ? [...data[1]] : []
  const panelId = `my-pair-${pairAddress.toLowerCase()}`

  if (count === 0) {
    return null
  }

  return (
    <section className={`surface surface-interactive overflow-hidden ${isExpanded ? 'bg-white/94 dark:bg-[rgba(30,36,44,0.94)]' : 'bg-white/76 dark:bg-[rgba(22,27,34,0.76)]'}`}>
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={isExpanded}
        aria-controls={panelId}
        className="flex w-full items-center justify-between gap-4 px-5 py-5 text-left"
      >
        <div className="min-w-0">
          <div className="mb-3 flex flex-wrap items-center gap-2">
            <span className="section-label mb-0">Maker Inventory</span>
            <span className="status-pill bg-[var(--accent-soft)] text-emerald-700">
              <span className="numeric">{count}</span> live order{count === 1 ? '' : 's'}
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {token0 && <TokenBadge address={token0} />}
            <span className="text-sm font-semibold text-[var(--text-muted)]">/</span>
            {token1 && <TokenBadge address={token1} />}
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-3">
          <span className="hidden text-sm font-medium text-[var(--text-soft)] sm:inline">
            {isExpanded ? 'Managing Orders' : 'Open Pair'}
          </span>
          <span
            className={`inline-flex h-10 w-10 items-center justify-center rounded-full border border-[var(--border-soft)] bg-white/70 dark:bg-[rgba(22,27,34,0.50)] text-lg text-[var(--text-soft)] transition-transform ${isExpanded ? 'rotate-180' : ''}`}
            aria-hidden="true"
          >
            {'\u25BE'}
          </span>
        </div>
      </button>

      {isExpanded && (
        <div id={panelId} className="border-t border-[var(--border-soft)] px-4 pb-4 pt-4">
          {isLoading && (
            <p className="py-8 text-center text-sm text-[var(--text-muted)]" aria-live="polite">
              Loading your orders…
            </p>
          )}

          {!isLoading && orders.length > 0 && token0 && token1 && (
            <OrderTable
              orders={orders}
              orderIds={orderIds.map(Number)}
              pairAddress={pairAddress}
              token0={token0}
              token1={token1}
              showCancelAction
              onCancel={(orderId) => cancelOrder(pairAddress, orderId)}
              isCancelling={isCancelling}
              refetch={refetch}
            />
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
      <section className="surface px-6 py-8 sm:px-8">
        <p className="section-label">Wallet Required</p>
        <h2 className="text-2xl font-semibold tracking-tight text-[var(--text-strong)]">
          Connect a wallet to inspect and cancel your maker orders.
        </h2>
        <p className="mt-3 max-w-2xl text-sm leading-6 text-[var(--text-soft)]">
          This view groups your exposure by deployed pair so you can review remaining size and close out orders from a single workspace.
        </p>
      </section>
    )
  }

  return (
    <div className="space-y-5">
      <section className="surface px-6 py-6 sm:px-8">
        <div className="flex flex-col gap-5 xl:flex-row xl:items-end xl:justify-between">
          <div className="max-w-3xl">
            <p className="section-label">Maker Control</p>
            <h2 className="text-2xl font-semibold tracking-tight text-[var(--text-strong)] sm:text-[2rem]">
              Review pair exposure and cancel live orders without leaving the table.
            </h2>
            <p className="mt-3 text-sm leading-6 text-[var(--text-soft)]">
              Each pair expands into a full order table, so you can inspect remaining fill progress before you decide whether to keep or pull liquidity.
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <span className="kpi-pill numeric">{total} deployed pair{total === 1 ? '' : 's'}</span>
            <span className="kpi-pill">Only your orders appear when expanded</span>
          </div>
        </div>
      </section>

      <section className="space-y-3">
        {isLoading && (
          <section className="surface px-6 py-8 text-center">
            <p className="text-sm font-medium text-[var(--text-muted)]" aria-live="polite">Loading deployed pairs…</p>
          </section>
        )}

        {!isLoading && pairs.length === 0 && (
          <section className="surface px-6 py-8 text-center">
            <p className="text-base font-semibold text-[var(--text-strong)]">No pairs are deployed yet.</p>
            <p className="mt-2 text-sm text-[var(--text-soft)]">
              Once a route exists, your maker orders will show up here pair by pair.
            </p>
          </section>
        )}

        {!isLoading && pairs.map(address => {
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
