import { createAppKit } from '@reown/appkit/react'
import { WagmiAdapter } from '@reown/appkit-adapter-wagmi'
import { networks } from './chains'

const projectId = import.meta.env.VITE_REOWN_PROJECT_ID

if (!projectId) {
  throw new Error('VITE_REOWN_PROJECT_ID is required. Get one at https://cloud.reown.com')
}

export const wagmiAdapter = new WagmiAdapter({
  networks,
  projectId,
  ssr: false,
})

createAppKit({
  adapters: [wagmiAdapter],
  networks,
  projectId,
  metadata: {
    name: 'Unstoppable OTC',
    description: 'Decentralized OTC Trading - Zero Fees',
    url: typeof window !== 'undefined' ? window.location.origin : 'https://unstoppable-otc.pages.dev',
    icons: [],
  },
  features: {
    analytics: false,
    email: false,
    socials: false,
  },
  enableInjected: true,
  enableEIP6963: true,
  enableCoinbase: false,
  enableWallets: true,
})
