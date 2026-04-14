import { OTCPairABI } from '../abi/OTCPair'
import { useTx } from './useTx'

export function useCancelOrder(onSuccess?: () => void) {
  const tx = useTx({ label: 'Cancel order', onSuccess })

  function cancelOrder(pairAddress: `0x${string}`, orderId: bigint) {
    tx.writeContract({
      address: pairAddress,
      abi: OTCPairABI,
      functionName: 'cancelOrder',
      args: [orderId],
    })
  }

  return {
    cancelOrder,
    isPending: tx.isBusy,
    isSuccess: tx.isSuccess,
    status: tx.status,
    error: tx.error,
    reset: tx.reset,
    txHash: tx.txHash,
  }
}
