import { parseUnits } from 'viem'
import { OTCPairABI } from '../abi/OTCPair'
import { useTx } from './useTx'

export function useCreateOrder(onSuccess?: () => void) {
  const tx = useTx({ label: 'Create order', onSuccess })

  function createOrder(
    pairAddress: `0x${string}`,
    sellToken0: boolean,
    sellAmount: string,
    buyAmount: string,
    sellDecimals: number,
    buyDecimals: number,
  ) {
    tx.writeContract({
      address: pairAddress,
      abi: OTCPairABI,
      functionName: 'createOrder',
      args: [sellToken0, parseUnits(sellAmount, sellDecimals), parseUnits(buyAmount, buyDecimals)],
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
