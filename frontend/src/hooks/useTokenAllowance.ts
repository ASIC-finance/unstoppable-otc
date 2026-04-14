import { useReadContract } from 'wagmi'
import { erc20Abi, maxUint256 } from 'viem'
import { useTx } from './useTx'

export type ApprovalMode = 'exact' | 'max'

export function useTokenAllowance(
  tokenAddress: `0x${string}` | undefined,
  owner: `0x${string}` | undefined,
  spender: `0x${string}` | undefined,
  symbol?: string,
) {
  const enabled = !!tokenAddress && !!owner && !!spender

  const { data: allowance, refetch } = useReadContract({
    address: tokenAddress!,
    abi: erc20Abi,
    functionName: 'allowance',
    args: [owner!, spender!],
    query: { enabled },
  })

  const tx = useTx({ label: symbol ? `Approve ${symbol}` : 'Approve', onSuccess: () => refetch() })

  function approve(amount?: bigint) {
    if (!tokenAddress || !spender) return
    tx.writeContract({
      address: tokenAddress,
      abi: erc20Abi,
      functionName: 'approve',
      args: [spender, amount ?? maxUint256],
    })
  }

  return {
    allowance: allowance ?? 0n,
    approve,
    refetchAllowance: refetch,
    isApproving: tx.isBusy,
    approvalConfirmed: tx.isSuccess,
    approvalStatus: tx.status,
    resetApproval: tx.reset,
  }
}
