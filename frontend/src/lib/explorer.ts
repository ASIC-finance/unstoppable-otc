import { supportedChains } from '../config/chains'

function explorerBase(chainId: number | undefined): string | undefined {
  if (!chainId) return undefined
  const network = supportedChains.find(c => c.network.id === chainId)?.network
  return network?.blockExplorers?.default?.url
}

export function txUrl(chainId: number | undefined, hash: `0x${string}` | string | undefined): string | undefined {
  const base = explorerBase(chainId)
  if (!base || !hash) return undefined
  return `${base.replace(/\/$/, '')}/tx/${hash}`
}

export function addressUrl(chainId: number | undefined, address: string | undefined): string | undefined {
  const base = explorerBase(chainId)
  if (!base || !address) return undefined
  return `${base.replace(/\/$/, '')}/address/${address}`
}
