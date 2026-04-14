import { describe, it, expect } from 'vitest'
import { shortenAddress, formatTokenAmount, filledPercent } from './format'

describe('shortenAddress', () => {
  it('preserves 0x prefix and truncates the middle', () => {
    expect(shortenAddress('0x1234567890abcdef1234567890abcdef12345678'))
      .toBe('0x1234...5678')
  })
})

describe('formatTokenAmount', () => {
  it('returns "0" for a zero amount regardless of decimals', () => {
    expect(formatTokenAmount(0n, 18)).toBe('0')
  })

  it('returns "<0.0001" for dust amounts', () => {
    expect(formatTokenAmount(1n, 18)).toBe('<0.0001')
  })

  it('uses 4-decimal formatting for < 1', () => {
    // 0.5 * 1e18
    expect(formatTokenAmount(500_000_000_000_000_000n, 18)).toBe('0.5000')
  })

  it('uses 2-decimal formatting for 1–9999', () => {
    // 1234.56 * 1e18
    expect(formatTokenAmount(1234560000000000000000n, 18)).toBe('1234.56')
  })

  it('uses locale formatting with commas above 10k', () => {
    // 12345.67 * 1e6
    expect(formatTokenAmount(12_345_670_000n, 6)).toBe('12,345.67')
  })
})

describe('filledPercent', () => {
  it('returns 0 when sellAmount is 0', () => {
    expect(filledPercent(0n, 0n)).toBe(0)
  })

  it('returns 100 for a fully filled order', () => {
    expect(filledPercent(100n, 100n)).toBe(100)
  })

  it('truncates partial fills (no rounding up)', () => {
    // 499 / 1000 = 49.9 → 49 (integer division)
    expect(filledPercent(1000n, 499n)).toBe(49)
  })
})
