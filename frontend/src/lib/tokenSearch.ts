import type { TokenEntry } from '../config/tokenlist'

/**
 * Ranked substring match for token list search. Higher is better.
 * Returns 0 for non-matches so caller can filter.
 */
export function matchScore(token: TokenEntry, query: string): number {
  if (!query) return 1
  const q = query.toLowerCase()
  const sym = token.symbol.toLowerCase()
  const name = token.name.toLowerCase()
  const addr = token.address.toLowerCase()

  if (sym === q) return 1000
  if (sym.startsWith(q)) return 500
  if (sym.includes(q)) return 250
  if (name.startsWith(q)) return 180
  if (name.includes(q)) return 100
  if (addr.includes(q)) return 50
  return 0
}

type FilterOptions = {
  /** Tokens to float to the top when the query is empty (or matches). */
  pinnedAddresses?: readonly string[]
  /** Address to exclude from the filtered list (typically the other side of a pair). */
  excludeAddress?: string
  /** Hard cap on returned results — the picker renders a scroll area, not virtualized. */
  limit?: number
}

/**
 * Core search + sort used by TokenPicker. Split out for unit testing so the
 * ranking stays predictable even as the picker component evolves.
 */
export function filterTokens(
  tokens: readonly TokenEntry[],
  query: string,
  { pinnedAddresses = [], excludeAddress, limit = 150 }: FilterOptions = {},
): TokenEntry[] {
  const pinnedSet = new Set(pinnedAddresses.map(a => a.toLowerCase()))
  const exclude = excludeAddress?.toLowerCase()

  type Scored = { token: TokenEntry; score: number; pinnedRank: number }
  const scored: Scored[] = []

  for (const token of tokens) {
    const lower = token.address.toLowerCase()
    if (lower === exclude) continue
    const score = matchScore(token, query)
    if (score <= 0) continue
    // Pinned tokens surface above non-pinned with a boost — they still lose
    // to an exact-symbol hit from an unpinned token, which is what users
    // expect when they type something specific.
    const pinnedRank = pinnedSet.has(lower)
      ? pinnedAddresses.findIndex(a => a.toLowerCase() === lower)
      : -1
    scored.push({ token, score, pinnedRank })
  }

  scored.sort((a, b) => {
    // When the query is empty, every token has the same score=1, so sort
    // purely by pinned order: pinned first (in pin order), then the rest.
    if (a.pinnedRank !== b.pinnedRank) {
      if (a.pinnedRank === -1) return 1
      if (b.pinnedRank === -1) return -1
      return a.pinnedRank - b.pinnedRank
    }
    if (b.score !== a.score) return b.score - a.score
    return a.token.symbol.localeCompare(b.token.symbol)
  })

  return scored.slice(0, limit).map(s => s.token)
}
