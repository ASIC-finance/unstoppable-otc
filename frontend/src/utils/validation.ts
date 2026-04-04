import { isAddress } from 'viem'

export function isValidTokenAddress(address: string): boolean {
  return isAddress(address) && address !== '0x0000000000000000000000000000000000000000'
}

export function isValidAmount(value: string): boolean {
  if (!value) return false
  const num = parseFloat(value)
  return !isNaN(num) && num > 0 && isFinite(num)
}
