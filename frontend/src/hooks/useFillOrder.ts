import { maxUint256 } from 'viem'
import { OTCPairABI } from '../abi/OTCPair'
import { useTx } from './useTx'

export function useFillOrder(onSuccess?: () => void) {
  const tx = useTx({ label: 'Fill order', onSuccess })

  /**
   * Fill an OTC order.
   *
   * `maxBuyAmountIn` is the maximum buy-token the taker is willing to spend.
   * Defaults to `type(uint256).max` — the contract computes the actual cost
   * deterministically from (sellAmountOut × buyAmount / sellAmount, rounded
   * up), so passing infinity is safe for callers who built the fill form
   * against the on-chain price. Pass a tighter cap when defending against
   * front-run price shifts or when simulating a quoted max.
   */
  function fillOrder(
    pairAddress: `0x${string}`,
    orderId: bigint,
    sellAmountOut: bigint,
    maxBuyAmountIn: bigint = maxUint256,
  ) {
    tx.writeContract({
      address: pairAddress,
      abi: OTCPairABI,
      functionName: 'fillOrder',
      args: [orderId, sellAmountOut, maxBuyAmountIn],
    })
  }

  return {
    fillOrder,
    isPending: tx.isBusy,
    isSuccess: tx.isSuccess,
    status: tx.status,
    error: tx.error,
    reset: tx.reset,
    txHash: tx.txHash,
  }
}
