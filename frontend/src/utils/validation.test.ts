import { describe, it, expect } from 'vitest'
import { isValidTokenAddress, isValidAmount, tryParseAmount } from './validation'

describe('isValidTokenAddress', () => {
  it('rejects the zero address', () => {
    expect(isValidTokenAddress('0x0000000000000000000000000000000000000000')).toBe(false)
  })

  it('rejects non-address strings', () => {
    expect(isValidTokenAddress('0xnope')).toBe(false)
    expect(isValidTokenAddress('')).toBe(false)
  })

  it('accepts checksum addresses', () => {
    expect(isValidTokenAddress('0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48')).toBe(true)
  })
})

describe('isValidAmount', () => {
  it('rejects empty / whitespace', () => {
    expect(isValidAmount('')).toBe(false)
    expect(isValidAmount('   ')).toBe(false)
  })

  it('rejects zero and negatives', () => {
    expect(isValidAmount('0')).toBe(false)
    expect(isValidAmount('-1')).toBe(false)
  })

  it('accepts positive decimals', () => {
    expect(isValidAmount('1.5')).toBe(true)
    expect(isValidAmount('0.0001')).toBe(true)
  })
})

describe('tryParseAmount', () => {
  it('returns undefined for empty input', () => {
    expect(tryParseAmount('', 18)).toBeUndefined()
  })

  it('returns the parsed bigint for a valid amount', () => {
    expect(tryParseAmount('1.5', 6)).toBe(1_500_000n)
  })

  it('returns undefined for malformed decimals', () => {
    expect(tryParseAmount('1.2.3', 18)).toBeUndefined()
  })
})
