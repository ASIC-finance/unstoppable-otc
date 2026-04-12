import { useState } from 'react'
import { useTokenInfo } from '../hooks/useTokenInfo'
import { useTokenLogo } from '../hooks/useTokenLogo'
import { shortenAddress } from '../utils/format'

function Fallback({ symbol }: { symbol: string }) {
  return (
    <span className="token-avatar">
      {symbol.slice(0, 2).toUpperCase()}
    </span>
  )
}

export function TokenBadge({ address }: { address: `0x${string}` }) {
  const { symbol, isLoading } = useTokenInfo(address)
  const logoURI = useTokenLogo(address)
  const [imgError, setImgError] = useState(false)

  if (isLoading) {
    return <span className="token-badge text-[var(--text-muted)]">Loading…</span>
  }

  const label = symbol ?? shortenAddress(address)

  return (
    <span
      className="token-badge"
      title={address}
    >
      {logoURI && !imgError ? (
        <img
          src={logoURI}
          alt=""
          width={24}
          height={24}
          loading="lazy"
          onError={() => setImgError(true)}
        />
      ) : (
        <Fallback symbol={label} />
      )}
      <span className="min-w-0 truncate font-semibold text-[var(--text-strong)]">{label}</span>
    </span>
  )
}
