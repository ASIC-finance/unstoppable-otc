import { useState } from 'react'
import { useAccount } from 'wagmi'
import { isAddress } from 'viem'
import { useActiveOrderCount, useActiveOrders, usePairTokens } from '../hooks/useOrders'
import { useAllPairsLength, useAllPairs, usePairAddress } from '../hooks/useFactory'
import { OrderTable } from '../components/OrderTable'
import { TokenBadge } from '../components/TokenBadge'

const ORDERS_PER_PAIR = 20

// ── Single pair section that loads its own data ─────────────────

function PairSection({ pairAddress, isSelected, onSelect }: {
  pairAddress: `0x${string}`; isSelected: boolean; onSelect: () => void
}) {
  const { token0, token1 } = usePairTokens(pairAddress)
  const { data: activeCount, refetch: refetchCount } = useActiveOrderCount(pairAddress)
  const count = Number(activeCount ?? 0n)
  const { data, isLoading, refetch: refetchOrders } = useActiveOrders(
    isSelected ? pairAddress : undefined, 0, ORDERS_PER_PAIR
  )
  const refetch = () => { refetchOrders(); refetchCount() }

  const orderIds = data ? [...data[0]] : []
  const orders = data ? [...data[1]] : []

  return (
    <div className="border border-gray-800 rounded-xl overflow-hidden">
      {/* Pair header — always visible, clickable */}
      <button
        onClick={onSelect}
        className={`w-full flex items-center justify-between px-4 py-3 text-left transition-colors ${
          isSelected ? 'bg-gray-900' : 'bg-gray-900/50 hover:bg-gray-900'
        }`}
      >
        <div className="flex items-center gap-2">
          {token0 && <TokenBadge address={token0} />}
          <span className="text-gray-500">/</span>
          {token1 && <TokenBadge address={token1} />}
        </div>
        <div className="flex items-center gap-3">
          <span className={`text-xs px-2 py-0.5 rounded-full ${
            count > 0 ? 'bg-emerald-600/20 text-emerald-400' : 'bg-gray-800 text-gray-500'
          }`}>
            {count} active
          </span>
          <span className={`text-gray-500 text-sm transition-transform ${isSelected ? 'rotate-180' : ''}`}>
            {'\u25BE'}
          </span>
        </div>
      </button>

      {/* Expanded order list */}
      {isSelected && (
        <div className="border-t border-gray-800">
          {isLoading && (
            <p className="text-gray-500 text-center py-6 text-sm">Loading orders...</p>
          )}

          {!isLoading && count === 0 && (
            <p className="text-gray-500 text-center py-6 text-sm">No active orders.</p>
          )}

          {!isLoading && orders.length > 0 && token0 && token1 && (
            <div className="px-2">
              <OrderTable
                orders={orders}
                orderIds={orderIds.map(Number)}
                pairAddress={pairAddress}
                token0={token0}
                token1={token1}
                showFillAction
                refetch={refetch}
              />
            </div>
          )}

          {count > ORDERS_PER_PAIR && (
            <p className="text-xs text-gray-500 text-center py-2">
              Showing {ORDERS_PER_PAIR} of {count} — use pair search for full pagination.
            </p>
          )}
        </div>
      )}
    </div>
  )
}

// ── Main page ───────────────────────────────────────────────────

export function OrderBook() {
  const { isConnected } = useAccount()
  const [expandedPair, setExpandedPair] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [searchB, setSearchB] = useState('')
  const [showSearch, setShowSearch] = useState(false)

  // Load all pairs
  const { data: pairCount } = useAllPairsLength()
  const total = Number(pairCount ?? 0n)
  const { data: pairAddresses, isLoading: loadingPairs } = useAllPairs(0, Math.min(total, 100))

  // Search: look up a specific pair
  const searchAddrA = isAddress(search) ? search as `0x${string}` : undefined
  const searchAddrB = isAddress(searchB) ? searchB as `0x${string}` : undefined
  const { data: searchPairAddr } = usePairAddress(searchAddrA, searchAddrB)
  const searchPairExists = searchPairAddr && searchPairAddr !== '0x0000000000000000000000000000000000000000'
  const searchPair = searchPairExists ? searchPairAddr as `0x${string}` : undefined

  if (!isConnected) {
    return (
      <div className="text-center py-16">
        <h2 className="text-xl font-semibold text-white mb-2">Connect your wallet</h2>
        <p className="text-gray-400">Connect a wallet to browse the order book.</p>
      </div>
    )
  }

  const pairs = pairAddresses ? [...pairAddresses] : []

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-xl font-semibold text-white">Order Book</h1>
          {total > 0 && (
            <p className="text-xs text-gray-500 mt-0.5">{total} pair{total !== 1 ? 's' : ''} deployed</p>
          )}
        </div>
        <button
          onClick={() => setShowSearch(!showSearch)}
          className={`px-3 py-1.5 rounded-lg text-sm transition-colors ${
            showSearch ? 'bg-emerald-600/20 text-emerald-400' : 'bg-gray-800 hover:bg-gray-700 text-gray-300'
          }`}
        >
          Search pair
        </button>
      </div>

      {/* Pair search */}
      {showSearch && (
        <div className="rounded-xl bg-gray-900 border border-gray-800 p-4 mb-6 space-y-3">
          <p className="text-xs text-gray-400">Find a specific pair by token addresses</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <input type="text" value={search} onChange={e => setSearch(e.target.value)}
              placeholder="Token A address (0x...)"
              className="px-3 py-2 rounded-lg bg-gray-800 border border-gray-700 text-gray-100 placeholder-gray-500 text-sm focus:border-emerald-500 focus:outline-none" />
            <input type="text" value={searchB} onChange={e => setSearchB(e.target.value)}
              placeholder="Token B address (0x...)"
              className="px-3 py-2 rounded-lg bg-gray-800 border border-gray-700 text-gray-100 placeholder-gray-500 text-sm focus:border-emerald-500 focus:outline-none" />
          </div>
          {searchAddrA && searchAddrB && !searchPairExists && (
            <p className="text-xs text-gray-500">No pair found for these tokens.</p>
          )}
          {searchPair && (
            <div onClick={() => { setExpandedPair(searchPair); setShowSearch(false) }}
              className="cursor-pointer">
              <PairSection
                pairAddress={searchPair}
                isSelected={expandedPair === searchPair}
                onSelect={() => setExpandedPair(expandedPair === searchPair ? null : searchPair)}
              />
            </div>
          )}
        </div>
      )}

      {/* All pairs */}
      {loadingPairs && (
        <p className="text-gray-500 text-center py-8">Loading pairs...</p>
      )}

      {!loadingPairs && pairs.length === 0 && (
        <div className="text-center py-12">
          <p className="text-gray-400 mb-1">No pairs deployed yet.</p>
          <p className="text-sm text-gray-500">Create an order to deploy the first pair.</p>
        </div>
      )}

      <div className="space-y-3">
        {pairs.map(addr => {
          const pairAddr = addr as `0x${string}`
          return (
            <PairSection
              key={pairAddr}
              pairAddress={pairAddr}
              isSelected={expandedPair === pairAddr}
              onSelect={() => setExpandedPair(expandedPair === pairAddr ? null : pairAddr)}
            />
          )
        })}
      </div>

      {total > 100 && (
        <p className="text-xs text-gray-500 text-center mt-4">
          Showing first 100 pairs. Use search to find others.
        </p>
      )}
    </div>
  )
}
