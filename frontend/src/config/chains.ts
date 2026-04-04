import { defineChain } from '@reown/appkit/networks'
import type { AppKitNetwork } from '@reown/appkit/networks'

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

type ChainConfig = {
  network: AppKitNetwork
  factoryAddress: `0x${string}`
}

export const supportedChains: ChainConfig[] = [
  {
    network: pulsechain,
    factoryAddress: '0x0000000000000000000000000000000000000000', // TODO: deploy and update
  },
]

export const networks = supportedChains.map(c => c.network) as [AppKitNetwork, ...AppKitNetwork[]]

const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000'

export function getFactoryAddress(chainId: number | undefined): `0x${string}` | undefined {
  if (!chainId) return undefined
  const addr = supportedChains.find(c => c.network.id === chainId)?.factoryAddress
  if (!addr || addr === ZERO_ADDRESS) return undefined
  return addr
}
