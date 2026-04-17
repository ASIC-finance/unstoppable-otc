import type { Address } from 'viem'

/**
 * Order status mirrors the on-chain `enum OrderStatus` in OTCPair.sol.
 * Kept as a numeric-backed const object so the widen-to-number behaviour
 * of ABI decoding (uint8) lines up without casts.
 */
export const OrderStatus = {
  Active: 0,
  Filled: 1,
  Cancelled: 2,
} as const

export type OrderStatusCode = (typeof OrderStatus)[keyof typeof OrderStatus]

/**
 * Mirrors `struct Order` in OTCPair.sol.
 * ABI decoding yields a readonly object-shape; this aliases it so the shape
 * lives in one place — drift with the contract surfaces as a type error.
 *
 * Note: field order matches the on-chain struct exactly
 * (maker, sellToken0, status, minBuyBps, sellAmount, buyAmount, filledSellAmount)
 * so that tuple-decoded results line up without manual remapping.
 */
export type Order = {
  maker: Address
  sellToken0: boolean
  status: number
  /**
   * Maker's minimum delivered buy-token as basis points of the quoted price.
   *  10000 = 0% slippage allowed (vanilla ERC-20s).
   *   9900 = 1% slippage allowed (e.g. fee-on-transfer buy token).
   * Zero and >10000 are rejected by the contract.
   */
  minBuyBps: number
  sellAmount: bigint
  buyAmount: bigint
  filledSellAmount: bigint
}

/**
 * 10000 bps = 0% slippage. Default applied by the UI for all orders unless
 * the maker explicitly opts into a lower tolerance.
 */
export const DEFAULT_MIN_BUY_BPS = 10_000

/** Basis-points → human percentage, e.g. 9900 → "1%". */
export function bpsToSlippagePercent(bps: number): string {
  const diff = DEFAULT_MIN_BUY_BPS - bps
  if (diff <= 0) return '0%'
  // One decimal place keeps 10 bps (0.1%) readable.
  const pct = diff / 100
  return pct >= 1 ? `${pct.toFixed(pct % 1 === 0 ? 0 : 1)}%` : `${pct.toFixed(1)}%`
}
