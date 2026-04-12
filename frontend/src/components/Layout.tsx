import { Link, useLocation } from 'react-router-dom'
import { useAppKit } from '@reown/appkit/react'
import { useAccount } from 'wagmi'
import heroMark from '../assets/hero.png'
import { shortenAddress } from '../utils/format'
import { useTheme, type ThemePreference } from '../hooks/useTheme'

const themeIcons: Record<ThemePreference, { icon: string; next: ThemePreference; label: string }> = {
  light: { icon: '\u2600\uFE0F', next: 'dark', label: 'Light mode' },
  dark: { icon: '\uD83C\uDF19', next: 'system', label: 'Dark mode' },
  system: { icon: '\uD83D\uDDA5\uFE0F', next: 'light', label: 'System mode' },
}

const navLinks = [
  { to: '/', label: 'Order Book' },
  { to: '/create', label: 'Create Order' },
  { to: '/my-orders', label: 'My Orders' },
]

export function Layout({ children }: { children: React.ReactNode }) {
  const { open } = useAppKit()
  const { address, isConnected } = useAccount()
  const location = useLocation()
  const { preference, setPreference } = useTheme()
  const currentTheme = themeIcons[preference]

  return (
    <div className="min-h-screen">
      <a href="#main-content" className="skip-link">Skip to content</a>

      <div className="mx-auto flex min-h-screen max-w-7xl flex-col px-4 pb-10 pt-4 sm:px-6 lg:px-8">
        <header className="sticky top-4 z-30 mb-6">
          <div className="surface px-4 py-4 sm:px-6">
            <div className="flex flex-col gap-4">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                <Link to="/" className="flex min-w-0 items-center gap-4 rounded-[1.6rem]">
                  <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-[1.35rem] bg-[var(--surface-dark)] shadow-[0_16px_30px_rgba(21,33,29,0.16)]">
                    <img
                      src={heroMark}
                      alt=""
                      width={36}
                      height={36}
                      fetchPriority="high"
                      className="brand-orb h-9 w-9 object-contain"
                    />
                  </div>

                  <div className="min-w-0">
                    <p className="section-label mb-1">Unstoppable OTC</p>
                    <p className="text-base font-semibold tracking-tight text-[var(--text-strong)] sm:text-lg">
                      OTC routing with calmer market context.
                    </p>
                    <p className="mt-1 max-w-xl text-sm leading-6 text-[var(--text-soft)]">
                      Self-custodial order flow for deliberate token trades.
                    </p>
                  </div>
                </Link>

                <button
                  type="button"
                  onClick={() => open()}
                  className="wallet-button w-full sm:w-auto"
                >
                  <span className="inline-flex h-2.5 w-2.5 rounded-full bg-emerald-300" aria-hidden="true" />
                  {isConnected && address ? shortenAddress(address) : 'Connect Wallet'}
                </button>
              </div>

              <div className="border-t border-[var(--border-soft)] pt-4">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                  <nav aria-label="Primary" className="flex flex-wrap gap-2">
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

                  <div className="flex items-center gap-2 self-start lg:self-auto">
                    <button
                      type="button"
                      onClick={() => setPreference(currentTheme.next)}
                      className="ghost-button min-h-0 px-2.5 py-2 text-base"
                      aria-label={`${currentTheme.label}. Click to switch.`}
                      title={currentTheme.label}
                    >
                      {currentTheme.icon}
                    </button>
                    <span className="kpi-pill">
                      {isConnected ? 'Wallet Connected' : 'Wallet Required'}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </header>

        <main id="main-content" className="min-w-0 flex-1">
          {children}
        </main>
      </div>
    </div>
  )
}
