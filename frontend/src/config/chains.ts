import { defineChain } from '@reown/appkit/networks'
import type { AppKitNetwork } from '@reown/appkit/networks'
import { ZERO_ADDRESS } from '../utils/address'

export const pulsechain = defineChain({
  id: 369,
  caipNetworkId: 'eip155:369',
  chainNamespace: 'eip155',
  name: 'PulseChain',
  nativeCurrency: { name: 'Pulse', symbol: 'PLS', decimals: 18 },
  rpcUrls: {
    default: { http: ['https://rpc.pulsechain.com'] },
  },
  blockExplorers: {
    default: { name: 'PulseScan', url: 'https://scan.pulsechain.com' },
  },
})

export const ethereum = defineChain({
  id: 1,
  caipNetworkId: 'eip155:1',
  chainNamespace: 'eip155',
  name: 'Ethereum',
  nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
  rpcUrls: {
    default: { http: ['https://eth.drpc.org'] },
  },
  blockExplorers: {
    default: { name: 'Etherscan', url: 'https://etherscan.io' },
  },
})

type ChainConfig = {
  network: AppKitNetwork
  factoryAddress: `0x${string}`
}

export const supportedChains: ChainConfig[] = [
  {
    network: ethereum,
    factoryAddress: '0x0000000000000000000000000000000000000000', // TODO: deploy and update
  },
  {
    network: pulsechain,
    factoryAddress: '0x0000000000000000000000000000000000000000', // TODO: deploy and update
  },
]

export const networks = supportedChains.map(c => c.network) as [AppKitNetwork, ...AppKitNetwork[]]

export function getFactoryAddress(chainId: number | undefined): `0x${string}` | undefined {
  if (!chainId) return undefined
  const addr = supportedChains.find(c => c.network.id === chainId)?.factoryAddress
  if (!addr || addr === ZERO_ADDRESS) return undefined
  return addr
}

export function isChainSupported(chainId: number | undefined): boolean {
  if (!chainId) return false
  return supportedChains.some(c => c.network.id === chainId)
}

export function getSupportedChain(chainId: number | undefined) {
  if (!chainId) return undefined
  return supportedChains.find(c => c.network.id === chainId)
}
