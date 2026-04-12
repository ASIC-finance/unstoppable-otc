import { useState } from 'react'
import { useTokenInfo } from '../hooks/useTokenInfo'
import { useTokenLogo } from '../hooks/useTokenLogo'
import { shortenAddress } from '../utils/format'

function Fallback({ symbol }: { symbol: string }) {
  return (
    <span className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[var(--surface-dark)] text-[10px] font-bold text-stone-100">
      {symbol.slice(0, 2).toUpperCase()}
    </span>
  )
}

export function TokenBadge({ address }: { address: `0x${string}` }) {
  const { symbol, isLoading } = useTokenInfo(address)
  const logoURI = useTokenLogo(address)
  const [imgError, setImgError] = useState(false)

  if (isLoading) {
    return <span className="text-sm text-[var(--text-muted)]">Loading…</span>
  }

  const label = symbol ?? shortenAddress(address)

  return (
    <span
      className="inline-flex min-w-0 items-center gap-2 rounded-full border border-[var(--border-soft)] bg-white/70 px-2.5 py-1.5 text-sm shadow-[0_10px_24px_rgba(33,44,39,0.06)]"
      title={address}
    >
      {logoURI && !imgError ? (
        <img
          src={logoURI}
          alt=""
          width={24}
          height={24}
          className="h-6 w-6 shrink-0 rounded-full"
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
