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
 */
export type Order = {
  maker: Address
  sellToken0: boolean
  sellAmount: bigint
  buyAmount: bigint
  filledSellAmount: bigint
  status: number
}
