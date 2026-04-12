import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useAccount } from 'wagmi'
import { isAddress } from 'viem'
import { useActiveOrderCount, useActiveOrders, usePairTokens } from '../hooks/useOrders'
import { useAllPairsLength, useAllPairs, usePairAddress } from '../hooks/useFactory'
import { OrderTable } from '../components/OrderTable'
import { TokenBadge } from '../components/TokenBadge'
import { shortenAddress } from '../utils/format'

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
    <section className="pair-row" data-selected={isSelected}>
      <button
        type="button"
        onClick={onSelect}
        aria-expanded={isSelected}
        aria-controls={panelId}
        className="pair-row-button"
      >
        <div className="pair-main">
          <div className="pair-heading">
            <span className="eyebrow mb-0">Pair</span>
            <span className={count > 0 ? 'status-pill status-active' : 'status-pill status-muted'}>
              <span className="numeric">{count}</span> active
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
            {isSelected ? 'Orders Open' : 'Inspect'}
          </span>
          <span className="chevron" aria-hidden="true">
            {'\u25BE'}
          </span>
        </div>
      </button>

      {isSelected && (
        <div id={panelId} className="pair-panel">
          {isLoading && (
            <p className="loading-state text-sm" aria-live="polite">
              <strong>Loading Orders…</strong>
              Reading this pair from chain.
            </p>
          )}

          {!isLoading && count === 0 && (
            <div className="empty-state">
              <strong>No Active Orders</strong>
              <p className="m-0 text-sm">
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
      <section className="workspace-header">
        <div>
          <p className="eyebrow">Wallet Required</p>
          <h1 className="workspace-title">
            Connect a wallet to inspect the live order book.
          </h1>
          <p className="workspace-copy">
            Read maker terms, pair state, and fillable liquidity once a wallet is connected.
          </p>
        </div>
        <div className="workspace-meta">
          <span className="kpi-pill">Read-only until connected</span>
        </div>
      </section>
    )
  }

  return (
    <div className="workspace">
      <section className="workspace-header">
        <div>
          <p className="eyebrow">Live Book</p>
          <h1 className="workspace-title">
            Deployed pairs and fillable OTC liquidity.
          </h1>
          <p className="workspace-copy">
            Search a token route directly or scan deployed pairs before opening the live order table.
          </p>
        </div>

        <div className="workspace-meta">
          <span className="kpi-pill numeric">{total} deployed pair{total === 1 ? '' : 's'}</span>
          <Link to="/create" className="primary-button">Create Order</Link>
        </div>
      </section>

      <section className="workspace-header">
        <div>
          <p className="eyebrow">Route Search</p>
          <h2 className="m-0 text-base font-extrabold text-[var(--text-strong)]">
            Jump to a pair by token address.
          </h2>
        </div>

        <div className="search-desk">
          <div className="field-stack">
            <label htmlFor="search-token-a" className="field-label">
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

          <div className="field-stack">
            <label htmlFor="search-token-b" className="field-label">
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

        <div className="col-span-full" aria-live="polite">
          {searchAddrA && searchAddrB && !searchPairExists && (
            <p className="notice-state m-0 text-sm text-[var(--warning)]">
              <strong>No Matching Pair</strong>
              These token addresses do not have a deployed route yet.
            </p>
          )}
        </div>

        {searchPair && (
          <div className="col-span-full">
            <PairSection
              pairAddress={searchPair}
              isSelected={expandedPair === searchPair}
              onSelect={() => setExpandedPair(expandedPair === searchPair ? null : searchPair)}
            />
          </div>
        )}
      </section>

      <section className="market-list">
        {loadingPairs && (
          <section className="loading-state" aria-live="polite">
            <strong>Loading Pairs…</strong>
            Reading deployed pair registry.
          </section>
        )}

        {!loadingPairs && pairs.length === 0 && (
          <section className="empty-state">
            <strong>No Pairs Deployed</strong>
            <p className="m-0 text-sm">
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
          Showing the first 100 deployed pairs. Use route search to jump directly to another pair.
        </p>
      )}
    </div>
  )
}
