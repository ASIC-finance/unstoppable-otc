import { useReadContract, useWriteContract, useWaitForTransactionReceipt } from 'wagmi'
import { erc20Abi, maxUint256 } from 'viem'

export function useTokenAllowance(
  tokenAddress: `0x${string}` | undefined,
  owner: `0x${string}` | undefined,
  spender: `0x${string}` | undefined,
) {
  const enabled = !!tokenAddress && !!owner && !!spender

  const { data: allowance, refetch } = useReadContract({
    address: tokenAddress!,
    abi: erc20Abi,
    functionName: 'allowance',
    args: [owner!, spender!],
    query: { enabled },
  })

  const { writeContract, data: txHash, isPending: isApproving, reset } = useWriteContract()

  const { isLoading: isWaitingApproval, isSuccess: approvalConfirmed } = useWaitForTransactionReceipt({
    hash: txHash,
  })

  function approve() {
    if (!tokenAddress || !spender) return
    writeContract({
      address: tokenAddress,
      abi: erc20Abi,
      functionName: 'approve',
      args: [spender, maxUint256],
    })
  }

  return {
    allowance: allowance ?? 0n,
    approve,
    refetchAllowance: refetch,
    isApproving: isApproving || isWaitingApproval,
    approvalConfirmed,
    resetApproval: reset,
  }
}
