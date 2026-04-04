import { useState, useEffect } from 'react'
import { useAccount } from 'wagmi'
import { isAddress } from 'viem'
import { useMakerOrderCount, useMakerOrders, usePairTokens } from '../hooks/useOrders'
import { usePairAddress } from '../hooks/useFactory'
import { useCancelOrder } from '../hooks/useCancelOrder'
import { OrderTable } from '../components/OrderTable'
import { TokenBadge } from '../components/TokenBadge'

const PAGE_SIZE = 50

export function MyOrders() {
  const { address, isConnected } = useAccount()
  const [tokenA, setTokenA] = useState('')
  const [tokenB, setTokenB] = useState('')
  const [page, setPage] = useState(0)

  const addrA = isAddress(tokenA) ? tokenA as `0x${string}` : undefined
  const addrB = isAddress(tokenB) ? tokenB as `0x${string}` : undefined

  const { data: pairAddr } = usePairAddress(addrA, addrB)
  const pairExists = pairAddr && pairAddr !== '0x0000000000000000000000000000000000000000'
  const pair = pairExists ? pairAddr as `0x${string}` : undefined

  const { token0, token1 } = usePairTokens(pair)
  const { data: makerCount, refetch: refetchCount } = useMakerOrderCount(pair, address)
  const total = Number(makerCount ?? 0n)

  const offset = page * PAGE_SIZE
  const { data, isLoading, refetch: refetchOrders } = useMakerOrders(pair, address, offset, PAGE_SIZE)
  const { cancelOrder, isPending: isCancelling, isSuccess, reset } = useCancelOrder()

  const refetch = () => { refetchOrders(); refetchCount() }

  const orderIds = data ? [...data[0]] : []
  const orders = data ? [...data[1]] : []

  // P3 fix: move cancel-success side effects into useEffect
  useEffect(() => {
    if (isSuccess) {
      reset()
      refetch()
    }
  }, [isSuccess]) // eslint-disable-line react-hooks/exhaustive-deps

  if (!isConnected) {
    return (
      <div className="text-center py-16">
        <h2 className="text-xl font-semibold text-white mb-2">Connect your wallet</h2>
        <p className="text-gray-400">Connect a wallet to see your orders.</p>
      </div>
    )
  }

  return (
    <div>
      <h1 className="text-xl font-semibold text-white mb-4">My Orders</h1>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-6">
        <div>
          <label className="block text-xs text-gray-400 mb-1">Token A</label>
          <input type="text" value={tokenA} onChange={e => { setTokenA(e.target.value); setPage(0) }} placeholder="0x..."
            className="w-full px-3 py-2 rounded-lg bg-gray-900 border border-gray-700 text-gray-100 placeholder-gray-500 text-sm focus:border-emerald-500 focus:outline-none" />
        </div>
        <div>
          <label className="block text-xs text-gray-400 mb-1">Token B</label>
          <input type="text" value={tokenB} onChange={e => { setTokenB(e.target.value); setPage(0) }} placeholder="0x..."
            className="w-full px-3 py-2 rounded-lg bg-gray-900 border border-gray-700 text-gray-100 placeholder-gray-500 text-sm focus:border-emerald-500 focus:outline-none" />
        </div>
      </div>

      {pair && (
        <div className="mb-4 flex items-center justify-between">
          <div className="flex items-center gap-2 text-sm text-gray-400">
            Pair: {token0 && <TokenBadge address={token0} />} / {token1 && <TokenBadge address={token1} />}
            <span className="text-gray-600">({total} orders)</span>
          </div>
          <button onClick={refetch}
            className="px-3 py-1 rounded text-sm bg-gray-800 hover:bg-gray-700 text-gray-300">Refresh</button>
        </div>
      )}

      {isLoading && <p className="text-gray-500 text-center py-8">Loading orders...</p>}

      {pair && !isLoading && orders.length === 0 && (
        <p className="text-gray-500 text-center py-8">No orders in this pair.</p>
      )}

      {orders.length > 0 && pair && token0 && token1 && (
        <OrderTable
          orders={orders}
          orderIds={orderIds.map(Number)}
          pairAddress={pair}
          token0={token0}
          token1={token1}
          showCancelAction
          onCancel={(orderId) => cancelOrder(pair, orderId)}
          isCancelling={isCancelling}
          refetch={refetch}
        />
      )}

      {total > PAGE_SIZE && (
        <div className="flex justify-center gap-2 mt-4">
          <button onClick={() => setPage(p => Math.max(0, p - 1))} disabled={page === 0}
            className="px-3 py-1 rounded text-sm bg-gray-800 hover:bg-gray-700 text-gray-300 disabled:opacity-50">Prev</button>
          <span className="text-sm text-gray-400 py-1">Page {page + 1} of {Math.ceil(total / PAGE_SIZE)}</span>
          <button onClick={() => setPage(p => p + 1)} disabled={offset + PAGE_SIZE >= total}
            className="px-3 py-1 rounded text-sm bg-gray-800 hover:bg-gray-700 text-gray-300 disabled:opacity-50">Next</button>
        </div>
      )}

      {(!addrA || !addrB) && (
        <p className="text-gray-500 text-center py-8">Enter a token pair to view your orders.</p>
      )}
    </div>
  )
}
