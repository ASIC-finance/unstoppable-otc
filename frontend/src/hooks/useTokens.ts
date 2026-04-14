import { useEffect, useMemo, useState } from 'react'
import { useChainId } from 'wagmi'
import {
  ensureTokenListLoaded,
  getTokensForChain,
  type TokenEntry,
} from '../config/tokenlist'
import { PINNED_TOKENS } from '../config/pinnedTokens'
import { isSameAddress } from '../utils/address'

/**
 * Returns the curated token list for the currently-connected chain plus the
 * pinned-order subset that the picker should float to the top.
 *
 * Data shape matches what TokenPicker expects — callers just pass it through.
 */
export function useTokens(): {
  chainId: number
  tokens: TokenEntry[]
  pinned: TokenEntry[]
  isLoading: boolean
} {
  const chainId = useChainId()
  const [tokens, setTokens] = useState<TokenEntry[]>(() => getTokensForChain(chainId))

  useEffect(() => {
    let cancelled = false
    // If we already have tokens cached for this chain, skip the awaitable.
    if (tokens.length === 0) {
      ensureTokenListLoaded().then(() => {
        if (cancelled) return
        setTokens(getTokensForChain(chainId))
      })
    } else {
      setTokens(getTokensForChain(chainId))
    }
    return () => { cancelled = true }
    // Intentionally only re-run when chainId changes — token list is loaded
    // once and cached globally; subsequent chain switches read from cache.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chainId])

  const pinned = useMemo(() => {
    const addrs = PINNED_TOKENS[chainId] ?? []
    return addrs
      .map(a => tokens.find(t => isSameAddress(t.address, a)))
      .filter((t): t is TokenEntry => !!t)
  }, [tokens, chainId])

  return { chainId, tokens, pinned, isLoading: tokens.length === 0 }
}
