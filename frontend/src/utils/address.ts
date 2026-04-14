import type { Address } from 'viem'

export const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000' as const satisfies Address

export function isZeroAddress(address: string | undefined | null): boolean {
  if (!address) return true
  return address.toLowerCase() === ZERO_ADDRESS
}

/** Case-insensitive equality for EVM addresses. Both arguments optional — returns false if either is missing. */
export function isSameAddress(
  a: string | undefined | null,
  b: string | undefined | null,
): boolean {
  if (!a || !b) return false
  return a.toLowerCase() === b.toLowerCase()
}
