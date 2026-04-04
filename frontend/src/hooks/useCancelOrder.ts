import { useWriteContract, useWaitForTransactionReceipt } from 'wagmi'
import { OTCPairABI } from '../abi/OTCPair'

export function useCancelOrder() {
  const { writeContract, data: txHash, isPending, error, reset } = useWriteContract()
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash: txHash })

  function cancelOrder(pairAddress: `0x${string}`, orderId: bigint) {
    writeContract({
      address: pairAddress,
      abi: OTCPairABI,
      functionName: 'cancelOrder',
      args: [orderId],
    })
  }

  return { cancelOrder, isPending: isPending || isConfirming, isSuccess, error, reset, txHash }
}
