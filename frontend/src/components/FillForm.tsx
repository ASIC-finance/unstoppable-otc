import { useEffect, useState } from 'react'
import { useAccount, useSimulateContract } from 'wagmi'
import { formatUnits, maxUint256, parseUnits } from 'viem'
import { useTokenInfo } from '../hooks/useTokenInfo'
import { useTokenAllowance } from '../hooks/useTokenAllowance'
import { useFillOrder } from '../hooks/useFillOrder'
import { OTCPairABI } from '../abi/OTCPair'
import type { Order } from '../types/orders'
import { formatTokenAmount } from '../utils/format'

/**
 * Inline fill UX for an order row. Handles:
 *  - Amount parse + ceiling-rounded buy-cost calculation (matches contract).
 *  - Approval flow (exact or unlimited) via `useTokenAllowance`.
 *  - Optional `useSimulateContract` revert preflight.
 *  - Success state with a "New fill" reset.
 */
export function FillForm({
  order,
  orderId,
  pairAddress,
  token0,
  token1,
  onFilled,
}: {
  order: Order
  orderId: bigint
  pairAddress: `0x${string}`
  token0: `0x${string}`
  token1: `0x${string}`
  onFilled?: () => void
}) {
  const [fillAmount, setFillAmount] = useState('')
  const [approvalMode, setApprovalMode] = useState<'exact' | 'max'>('exact')
  const { address } = useAccount()

  const sellTokenAddr = order.sellToken0 ? token0 : token1
  const buyTokenAddr = order.sellToken0 ? token1 : token0

  const { decimals: sellDecimals } = useTokenInfo(sellTokenAddr)
  const { decimals: buyDecimals, symbol: buySymbol } = useTokenInfo(buyTokenAddr)

  const remaining = order.sellAmount - order.filledSellAmount
  const decimalsReady = sellDecimals != null && buyDecimals != null
  const sd = sellDecimals ?? 0
  const bd = buyDecimals ?? 0

  // Match OTCPair.fillOrder's Math.mulDiv(..., Ceil) exactly.
  let buyAmountIn = 0n
  let fillAmountParsed = 0n
  if (decimalsReady) {
    try {
      fillAmountParsed = parseUnits(fillAmount || '0', sd)
      if (fillAmountParsed > 0n && order.sellAmount > 0n) {
        const numerator = order.buyAmount * fillAmountParsed
        buyAmountIn = numerator === 0n ? 0n : (numerator - 1n) / order.sellAmount + 1n
      }
    } catch {
      fillAmountParsed = 0n
    }
  }

  const isValidAmount = fillAmountParsed > 0n && fillAmountParsed <= remaining

  const { allowance, approve, isApproving, refetchAllowance, approvalConfirmed } = useTokenAllowance(
    buyTokenAddr,
    address,
    pairAddress,
    buySymbol,
  )

  const needsApproval = buyAmountIn > 0n && allowance < buyAmountIn

  useEffect(() => { if (approvalConfirmed) refetchAllowance() }, [approvalConfirmed, refetchAllowance])

  const { fillOrder, isPending, isSuccess, status, reset } = useFillOrder(onFilled)

  // Gas / revert preflight — only simulated when we have a validly-parsed amount
  // AND the approval is already sufficient. Skipping early avoids false negatives.
  const simulation = useSimulateContract({
    address: pairAddress,
    abi: OTCPairABI,
    functionName: 'fillOrder',
    // UI doesn't cap price: the cost is derived from the on-chain quote above
    // via the exact same ceil-div the pair uses. Pass infinity; any mismatch
    // becomes a slippage revert from the maker's side, not a taker cap revert.
    args: [orderId, fillAmountParsed, maxUint256],
    query: { enabled: isValidAmount && !needsApproval && !isPending },
  })

  const [filled, setFilled] = useState(false)
  useEffect(() => {
    if (isSuccess && !filled) setFilled(true)
  }, [isSuccess, filled])

  if (filled) {
    return (
      <div className="order-action">
        <span className="status-pill status-active">Filled</span>
        <button
          type="button"
          onClick={() => {
            reset()
            setFillAmount('')
            setFilled(false)
          }}
          className="ghost-button min-h-0 px-3 py-2 text-xs"
        >
          New Fill
        </button>
      </div>
    )
  }

  const cannotFill = !isValidAmount || isPending || Boolean(simulation.isError && isValidAmount && !needsApproval)

  return (
    <div className="order-action">
      <label htmlFor={`fill-amount-${orderId}`} className="sr-only">
        Fill amount for order {orderId.toString()}
      </label>
      <input
        id={`fill-amount-${orderId}`}
        name={`fill_amount_${orderId.toString()}`}
        type="text"
        value={fillAmount}
        disabled={!decimalsReady}
        autoComplete="off"
        inputMode="decimal"
        spellCheck={false}
        aria-label={`Fill amount for order ${orderId.toString()}`}
        aria-invalid={fillAmount && !isValidAmount ? 'true' : undefined}
        placeholder={decimalsReady ? `Max ${formatUnits(remaining, sd)}` : 'Loading…'}
        onChange={event => setFillAmount(event.target.value)}
        className="input-field min-h-0 w-[8.5rem] px-3 py-2 text-sm"
      />

      {buyAmountIn > 0n && (
        <span className="text-xs font-medium text-[var(--text-soft)]">
          Cost: <span className="numeric text-[var(--text-strong)]">{formatTokenAmount(buyAmountIn, bd)}</span>
          {buySymbol ? ` ${buySymbol}` : ''}
        </span>
      )}

      {needsApproval ? (
        <div className="inline-flex flex-col gap-1">
          <div className="inline-flex items-center gap-2">
            <button
              type="button"
              onClick={() => approve(approvalMode === 'exact' ? buyAmountIn : undefined)}
              disabled={isApproving}
              className="secondary-button min-h-0 px-3 py-2 text-sm"
              title={
                approvalMode === 'exact'
                  ? `Approves exactly ${formatTokenAmount(buyAmountIn, bd)} ${buySymbol ?? ''}`
                  : 'Grants unlimited approval (cheaper gas on repeat fills)'
              }
            >
              {isApproving
                ? status === 'signing' ? 'Check wallet…' : 'Approving…'
                : approvalMode === 'exact'
                  ? 'Approve Exact'
                  : 'Approve Max'}
            </button>
            <button
              type="button"
              className="ghost-button min-h-0 px-2 py-1 text-xs"
              onClick={() => setApprovalMode(m => (m === 'exact' ? 'max' : 'exact'))}
              aria-label="Toggle approval mode"
            >
              {approvalMode === 'exact' ? 'Use max' : 'Use exact'}
            </button>
          </div>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => fillOrder(pairAddress, orderId, fillAmountParsed, maxUint256)}
          disabled={cannotFill}
          className="primary-button min-h-0 px-3 py-2 text-sm"
          title={simulation.isError ? 'Simulation reverted — check order size' : undefined}
        >
          {status === 'signing' && 'Check wallet…'}
          {status === 'pending' && 'Confirming…'}
          {status !== 'signing' && status !== 'pending' && 'Fill'}
        </button>
      )}
    </div>
  )
}
