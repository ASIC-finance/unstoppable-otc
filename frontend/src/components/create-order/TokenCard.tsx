import { useTokenInfo } from '../../hooks/useTokenInfo'
import { useTokenLogo } from '../../hooks/useTokenLogo'
import { formatTokenAmount } from '../../utils/format'

export function TokenCard({
  address,
  balance,
  decimals,
  label,
}: {
  address: `0x${string}`
  balance?: bigint
  decimals: number
  label: string
}) {
  const { name, symbol, isLoading } = useTokenInfo(address)
  const logo = useTokenLogo(address)

  if (isLoading) {
    return <div className="token-panel h-20 animate-pulse" aria-hidden="true" />
  }

  return (
    <div className="token-panel">
      <div className="eyebrow mb-2">{label}</div>
      <div className="flex items-center gap-3">
        {logo ? (
          <img
            src={logo}
            alt=""
            width={40}
            height={40}
            loading="lazy"
            decoding="async"
            className="h-10 w-10 rounded-full"
          />
        ) : (
          <span className="token-avatar token-avatar-lg" aria-hidden="true">
            {(symbol ?? '?').slice(0, 2).toUpperCase()}
          </span>
        )}
        <div className="min-w-0 flex-1">
          <div className="font-semibold text-[var(--text-strong)] truncate">{symbol ?? 'Unknown'}</div>
          <div className="text-xs text-[var(--text-soft)] truncate">{name ?? address}</div>
        </div>
        {balance !== undefined && (
          <div className="text-right">
            <div className="text-sm font-semibold text-[var(--text-strong)] numeric">
              {formatTokenAmount(balance, decimals)}
            </div>
            <div className="eyebrow mb-0 mt-1">Balance</div>
          </div>
        )}
      </div>
    </div>
  )
}
