import { OTCPairABI } from '../abi/OTCPair'
import { useTx } from './useTx'

export function useFillOrder(onSuccess?: () => void) {
  const tx = useTx({ label: 'Fill order', onSuccess })

  function fillOrder(pairAddress: `0x${string}`, orderId: bigint, sellAmountOut: bigint) {
    tx.writeContract({
      address: pairAddress,
      abi: OTCPairABI,
      functionName: 'fillOrder',
      args: [orderId, sellAmountOut],
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
