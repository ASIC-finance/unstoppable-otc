import { describe, it, expect } from 'vitest'
import { isSameAddress, isZeroAddress, ZERO_ADDRESS } from './address'

describe('isSameAddress', () => {
  it('is case-insensitive', () => {
    expect(isSameAddress(
      '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
      '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48',
    )).toBe(true)
  })

  it('returns false for undefined inputs', () => {
    expect(isSameAddress(undefined, '0x1234')).toBe(false)
    expect(isSameAddress('0x1234', null)).toBe(false)
  })

  it('returns false for distinct addresses', () => {
    expect(isSameAddress('0x1', '0x2')).toBe(false)
  })
})

describe('isZeroAddress', () => {
  it('detects the canonical zero address', () => {
    expect(isZeroAddress(ZERO_ADDRESS)).toBe(true)
  })

  it('detects a non-checksum zero address', () => {
    expect(isZeroAddress('0x0000000000000000000000000000000000000000')).toBe(true)
  })

  it('returns true for undefined / null', () => {
    expect(isZeroAddress(undefined)).toBe(true)
    expect(isZeroAddress(null)).toBe(true)
  })

  it('returns false for non-zero addresses', () => {
    expect(isZeroAddress('0x0000000000000000000000000000000000000001')).toBe(false)
  })
})
