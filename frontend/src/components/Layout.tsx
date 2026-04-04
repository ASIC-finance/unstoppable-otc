import { Link, useLocation } from 'react-router-dom'
import { useAppKit } from '@reown/appkit/react'
import { useAccount } from 'wagmi'
import { shortenAddress } from '../utils/format'

const navLinks = [
  { to: '/', label: 'Order Book' },
  { to: '/create', label: 'Create Order' },
  { to: '/my-orders', label: 'My Orders' },
]

export function Layout({ children }: { children: React.ReactNode }) {
  const { open } = useAppKit()
  const { address, isConnected } = useAccount()
  const location = useLocation()

  return (
    <div className="min-h-screen bg-gray-950 text-gray-100">
      <header className="border-b border-gray-800">
        <div className="mx-auto max-w-5xl flex items-center justify-between px-4 py-3">
          <div className="flex items-center gap-6">
            <Link to="/" className="text-lg font-semibold text-white">
              Unstoppable OTC
            </Link>
            <nav className="hidden sm:flex gap-1">
              {navLinks.map(link => (
                <Link
                  key={link.to}
                  to={link.to}
                  className={`px-3 py-1.5 rounded text-sm transition-colors ${
                    location.pathname === link.to
                      ? 'bg-gray-800 text-white'
                      : 'text-gray-400 hover:text-gray-200'
                  }`}
                >
                  {link.label}
                </Link>
              ))}
            </nav>
          </div>
          <button
            onClick={() => open()}
            className="px-4 py-2 rounded-lg text-sm font-medium bg-emerald-600 hover:bg-emerald-500 text-white transition-colors"
          >
            {isConnected && address ? shortenAddress(address) : 'Connect Wallet'}
          </button>
        </div>
        {/* Mobile nav */}
        <nav className="sm:hidden flex border-t border-gray-800">
          {navLinks.map(link => (
            <Link
              key={link.to}
              to={link.to}
              className={`flex-1 text-center py-2 text-sm transition-colors ${
                location.pathname === link.to
                  ? 'bg-gray-800 text-white'
                  : 'text-gray-400'
              }`}
            >
              {link.label}
            </Link>
          ))}
        </nav>
      </header>
      <main className="mx-auto max-w-5xl px-4 py-6">
        {children}
      </main>
    </div>
  )
}
