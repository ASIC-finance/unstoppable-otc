import { describe, it, expect } from 'vitest'
import { txUrl, addressUrl } from './explorer'

describe('txUrl', () => {
  it('returns undefined without a chain id', () => {
    expect(txUrl(undefined, '0xabc')).toBeUndefined()
  })

  it('returns undefined without a hash', () => {
    expect(txUrl(1, undefined)).toBeUndefined()
  })

  it('builds the Etherscan URL for chain 1', () => {
    expect(txUrl(1, '0xabc')).toBe('https://etherscan.io/tx/0xabc')
  })

  it('builds the PulseScan URL for chain 369', () => {
    expect(txUrl(369, '0xabc')).toBe('https://scan.pulsechain.com/tx/0xabc')
  })

  it('returns undefined for unsupported chains', () => {
    expect(txUrl(137, '0xabc')).toBeUndefined()
  })
})

describe('addressUrl', () => {
  it('builds the Etherscan address URL', () => {
    expect(addressUrl(1, '0xdeadbeef')).toBe('https://etherscan.io/address/0xdeadbeef')
  })
})
