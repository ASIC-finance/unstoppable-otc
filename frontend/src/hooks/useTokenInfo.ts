import { useReadContracts } from 'wagmi'
import { erc20Abi } from 'viem'
import { isZeroAddress } from '../utils/address'

/**
 * Fetches name / symbol / decimals for a single token via a single multicall.
 * One `useReadContracts` replaces the three separate `useReadContract` calls
 * that used to run per token.
 */
export function useTokenInfo(tokenAddress: `0x${string}` | undefined) {
  const enabled = !!tokenAddress && !isZeroAddress(tokenAddress)

  const { data, isLoading, isError } = useReadContracts({
    allowFailure: true,
    contracts: tokenAddress
      ? [
          { address: tokenAddress, abi: erc20Abi, functionName: 'name' },
          { address: tokenAddress, abi: erc20Abi, functionName: 'symbol' },
          { address: tokenAddress, abi: erc20Abi, functionName: 'decimals' },
        ]
      : [],
    query: { enabled, retry: 1 },
  })

  const name = data?.[0]?.status === 'success' ? (data[0].result as string) : undefined
  const symbol = data?.[1]?.status === 'success' ? (data[1].result as string) : undefined
  const decimalsResult = data?.[2]
  const decimals = decimalsResult?.status === 'success' ? (decimalsResult.result as number) : undefined

  return {
    name,
    symbol,
    decimals,
    isLoading: enabled && isLoading,
    // decimals is the critical field — without it, amount parsing fails.
    isError: isError || decimalsResult?.status === 'failure',
  }
}
