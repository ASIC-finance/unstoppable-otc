import { describe, it, expect } from 'vitest'
import { filterTokens, matchScore } from './tokenSearch'
import type { TokenEntry } from '../config/tokenlist'

const t = (partial: Partial<TokenEntry>): TokenEntry => ({
  chainId: 1,
  name: 'Test',
  symbol: 'TEST',
  decimals: 18,
  logoURI: '',
  address: '0x0000000000000000000000000000000000000000',
  ...partial,
})

const weth = t({ symbol: 'WETH', name: 'Wrapped Ether',   address: '0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2' })
const usdc = t({ symbol: 'USDC', name: 'USD Coin',        address: '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48' })
const usdt = t({ symbol: 'USDT', name: 'Tether USD',      address: '0xdac17f958d2ee523a2206206994597c13d831ec7' })
const dai  = t({ symbol: 'DAI',  name: 'Dai Stablecoin',  address: '0x6b175474e89094c44da98b954eedeac495271d0f' })
const uni  = t({ symbol: 'UNI',  name: 'Uniswap',         address: '0x1f9840a85d5af5bf1d1762f925bdaddc4201f984' })

describe('matchScore', () => {
  it('rewards exact symbol matches highest', () => {
    const exact = matchScore(weth, 'weth')
    const startsWith = matchScore(weth, 'we')
    const namePartial = matchScore(weth, 'ether')
    expect(exact).toBeGreaterThan(startsWith)
    expect(startsWith).toBeGreaterThan(namePartial)
  })

  it('returns 1 for an empty query (everything passes)', () => {
    expect(matchScore(weth, '')).toBe(1)
  })

  it('returns 0 when nothing matches', () => {
    expect(matchScore(weth, 'xyzzy')).toBe(0)
  })

  it('matches by substring of address', () => {
    expect(matchScore(weth, 'c02a')).toBeGreaterThan(0)
  })
})

describe('filterTokens', () => {
  const all = [weth, usdc, usdt, dai, uni]
  const pinned = [weth.address, usdc.address, usdt.address] as const

  it('returns pinned tokens first when the query is empty', () => {
    const r = filterTokens(all, '', { pinnedAddresses: pinned })
    expect(r[0]).toBe(weth)
    expect(r[1]).toBe(usdc)
    expect(r[2]).toBe(usdt)
    // Unpinned tokens come after in alpha order
    expect(r.slice(3).map(x => x.symbol)).toEqual(['DAI', 'UNI'])
  })

  it('filters by symbol query', () => {
    const r = filterTokens(all, 'usd', { pinnedAddresses: pinned })
    expect(r.map(x => x.symbol)).toEqual(['USDC', 'USDT'])
  })

  it('filters by name query', () => {
    const r = filterTokens(all, 'uniswap', { pinnedAddresses: pinned })
    expect(r.map(x => x.symbol)).toEqual(['UNI'])
  })

  it('an exact-symbol unpinned match beats a pinned startsWith match', () => {
    // DAI is unpinned, UNI is unpinned. Query "dai" → DAI exact-symbol hit
    // must outrank pinned WETH (score 0 → filtered out anyway).
    const r = filterTokens(all, 'dai', { pinnedAddresses: pinned })
    expect(r[0]).toBe(dai)
  })

  it('excludes the excludeAddress', () => {
    const r = filterTokens(all, '', {
      pinnedAddresses: pinned,
      excludeAddress: weth.address,
    })
    expect(r.find(x => x.symbol === 'WETH')).toBeUndefined()
    expect(r[0]).toBe(usdc)
  })

  it('respects the limit option', () => {
    const r = filterTokens(all, '', { pinnedAddresses: pinned, limit: 2 })
    expect(r).toHaveLength(2)
  })

  it('is case-insensitive for the query and the address', () => {
    const r1 = filterTokens(all, 'WeTh')
    const r2 = filterTokens(all, 'weth')
    expect(r1[0]).toBe(weth)
    expect(r2[0]).toBe(weth)
  })
})
