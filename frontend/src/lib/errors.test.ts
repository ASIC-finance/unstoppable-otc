import { describe, it, expect } from 'vitest'
import { BaseError, UserRejectedRequestError } from 'viem'
import { parseContractError } from './errors'

describe('parseContractError', () => {
  it('returns a safe shape for plain Error instances', () => {
    const parsed = parseContractError(new Error('boom'))
    expect(parsed.title).toBe('Transaction failed')
    expect(parsed.message).toBe('boom')
    expect(parsed.userRejected).toBe(false)
  })

  it('returns a safe shape for null / undefined', () => {
    expect(parseContractError(null).userRejected).toBe(false)
    expect(parseContractError(undefined).title).toBe('Unknown error')
  })

  it('stringifies non-error values', () => {
    expect(parseContractError('something').message).toBe('something')
  })

  it('surfaces viem shortMessage when the cause is not a known type', () => {
    const err = new BaseError('a short description')
    const parsed = parseContractError(err)
    expect(parsed.title).toBe('Transaction failed')
    expect(parsed.message.length).toBeGreaterThan(0)
  })

  it('detects user rejection anywhere in the cause chain', () => {
    const rejection = new UserRejectedRequestError(new Error('User denied'))
    const wrapped = new BaseError('Top-level wrapper', { cause: rejection })
    const parsed = parseContractError(wrapped)
    expect(parsed.userRejected).toBe(true)
    expect(parsed.title).toBe('Rejected in wallet')
  })
})
