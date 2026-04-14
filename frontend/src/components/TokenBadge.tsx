import { useState } from 'react'
import { useTokenInfo } from '../hooks/useTokenInfo'
import { useTokenLogo } from '../hooks/useTokenLogo'
import { Skeleton } from './Skeleton'
import { shortenAddress } from '../utils/format'

function Fallback({ symbol }: { symbol: string }) {
  return (
    <span className="token-avatar" aria-hidden="true">
      {symbol.slice(0, 2).toUpperCase()}
    </span>
  )
}

export function TokenBadge({ address }: { address: `0x${string}` }) {
  const { symbol, isLoading } = useTokenInfo(address)
  const logoURI = useTokenLogo(address)

  // Reset error state during render when the logo URL changes (chain switch,
  // late token-list resolution). This is React's documented pattern for
  // deriving state from props — safer than using useEffect + setState.
  const [imgError, setImgError] = useState(false)
  const [prevLogo, setPrevLogo] = useState(logoURI)
  if (prevLogo !== logoURI) {
    setPrevLogo(logoURI)
    setImgError(false)
  }

  if (isLoading) {
    return (
      <span className="token-badge">
        <Skeleton width={22} height={22} rounded="full" />
        <Skeleton width={48} />
      </span>
    )
  }

  const label = symbol ?? shortenAddress(address)

  return (
    <span className="token-badge" title={address}>
      {logoURI && !imgError ? (
        <img
          src={logoURI}
          alt=""
          width={24}
          height={24}
          loading="lazy"
          decoding="async"
          onError={() => setImgError(true)}
        />
      ) : (
        <Fallback symbol={label} />
      )}
      <span className="min-w-0 truncate font-semibold text-[var(--text-strong)]">{label}</span>
    </span>
  )
}
