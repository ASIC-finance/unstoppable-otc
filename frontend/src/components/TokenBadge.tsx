import { useState } from 'react'
import { useTokenInfo } from '../hooks/useTokenInfo'
import { useTokenLogo } from '../hooks/useTokenLogo'
import { shortenAddress } from '../utils/format'

function Fallback({ symbol }: { symbol: string }) {
  return (
    <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-gray-700 text-[10px] font-bold text-gray-300 shrink-0">
      {symbol.slice(0, 2).toUpperCase()}
    </span>
  )
}

export function TokenBadge({ address }: { address: `0x${string}` }) {
  const { symbol, isLoading } = useTokenInfo(address)
  const logoURI = useTokenLogo(address)
  const [imgError, setImgError] = useState(false)

  if (isLoading) {
    return <span className="text-gray-500 text-sm">...</span>
  }

  const label = symbol ?? shortenAddress(address)

  return (
    <span className="inline-flex items-center gap-1.5" title={address}>
      {logoURI && !imgError ? (
        <img
          src={logoURI}
          alt={label}
          width={20}
          height={20}
          className="rounded-full shrink-0"
          onError={() => setImgError(true)}
        />
      ) : (
        <Fallback symbol={label} />
      )}
      <span className="font-medium text-gray-100">{label}</span>
    </span>
  )
}
