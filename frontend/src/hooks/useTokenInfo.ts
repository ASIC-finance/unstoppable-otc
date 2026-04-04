import { useReadContracts } from 'wagmi'
import { erc20Abi } from 'viem'

export function useTokenInfo(tokenAddress: `0x${string}` | undefined) {
  const enabled = !!tokenAddress && tokenAddress !== '0x0000000000000000000000000000000000000000'

  const contract = {
    address: tokenAddress!,
    abi: erc20Abi,
  }

  const result = useReadContracts({
    contracts: [
      { ...contract, functionName: 'name' },
      { ...contract, functionName: 'symbol' },
      { ...contract, functionName: 'decimals' },
    ],
    query: { enabled },
  })

  const name = result.data?.[0]?.result as string | undefined
  const symbol = result.data?.[1]?.result as string | undefined
  const decimals = result.data?.[2]?.result as number | undefined

  return {
    name,
    symbol,
    decimals,
    isLoading: result.isLoading,
    isError: result.isError,
  }
}
