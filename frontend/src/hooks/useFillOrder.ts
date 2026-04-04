import { useWriteContract, useWaitForTransactionReceipt } from 'wagmi'
import { OTCPairABI } from '../abi/OTCPair'

export function useFillOrder() {
  const { writeContract, data: txHash, isPending, error, reset } = useWriteContract()
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash: txHash })

  function fillOrder(pairAddress: `0x${string}`, orderId: bigint, sellAmountOut: bigint) {
    writeContract({
      address: pairAddress,
      abi: OTCPairABI,
      functionName: 'fillOrder',
      args: [orderId, sellAmountOut],
    })
  }

  return { fillOrder, isPending: isPending || isConfirming, isSuccess, error, reset, txHash }
}
