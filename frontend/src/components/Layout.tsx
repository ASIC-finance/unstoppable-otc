import { Link, useLocation } from 'react-router-dom'
import { useAppKit } from '@reown/appkit/react'
import { useAccount, useChainId } from 'wagmi'
import { supportedChains } from '../config/chains'
import { shortenAddress } from '../utils/format'
import { useTheme, type ThemePreference } from '../hooks/useTheme'
import { WrongChainBanner } from './WrongChainBanner'

const themeModes: Record<ThemePreference, { next: ThemePreference; label: string; value: string }> = {
  light: { next: 'dark', label: 'Light theme', value: 'Light' },
  dark: { next: 'system', label: 'Dark theme', value: 'Dark' },
  system: { next: 'light', label: 'System theme', value: 'System' },
}

const navLinks = [
  { to: '/', label: 'Order Book' },
  { to: '/create', label: 'Create Order' },
  { to: '/my-orders', label: 'My Orders' },
]

export function Layout({ children }: { children: React.ReactNode }) {
  const { open } = useAppKit()
  const { address, isConnected } = useAccount()
  const chainId = useChainId()
  const location = useLocation()
  const { preference, setPreference } = useTheme()
  const currentTheme = themeModes[preference]
  const network = supportedChains.find(chain => chain.network.id === chainId)?.network.name

  return (
    <div className="app-shell">
      <a href="#main-content" className="skip-link">Skip to content</a>

      <div className="app-frame">
        <header className="app-topbar">
          <Link to="/" className="brand-lockup" aria-label="Unstoppable OTC home">
            <span className="brand-mark" aria-hidden="true">
              <img src="/favicon.svg" alt="" width={24} height={24} fetchPriority="high" />
            </span>
            <span className="brand-text">
              <span className="brand-title">Unstoppable OTC</span>
              <span className="brand-subtitle">On-chain order book</span>
            </span>
          </Link>

          <nav aria-label="Primary" className="primary-nav">
            {navLinks.map(link => {
              const isActive = location.pathname === link.to
              return (
                <Link
                  key={link.to}
                  to={link.to}
                  aria-current={isActive ? 'page' : undefined}
                  data-active={isActive}
                  className="nav-link"
                >
                  {link.label}
                </Link>
              )
            })}
          </nav>

          <div className="topbar-actions">
            <span className="status-chip" data-state={isConnected ? 'online' : 'idle'}>
              <span aria-hidden="true" />
              {network ?? (isConnected ? `Chain ${chainId}` : 'No Wallet')}
            </span>
            <button
              type="button"
              onClick={() => setPreference(currentTheme.next)}
              className="ghost-button theme-button"
              aria-label={`${currentTheme.label}. Click to switch theme.`}
              title={currentTheme.label}
            >
              {currentTheme.value}
            </button>
            <button
              type="button"
              onClick={() => open()}
              className="wallet-button"
            >
              {isConnected && address ? shortenAddress(address) : 'Connect Wallet'}
            </button>
          </div>
        </header>

        <WrongChainBanner />

        <main id="main-content" className="app-main">
          {children}
        </main>
      </div>
    </div>
  )
}
