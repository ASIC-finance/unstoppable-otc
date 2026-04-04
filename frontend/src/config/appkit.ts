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
    url: 'https://unstoppable-otc.xyz',
    icons: [],
  },
  features: {
    analytics: false,
  },
})
