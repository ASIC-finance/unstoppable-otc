import { useState } from 'react'
import { useAccount } from 'wagmi'
import { isAddress } from 'viem'
import { useActiveOrderCount, useActiveOrders, usePairTokens } from '../hooks/useOrders'
import { useAllPairsLength, useAllPairs, usePairAddress } from '../hooks/useFactory'
import { OrderTable } from '../components/OrderTable'
import { TokenBadge } from '../components/TokenBadge'

const ORDERS_PER_PAIR = 20

function PairSection({ pairAddress, isSelected, onSelect }: {
  pairAddress: `0x${string}`
  isSelected: boolean
  onSelect: () => void
}) {
  const { token0, token1 } = usePairTokens(pairAddress)
  const { data: activeCount, refetch: refetchCount } = useActiveOrderCount(pairAddress)
  const count = Number(activeCount ?? 0n)
  const { data, isLoading, refetch: refetchOrders } = useActiveOrders(
    isSelected ? pairAddress : undefined,
    0,
    ORDERS_PER_PAIR,
  )

  const refetch = () => {
    refetchOrders()
    refetchCount()
  }

  const orderIds = data ? [...data[0]] : []
  const orders = data ? [...data[1]] : []
  const panelId = `pair-${pairAddress.toLowerCase()}`

  return (
    <section className={`surface surface-interactive overflow-hidden ${isSelected ? 'bg-white/94 dark:bg-[rgba(30,36,44,0.94)]' : 'bg-white/76 dark:bg-[rgba(22,27,34,0.76)]'}`}>
      <button
        type="button"
        onClick={onSelect}
        aria-expanded={isSelected}
        aria-controls={panelId}
        className="flex w-full items-center justify-between gap-4 px-5 py-5 text-left"
      >
        <div className="min-w-0">
          <div className="mb-3 flex flex-wrap items-center gap-2">
            <span className="section-label mb-0">Pair</span>
            <span className={`status-pill ${count > 0 ? 'bg-emerald-500/15 text-emerald-700' : 'bg-stone-300/25 text-stone-600'}`}>
              <span className="numeric">{count}</span> active
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
            {isSelected ? 'Inspecting Orders' : 'Open Book'}
          </span>
          <span
            className={`inline-flex h-10 w-10 items-center justify-center rounded-full border border-[var(--border-soft)] bg-white/70 dark:bg-[rgba(22,27,34,0.50)] text-lg text-[var(--text-soft)] transition-transform ${isSelected ? 'rotate-180' : ''}`}
            aria-hidden="true"
          >
            {'\u25BE'}
          </span>
        </div>
      </button>

      {isSelected && (
        <div id={panelId} className="border-t border-[var(--border-soft)] px-4 pb-4 pt-4">
          {isLoading && (
            <p className="py-8 text-center text-sm text-[var(--text-muted)]" aria-live="polite">
              Loading orders…
            </p>
          )}

          {!isLoading && count === 0 && (
            <div className="surface-muted px-5 py-8 text-center">
              <p className="text-sm font-semibold text-[var(--text-strong)]">No active orders.</p>
              <p className="mt-1 text-sm text-[var(--text-soft)]">
                This pair is deployed, but there is nothing actionable in the book right now.
              </p>
            </div>
          )}

          {!isLoading && orders.length > 0 && token0 && token1 && (
            <OrderTable
              orders={orders}
              orderIds={orderIds.map(Number)}
              pairAddress={pairAddress}
              token0={token0}
              token1={token1}
              showFillAction
              refetch={refetch}
            />
          )}

          {count > ORDERS_PER_PAIR && (
            <p className="pt-3 text-center text-xs font-medium text-[var(--text-muted)]">
              Showing {ORDERS_PER_PAIR} of {count}. Use pair search to inspect a specific route faster.
            </p>
          )}
        </div>
      )}
    </section>
  )
}

export function OrderBook() {
  const { isConnected } = useAccount()
  const [expandedPair, setExpandedPair] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [searchB, setSearchB] = useState('')
  const [showSearch, setShowSearch] = useState(false)

  const { data: pairCount } = useAllPairsLength()
  const total = Number(pairCount ?? 0n)
  const { data: pairAddresses, isLoading: loadingPairs } = useAllPairs(0, Math.min(total, 100))

  const searchAddrA = isAddress(search) ? search as `0x${string}` : undefined
  const searchAddrB = isAddress(searchB) ? searchB as `0x${string}` : undefined
  const { data: searchPairAddr } = usePairAddress(searchAddrA, searchAddrB)
  const searchPairExists = searchPairAddr && searchPairAddr !== '0x0000000000000000000000000000000000000000'
  const searchPair = searchPairExists ? searchPairAddr as `0x${string}` : undefined
  const pairs = pairAddresses ? [...pairAddresses] : []

  if (!isConnected) {
    return (
      <section className="surface px-6 py-8 sm:px-8">
        <p className="section-label">Wallet Required</p>
        <h2 className="text-2xl font-semibold tracking-tight text-[var(--text-strong)]">
          Connect a wallet to inspect the live order book.
        </h2>
        <p className="mt-3 max-w-2xl text-sm leading-6 text-[var(--text-soft)]">
          The current view is read-only until a wallet is connected. Once connected, you can inspect maker terms and fill directly from the selected pair.
        </p>
      </section>
    )
  }

  return (
    <div className="space-y-5">
      <section className="surface px-6 py-6 sm:px-8">
        <div className="flex flex-col gap-5 xl:flex-row xl:items-end xl:justify-between">
          <div className="max-w-3xl">
            <p className="section-label">Live Book</p>
            <h2 className="text-2xl font-semibold tracking-tight text-[var(--text-strong)] sm:text-[2rem]">
              Monitor deployed pairs and expand only the books worth acting on.
            </h2>
            <p className="mt-3 text-sm leading-6 text-[var(--text-soft)]">
              Search by token route when you know the contracts, or work through the currently deployed pairs and inspect fillable liquidity in place.
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <span className="kpi-pill numeric">{total} deployed pair{total === 1 ? '' : 's'}</span>
            <button
              type="button"
              onClick={() => setShowSearch(current => !current)}
              className={showSearch ? 'secondary-button' : 'ghost-button'}
            >
              {showSearch ? 'Hide Pair Search' : 'Search Pair'}
            </button>
          </div>
        </div>

        {showSearch && (
          <div className="mt-6 border-t border-[var(--border-soft)] pt-6">
            <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
              <div>
                <label htmlFor="search-token-a" className="mb-2 block text-sm font-semibold text-[var(--text-strong)]">
                  Token A Address
                </label>
                <input
                  id="search-token-a"
                  name="search_token_a"
                  type="text"
                  value={search}
                  autoComplete="off"
                  spellCheck={false}
                  placeholder="0x1234…"
                  onChange={event => setSearch(event.target.value)}
                  className="input-field"
                />
              </div>

              <div>
                <label htmlFor="search-token-b" className="mb-2 block text-sm font-semibold text-[var(--text-strong)]">
                  Token B Address
                </label>
                <input
                  id="search-token-b"
                  name="search_token_b"
                  type="text"
                  value={searchB}
                  autoComplete="off"
                  spellCheck={false}
                  placeholder="0x5678…"
                  onChange={event => setSearchB(event.target.value)}
                  className="input-field"
                />
              </div>
            </div>

            <div className="mt-4" aria-live="polite">
              {searchAddrA && searchAddrB && !searchPairExists && (
                <p className="text-sm font-medium text-[var(--warning)]">
                  No deployed pair matches these token addresses yet.
                </p>
              )}
            </div>

            {searchPair && (
              <div className="mt-4">
                <PairSection
                  pairAddress={searchPair}
                  isSelected={expandedPair === searchPair}
                  onSelect={() => setExpandedPair(expandedPair === searchPair ? null : searchPair)}
                />
              </div>
            )}
          </div>
        )}
      </section>

      <section className="space-y-3">
        {loadingPairs && (
          <section className="surface px-6 py-8 text-center">
            <p className="text-sm font-medium text-[var(--text-muted)]" aria-live="polite">Loading pairs…</p>
          </section>
        )}

        {!loadingPairs && pairs.length === 0 && (
          <section className="surface px-6 py-8 text-center">
            <p className="text-base font-semibold text-[var(--text-strong)]">No pairs are deployed yet.</p>
            <p className="mt-2 text-sm text-[var(--text-soft)]">
              Create the first order to deploy a route and start building the book.
            </p>
          </section>
        )}

        {!loadingPairs && pairs.map(address => {
          const pairAddress = address as `0x${string}`
          return (
            <PairSection
              key={pairAddress}
              pairAddress={pairAddress}
              isSelected={expandedPair === pairAddress}
              onSelect={() => setExpandedPair(expandedPair === pairAddress ? null : pairAddress)}
            />
          )
        })}
      </section>

      {total > 100 && (
        <p className="px-2 text-sm text-[var(--text-muted)]">
          Showing the first 100 deployed pairs. Use pair search to jump directly to another route.
        </p>
      )}
    </div>
  )
}
