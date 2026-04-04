import { isAddress, parseUnits } from 'viem'

export function isValidTokenAddress(address: string): boolean {
  return isAddress(address) && address !== '0x0000000000000000000000000000000000000000'
}

export function isValidAmount(value: string): boolean {
  if (!value || !value.trim()) return false
  const num = parseFloat(value)
  return !isNaN(num) && num > 0 && isFinite(num)
}

/** Validates that the amount string can actually be parsed for the given decimals. */
export function tryParseAmount(value: string, decimals: number): bigint | undefined {
  if (!isValidAmount(value)) return undefined
  try {
    const parsed = parseUnits(value, decimals)
    return parsed > 0n ? parsed : undefined
  } catch {
    return undefined
  }
}
