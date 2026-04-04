import { useState, useEffect } from 'react'
import { useAccount } from 'wagmi'
import { useMakerOrderCount, useMakerOrders, usePairTokens } from '../hooks/useOrders'
import { useAllPairsLength, useAllPairs } from '../hooks/useFactory'
import { useCancelOrder } from '../hooks/useCancelOrder'
import { OrderTable } from '../components/OrderTable'
import { TokenBadge } from '../components/TokenBadge'

const PAGE_SIZE = 50

// ── Single pair's orders for this maker ─────────────────────────

function MyPairOrders({ pairAddress, isExpanded, onToggle }: {
  pairAddress: `0x${string}`; isExpanded: boolean; onToggle: () => void
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

  const refetch = () => { refetchOrders(); refetchCount() }

  useEffect(() => {
    if (isSuccess) { reset(); refetch() }
  }, [isSuccess]) // eslint-disable-line react-hooks/exhaustive-deps

  const orderIds = data ? [...data[0]] : []
  const orders = data ? [...data[1]] : []

  // Don't render pairs with no orders for this maker
  if (count === 0) return null

  return (
    <div className="border border-gray-800 rounded-xl overflow-hidden">
      <button onClick={onToggle}
        className={`w-full flex items-center justify-between px-4 py-3 text-left transition-colors ${
          isExpanded ? 'bg-gray-900' : 'bg-gray-900/50 hover:bg-gray-900'
        }`}
      >
        <div className="flex items-center gap-2">
          {token0 && <TokenBadge address={token0} />}
          <span className="text-gray-500">/</span>
          {token1 && <TokenBadge address={token1} />}
        </div>
        <div className="flex items-center gap-3">
          <span className="text-xs px-2 py-0.5 rounded-full bg-gray-800 text-gray-400">
            {count} order{count !== 1 ? 's' : ''}
          </span>
          <span className={`text-gray-500 text-sm transition-transform ${isExpanded ? 'rotate-180' : ''}`}>
            {'\u25BE'}
          </span>
        </div>
      </button>

      {isExpanded && (
        <div className="border-t border-gray-800">
          {isLoading && <p className="text-gray-500 text-center py-6 text-sm">Loading...</p>}

          {!isLoading && orders.length > 0 && token0 && token1 && (
            <div className="px-2">
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
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ── Main page ───────────────────────────────────────────────────

export function MyOrders() {
  const { isConnected } = useAccount()
  const [expandedPair, setExpandedPair] = useState<string | null>(null)

  const { data: pairCount } = useAllPairsLength()
  const total = Number(pairCount ?? 0n)
  const { data: pairAddresses, isLoading } = useAllPairs(0, Math.min(total, 100))

  if (!isConnected) {
    return (
      <div className="text-center py-16">
        <h2 className="text-xl font-semibold text-white mb-2">Connect your wallet</h2>
        <p className="text-gray-400">Connect a wallet to see your orders.</p>
      </div>
    )
  }

  const pairs = pairAddresses ? [...pairAddresses] : []

  return (
    <div>
      <h1 className="text-xl font-semibold text-white mb-4">My Orders</h1>

      {isLoading && <p className="text-gray-500 text-center py-8">Loading...</p>}

      {!isLoading && pairs.length === 0 && (
        <p className="text-gray-500 text-center py-8">No pairs deployed yet.</p>
      )}

      <div className="space-y-3">
        {pairs.map(addr => {
          const pairAddr = addr as `0x${string}`
          return (
            <MyPairOrders
              key={pairAddr}
              pairAddress={pairAddr}
              isExpanded={expandedPair === pairAddr}
              onToggle={() => setExpandedPair(expandedPair === pairAddr ? null : pairAddr)}
            />
          )
        })}
      </div>

      {!isLoading && pairs.length > 0 && (
        <p className="text-xs text-gray-500 text-center mt-6">
          Only pairs where you have orders are shown.
        </p>
      )}
    </div>
  )
}
