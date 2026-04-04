import { formatUnits } from 'viem'

export function shortenAddress(address: string): string {
  return `${address.slice(0, 6)}...${address.slice(-4)}`
}

export function formatTokenAmount(amount: bigint, decimals: number): string {
  const formatted = formatUnits(amount, decimals)
  const num = parseFloat(formatted)
  if (num === 0) return '0'
  if (num < 0.0001) return '<0.0001'
  if (num < 1) return num.toFixed(4)
  if (num < 10000) return num.toFixed(2)
  return num.toLocaleString('en-US', { maximumFractionDigits: 2 })
}

export function filledPercent(sellAmount: bigint, filledSellAmount: bigint): number {
  if (sellAmount === 0n) return 0
  return Number((filledSellAmount * 100n) / sellAmount)
}
