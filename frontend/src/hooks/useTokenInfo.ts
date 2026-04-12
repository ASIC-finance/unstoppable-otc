import { useReadContract } from 'wagmi'
import { erc20Abi } from 'viem'

export function useTokenInfo(tokenAddress: `0x${string}` | undefined) {
  const enabled = !!tokenAddress && tokenAddress !== '0x0000000000000000000000000000000000000000'

  const nameResult = useReadContract({
    address: tokenAddress!,
    abi: erc20Abi,
    functionName: 'name',
    query: { enabled, retry: 1 },
  })

  const symbolResult = useReadContract({
    address: tokenAddress!,
    abi: erc20Abi,
    functionName: 'symbol',
    query: { enabled, retry: 1 },
  })

  const decimalsResult = useReadContract({
    address: tokenAddress!,
    abi: erc20Abi,
    functionName: 'decimals',
    query: { enabled, retry: 1 },
  })

  return {
    name: nameResult.data as string | undefined,
    symbol: symbolResult.data as string | undefined,
    decimals: decimalsResult.data as number | undefined,
    isLoading: (enabled && nameResult.isLoading) || (enabled && symbolResult.isLoading) || (enabled && decimalsResult.isLoading),
    isError: decimalsResult.isError, // decimals is the critical one
  }
}
