import { useEffect, useId, useMemo, useRef, useState } from 'react'
import { isAddress } from 'viem'
import { useTokens } from '../hooks/useTokens'
import { useTokenInfo } from '../hooks/useTokenInfo'
import { getTokenEntry, type TokenEntry } from '../config/tokenlist'
import { filterTokens } from '../lib/tokenSearch'
import { shortenAddress } from '../utils/format'
import { isSameAddress } from '../utils/address'

type Props = {
  value: string
  onChange: (address: string) => void
  /** Address to disable in the list (e.g. the other side of a pair). */
  excludeAddress?: string
  label: string
  placeholder?: string
  /** External id to attach to the visible button — useful for label htmlFor. */
  id?: string
}

/**
 * Searchable token picker backed by the chain's curated list, with pinned
 * tokens (WETH/USDC/USDT/…) at the top. Accepts a pasted raw address as a
 * fallback when the token is not in the list — and reads the on-chain
 * ERC20 contract to populate name/symbol/decimals so the user sees real
 * metadata instead of "Custom" before selecting.
 *
 * Implements the ARIA 1.2 combobox-with-listbox-popup pattern — search
 * input owns focus, options are referenced via aria-activedescendant.
 */
export function TokenPicker({
  value,
  onChange,
  excludeAddress,
  label,
  placeholder = 'Search symbol, name, or paste 0x…',
  id,
}: Props) {
  const reactId = useId()
  const buttonId = id ?? `${reactId}-button`
  const listboxId = `${reactId}-listbox`
  const optionIdPrefix = `${reactId}-option`

  const { chainId, tokens, pinned, isLoading } = useTokens()
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [rawHighlight, setRawHighlight] = useState(0)

  const containerRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const listRef = useRef<HTMLUListElement>(null)

  const filtered = useMemo(
    () => filterTokens(tokens, query, {
      pinnedAddresses: pinned.map(p => p.address),
      excludeAddress,
    }),
    [tokens, query, pinned, excludeAddress],
  )

  // Validity / candidacy of the selected `value` and the in-flight `query`.
  const valueAddr = value && isAddress(value) ? (value as `0x${string}`) : undefined
  const valueEntry = valueAddr ? getTokenEntry(chainId, valueAddr) : undefined
  // Selected value is "custom" when it's a real address but not in the list.
  const valueNeedsLookup = !!valueAddr && !valueEntry

  const queryAddrTrimmed = query.trim()
  const queryAddr = isAddress(queryAddrTrimmed) ? (queryAddrTrimmed as `0x${string}`) : undefined
  const queryAddrLower = queryAddr?.toLowerCase()
  const queryAlreadyInList =
    !!queryAddrLower && filtered.some(t => t.address.toLowerCase() === queryAddrLower)
  const queryExcluded =
    !!queryAddrLower && excludeAddress?.toLowerCase() === queryAddrLower
  const queryNeedsLookup = !!queryAddr && !queryAlreadyInList && !queryExcluded

  // On-chain reads via multicall — react-query dedupes the request when
  // both lookups happen to point at the same address.
  const valueOnChain = useTokenInfo(valueNeedsLookup ? valueAddr : undefined)
  const queryOnChain = useTokenInfo(queryNeedsLookup ? queryAddr : undefined)

  // Synthetic option for a pasted address that isn't in the curated list.
  // Uses on-chain metadata when available so the user sees the real
  // symbol/name immediately, with shortenAddress as a fallback while loading.
  const syntheticOption = useMemo<TokenEntry | null>(() => {
    if (!queryAddr || !queryNeedsLookup) return null
    const symbol = queryOnChain.symbol ?? shortenAddress(queryAddr)
    const name = queryOnChain.name ?? (queryOnChain.isLoading ? 'Loading…' : 'Custom token')
    const decimals = queryOnChain.decimals ?? 18
    return {
      chainId,
      name,
      address: queryAddrLower as `0x${string}`,
      symbol,
      decimals,
      logoURI: '',
    }
  }, [queryAddr, queryNeedsLookup, queryOnChain.symbol, queryOnChain.name, queryOnChain.decimals, queryOnChain.isLoading, queryAddrLower, chainId])

  const options = useMemo(
    () => (syntheticOption ? [syntheticOption, ...filtered] : filtered),
    [syntheticOption, filtered],
  )

  // Highlight derivation — clamp during render rather than in an effect.
  const highlight = Math.min(rawHighlight, Math.max(0, options.length - 1))

  // Reset highlight when the popover opens — React 19's "derive from state"
  // pattern: set during render when the trigger changes.
  const [prevOpen, setPrevOpen] = useState(open)
  if (prevOpen !== open) {
    setPrevOpen(open)
    if (open) setRawHighlight(0)
  }

  function setHighlight(i: number) {
    setRawHighlight(Math.max(0, Math.min(i, Math.max(0, options.length - 1))))
  }

  // ── Outside-click closes the popover ──────────────────────────
  useEffect(() => {
    if (!open) return
    function onMouseDown(e: MouseEvent) {
      if (!containerRef.current) return
      if (!containerRef.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onMouseDown)
    return () => document.removeEventListener('mousedown', onMouseDown)
  }, [open])

  // ── Auto-focus search when opening ────────────────────────────
  useEffect(() => {
    if (!open) return
    queueMicrotask(() => inputRef.current?.focus())
  }, [open])

  // ── Scroll highlighted option into view ───────────────────────
  useEffect(() => {
    if (!open || !listRef.current) return
    const el = listRef.current.querySelector<HTMLElement>(`[data-option-index="${highlight}"]`)
    el?.scrollIntoView({ block: 'nearest' })
  }, [highlight, open])

  function select(token: TokenEntry) {
    onChange(token.address)
    setQuery('')
    setOpen(false)
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Escape') { setOpen(false); e.preventDefault(); return }
    if (e.key === 'ArrowDown') { setHighlight(highlight + 1); e.preventDefault(); return }
    if (e.key === 'ArrowUp') { setHighlight(highlight - 1); e.preventDefault(); return }
    if (e.key === 'Enter') {
      const target = options[highlight]
      if (target) { select(target); e.preventDefault() }
      return
    }
    if (e.key === 'Home') { setHighlight(0); e.preventDefault(); return }
    if (e.key === 'End') { setHighlight(options.length - 1); e.preventDefault(); return }
  }

  // Display values for the closed-state button. Prefer (in order):
  //   1. Curated-list entry → already has logo + name + symbol
  //   2. On-chain ERC20 metadata → real symbol/name even for off-list tokens
  //   3. Loading shimmer copy → while the on-chain read is in flight
  //   4. "Custom" placeholder → if the contract isn't a valid ERC20
  let displaySymbol: string | undefined
  let displayName: string | undefined
  let displayLogo: string | undefined
  if (valueEntry) {
    displaySymbol = valueEntry.symbol
    displayName = valueEntry.name
    displayLogo = valueEntry.logoURI
  } else if (valueAddr) {
    if (valueOnChain.symbol) {
      displaySymbol = valueOnChain.symbol
      displayName = valueOnChain.name ?? shortenAddress(valueAddr)
    } else if (valueOnChain.isLoading) {
      displaySymbol = 'Loading…'
      displayName = shortenAddress(valueAddr)
    } else {
      displaySymbol = 'Custom'
      displayName = shortenAddress(valueAddr)
    }
  }

  return (
    <div className="picker-root" ref={containerRef}>
      <button
        type="button"
        id={buttonId}
        className="picker-button"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={open ? listboxId : undefined}
        aria-label={`${label}: ${displaySymbol ?? 'none selected'}`}
        onClick={() => setOpen(o => !o)}
      >
        <span className="picker-selected">
          {displaySymbol ? (
            <>
              {displayLogo ? (
                <img
                  src={displayLogo}
                  alt=""
                  width={22}
                  height={22}
                  loading="lazy"
                  decoding="async"
                  className="picker-avatar"
                />
              ) : (
                <span className="picker-avatar picker-avatar-fallback" aria-hidden="true">
                  {displaySymbol.slice(0, 2).toUpperCase()}
                </span>
              )}
              <span className="picker-symbol">{displaySymbol}</span>
              {displayName && <span className="picker-name">{displayName}</span>}
            </>
          ) : (
            <span className="picker-placeholder">Select token</span>
          )}
        </span>
        <span className="chevron" aria-hidden="true">{'\u25BE'}</span>
      </button>

      {open && (
        <div className="picker-panel" role="dialog" aria-label={`${label} search`}>
          <input
            ref={inputRef}
            type="text"
            className="input-field picker-search"
            role="combobox"
            aria-expanded="true"
            aria-controls={listboxId}
            aria-activedescendant={options[highlight] ? `${optionIdPrefix}-${highlight}` : undefined}
            aria-autocomplete="list"
            value={query}
            onChange={e => setQuery(e.target.value)}
            onKeyDown={onKeyDown}
            placeholder={placeholder}
            autoComplete="off"
            spellCheck={false}
          />

          {pinned.length > 0 && !query && (
            <div className="picker-pinned" aria-label="Popular tokens">
              {pinned.map(token => (
                <button
                  key={token.address}
                  type="button"
                  onClick={() => select(token)}
                  disabled={excludeAddress ? isSameAddress(token.address, excludeAddress) : false}
                  className="picker-chip"
                  title={`${token.name} (${token.address})`}
                >
                  {token.logoURI && (
                    <img
                      src={token.logoURI}
                      alt=""
                      width={18}
                      height={18}
                      loading="lazy"
                      decoding="async"
                    />
                  )}
                  <span>{token.symbol}</span>
                </button>
              ))}
            </div>
          )}

          <ul
            ref={listRef}
            id={listboxId}
            role="listbox"
            aria-label={label}
            className="picker-list"
          >
            {options.length === 0 && (
              <li className="picker-empty">
                {isLoading
                  ? 'Loading token list\u2026'
                  : query
                    ? `No tokens match "${query}". Paste a 0x address to use a custom token.`
                    : 'No tokens found for this chain.'}
              </li>
            )}

            {options.map((token, i) => {
              const selected = isSameAddress(token.address, value)
              const optionId = `${optionIdPrefix}-${i}`
              return (
                <li
                  key={token.address}
                  id={optionId}
                  role="option"
                  data-option-index={i}
                  aria-selected={selected}
                  className="picker-option"
                  data-highlighted={i === highlight || undefined}
                  onMouseEnter={() => setHighlight(i)}
                  onClick={() => select(token)}
                >
                  {token.logoURI ? (
                    <img
                      src={token.logoURI}
                      alt=""
                      width={26}
                      height={26}
                      loading="lazy"
                      decoding="async"
                      className="picker-avatar"
                    />
                  ) : (
                    <span className="picker-avatar picker-avatar-fallback" aria-hidden="true">
                      {token.symbol.slice(0, 2).toUpperCase()}
                    </span>
                  )}
                  <span className="picker-option-body">
                    <span className="picker-option-symbol">{token.symbol}</span>
                    <span className="picker-option-name">{token.name}</span>
                  </span>
                  <span className="picker-option-address">{shortenAddress(token.address)}</span>
                </li>
              )
            })}
          </ul>
        </div>
      )}
    </div>
  )
}
