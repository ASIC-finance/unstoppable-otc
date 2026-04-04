import { mainnet, arbitrum, optimism, polygon, base, sepolia } from '@reown/appkit/networks'
import type { AppKitNetwork } from '@reown/appkit/networks'

type ChainConfig = {
  network: AppKitNetwork
  factoryAddress: `0x${string}`
}

export const supportedChains: ChainConfig[] = [
  {
    network: sepolia,
    factoryAddress: '0x0000000000000000000000000000000000000000', // TODO: deploy and update
  },
  // Add more chains by adding entries here:
  // { network: mainnet, factoryAddress: '0x...' },
  // { network: base, factoryAddress: '0x...' },
]

export const networks = supportedChains.map(c => c.network) as [AppKitNetwork, ...AppKitNetwork[]]

export function getFactoryAddress(chainId: number | undefined): `0x${string}` | undefined {
  if (!chainId) return undefined
  return supportedChains.find(c => c.network.id === chainId)?.factoryAddress
}

export { mainnet, arbitrum, optimism, polygon, base, sepolia }
