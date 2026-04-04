import { useWriteContract, useWaitForTransactionReceipt } from 'wagmi'
import { parseUnits } from 'viem'
import { OTCPairABI } from '../abi/OTCPair'

export function useCreateOrder() {
  const { writeContract, data: txHash, isPending, error, reset } = useWriteContract()
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash: txHash })

  function createOrder(
    pairAddress: `0x${string}`,
    sellToken0: boolean,
    sellAmount: string,
    buyAmount: string,
    sellDecimals: number,
    buyDecimals: number,
  ) {
    writeContract({
      address: pairAddress,
      abi: OTCPairABI,
      functionName: 'createOrder',
      args: [sellToken0, parseUnits(sellAmount, sellDecimals), parseUnits(buyAmount, buyDecimals)],
    })
  }

  return { createOrder, isPending: isPending || isConfirming, isSuccess, error, reset, txHash }
}
