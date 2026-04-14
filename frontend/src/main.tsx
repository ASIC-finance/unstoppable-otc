import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { WagmiProvider } from 'wagmi'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import './config/appkit'
import { wagmiAdapter } from './config/appkit'
import { ensureTokenListLoaded } from './config/tokenlist'
import './index.css'
import App from './App'

// Pre-fetch token logos so they're ready when orders render
ensureTokenListLoaded()

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // On-chain data changes on each block; 15s strikes a balance between
      // freshness and avoiding a re-fetch stampede on every focus.
      staleTime: 15_000,
      gcTime: 5 * 60_000,
      retry: 2,
      refetchOnWindowFocus: false,
    },
  },
})

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <WagmiProvider config={wagmiAdapter.wagmiConfig}>
      <QueryClientProvider client={queryClient}>
        <App />
      </QueryClientProvider>
    </WagmiProvider>
  </StrictMode>,
)
