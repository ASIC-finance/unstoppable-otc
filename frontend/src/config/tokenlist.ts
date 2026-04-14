import { isAddress } from 'viem'
import type { Address } from 'viem'

/**
 * Per-chain token-list URLs. Each URL must return JSON compatible with the
 * Uniswap Token List schema (https://tokenlists.org).
 */
const TOKEN_LIST_URLS: Record<number, string> = {
  1: 'https://tokens.uniswap.org',
  369: 'https://raw.githubusercontent.com/piteasio/app-tokens/refs/heads/main/piteas-tokenlist.json',
}

export type TokenEntry = {
  chainId: number
  name: string
  address: Address
  symbol: string
  decimals: number
  logoURI: string
}

type RemoteTokenList = {
  tokens?: Array<{
    chainId: number
    name: string
    address: string
    symbol: string
    decimals: number
    logoURI?: string
  }>
}

// Keyed by `${chainId}:${address.toLowerCase()}` so the same address on
// different chains doesn't collide.
let cache: Map<string, TokenEntry> | null = null
let loadingPromise: Promise<Map<string, TokenEntry>> | null = null

async function fetchList(url: string): Promise<RemoteTokenList['tokens']> {
  const res = await fetch(url, { headers: { accept: 'application/json' } })
  if (!res.ok) throw new Error(`Token list fetch failed (${res.status}): ${url}`)
  const data = (await res.json()) as RemoteTokenList
  return data.tokens ?? []
}

async function loadAll(): Promise<Map<string, TokenEntry>> {
  const urls = Object.values(TOKEN_LIST_URLS)
  const results = await Promise.allSettled(urls.map(fetchList))

  const out = new Map<string, TokenEntry>()
  for (const r of results) {
    if (r.status !== 'fulfilled' || !r.value) continue
    for (const t of r.value) {
      if (!isAddress(t.address)) continue
      if (!t.logoURI) continue // tier-1 lists always have a logo; skip entries that don't
      const addr = t.address.toLowerCase() as Address
      const key = `${t.chainId}:${addr}`
      // First list that mentions a (chain, address) pair wins. Tier-1 curated
      // lists tend to have better metadata than the long tail.
      if (!out.has(key)) {
        out.set(key, {
          chainId: t.chainId,
          name: t.name,
          address: addr,
          symbol: t.symbol,
          decimals: t.decimals,
          logoURI: t.logoURI,
        })
      }
    }
  }
  return out
}

export function ensureTokenListLoaded(): Promise<Map<string, TokenEntry>> {
  if (cache) return Promise.resolve(cache)
  if (!loadingPromise) {
    loadingPromise = loadAll()
      .then(map => {
        cache = map
        return map
      })
      .catch(() => {
        // Reset so a later caller can retry on an actual network recovery.
        loadingPromise = null
        return new Map<string, TokenEntry>()
      })
  }
  return loadingPromise
}

export function getTokenEntry(chainId: number, address: string | undefined): TokenEntry | undefined {
  if (!cache || !address) return undefined
  return cache.get(`${chainId}:${address.toLowerCase()}`)
}

export function getTokensForChain(chainId: number): TokenEntry[] {
  if (!cache) return []
  const out: TokenEntry[] = []
  for (const entry of cache.values()) {
    if (entry.chainId === chainId) out.push(entry)
  }
  // Stable sort: popular tokens tend to have shorter symbols, so alphabetize
  // — the picker re-orders pinned/matching tokens itself anyway.
  out.sort((a, b) => a.symbol.localeCompare(b.symbol))
  return out
}

export function getTokenLogoURI(chainId: number, address: string | undefined): string | undefined {
  return getTokenEntry(chainId, address)?.logoURI
}
