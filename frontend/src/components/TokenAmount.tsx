import { useTokenInfo } from '../hooks/useTokenInfo'
import { formatTokenAmount } from '../utils/format'

/** Renders a bigint amount formatted with the token's own decimals. */
export function TokenAmount({
  address,
  amount,
  className = '',
}: {
  address: `0x${string}`
  amount: bigint
  className?: string
}) {
  const { decimals } = useTokenInfo(address)

  return (
    <span className={`numeric font-medium text-[var(--text-strong)] ${className}`.trim()}>
      {formatTokenAmount(amount, decimals ?? 18)}
    </span>
  )
}
