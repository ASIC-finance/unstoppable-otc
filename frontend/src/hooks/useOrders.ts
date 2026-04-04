import { useReadContract } from 'wagmi'
import { OTCPairABI } from '../abi/OTCPair'

// All pair queries take the pair address directly (no chain lookup needed)

export function useActiveOrderCount(pairAddress: `0x${string}` | undefined) {
  return useReadContract({
    address: pairAddress,
    abi: OTCPairABI,
    functionName: 'getActiveOrderCount',
    query: { enabled: !!pairAddress },
  })
}

export function useActiveOrders(pairAddress: `0x${string}` | undefined, offset: number, limit: number) {
  return useReadContract({
    address: pairAddress,
    abi: OTCPairABI,
    functionName: 'getActiveOrders',
    args: [BigInt(offset), BigInt(limit)],
    query: { enabled: !!pairAddress && limit > 0 },
  })
}

export function useMakerOrderCount(pairAddress: `0x${string}` | undefined, maker: `0x${string}` | undefined) {
  return useReadContract({
    address: pairAddress,
    abi: OTCPairABI,
    functionName: 'getMakerOrderCount',
    args: [maker!],
    query: { enabled: !!pairAddress && !!maker },
  })
}

export function useMakerOrders(
  pairAddress: `0x${string}` | undefined,
  maker: `0x${string}` | undefined,
  offset: number,
  limit: number,
) {
  return useReadContract({
    address: pairAddress,
    abi: OTCPairABI,
    functionName: 'getMakerOrders',
    args: [maker!, BigInt(offset), BigInt(limit)],
    query: { enabled: !!pairAddress && !!maker && limit > 0 },
  })
}

export function usePairTokens(pairAddress: `0x${string}` | undefined) {
  const { data: token0 } = useReadContract({
    address: pairAddress,
    abi: OTCPairABI,
    functionName: 'token0',
    query: { enabled: !!pairAddress },
  })
  const { data: token1 } = useReadContract({
    address: pairAddress,
    abi: OTCPairABI,
    functionName: 'token1',
    query: { enabled: !!pairAddress },
  })
  return {
    token0: token0 as `0x${string}` | undefined,
    token1: token1 as `0x${string}` | undefined,
  }
}
