import { useReadContract, useChainId } from 'wagmi'
import { getFactoryAddress } from '../config/chains'
import { OTCFactoryABI } from '../abi/OTCFactory'
import { useTx } from './useTx'

export function usePairAddress(tokenA: `0x${string}` | undefined, tokenB: `0x${string}` | undefined) {
  const chainId = useChainId()
  const factory = getFactoryAddress(chainId)

  return useReadContract({
    address: factory,
    abi: OTCFactoryABI,
    functionName: 'getPair',
    args: [tokenA!, tokenB!],
    query: { enabled: !!factory && !!tokenA && !!tokenB },
  })
}

export function useAllPairsLength() {
  const chainId = useChainId()
  const factory = getFactoryAddress(chainId)

  return useReadContract({
    address: factory,
    abi: OTCFactoryABI,
    functionName: 'allPairsLength',
    query: { enabled: !!factory },
  })
}

export function useAllPairs(offset: number, limit: number) {
  const chainId = useChainId()
  const factory = getFactoryAddress(chainId)

  return useReadContract({
    address: factory,
    abi: OTCFactoryABI,
    functionName: 'getPairs',
    args: [BigInt(offset), BigInt(limit)],
    query: { enabled: !!factory && limit > 0 },
  })
}

export function useCreatePair(onSuccess?: () => void) {
  const chainId = useChainId()
  const factory = getFactoryAddress(chainId)
  const tx = useTx({ label: 'Create pair', onSuccess })

  function createPair(tokenA: `0x${string}`, tokenB: `0x${string}`) {
    if (!factory) return
    tx.writeContract({
      address: factory,
      abi: OTCFactoryABI,
      functionName: 'createPair',
      args: [tokenA, tokenB],
    })
  }

  return {
    createPair,
    isPending: tx.isBusy,
    isSuccess: tx.isSuccess,
    status: tx.status,
    error: tx.error,
    reset: tx.reset,
    txHash: tx.txHash,
  }
}
