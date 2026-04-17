import { parseUnits } from 'viem'
import { OTCPairABI } from '../abi/OTCPair'
import { DEFAULT_MIN_BUY_BPS } from '../types/orders'
import { useTx } from './useTx'

export function useCreateOrder(onSuccess?: () => void) {
  const tx = useTx({ label: 'Create order', onSuccess })

  /**
   * Create an OTC order.
   *
   * `minBuyBps` controls the maker's slippage tolerance for the buy side.
   * 10000 (default) = zero slippage allowed — rejects fee-on-transfer buy
   * tokens. Lower values (e.g. 9900 for 1%) explicitly opt in and let
   * the order fill against FoT tokens at the cost of a lower payout.
   */
  function createOrder(
    pairAddress: `0x${string}`,
    sellToken0: boolean,
    sellAmount: string,
    buyAmount: string,
    sellDecimals: number,
    buyDecimals: number,
    minBuyBps: number = DEFAULT_MIN_BUY_BPS,
  ) {
    tx.writeContract({
      address: pairAddress,
      abi: OTCPairABI,
      functionName: 'createOrder',
      args: [
        sellToken0,
        parseUnits(sellAmount, sellDecimals),
        parseUnits(buyAmount, buyDecimals),
        minBuyBps,
      ],
    })
  }

  return {
    createOrder,
    isPending: tx.isBusy,
    isSuccess: tx.isSuccess,
    status: tx.status,
    error: tx.error,
    reset: tx.reset,
    txHash: tx.txHash,
  }
}
