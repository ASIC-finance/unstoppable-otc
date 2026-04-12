import { useEffect, useState } from 'react'
import { useAccount } from 'wagmi'
import { formatUnits, parseUnits } from 'viem'
import { TokenBadge } from './TokenBadge'
import { useTokenInfo } from '../hooks/useTokenInfo'
import { useTokenAllowance } from '../hooks/useTokenAllowance'
import { useFillOrder } from '../hooks/useFillOrder'
import { shortenAddress, formatTokenAmount, filledPercent } from '../utils/format'

type Order = {
  maker: `0x${string}`
  sellToken0: boolean
  sellAmount: bigint
  buyAmount: bigint
  filledSellAmount: bigint
  status: number
}

type Props = {
  orders: readonly Order[]
  orderIds: number[]
  pairAddress: `0x${string}`
  token0: `0x${string}`
  token1: `0x${string}`
  showFillAction?: boolean
  showCancelAction?: boolean
  onCancel?: (orderId: bigint) => void
  isCancelling?: boolean
  refetch?: () => void
}

function FillForm({ order, orderId, pairAddress, token0, token1, refetch }: {
  order: Order
  orderId: bigint
  pairAddress: `0x${string}`
  token0: `0x${string}`
  token1: `0x${string}`
  refetch?: () => void
}) {
  const [fillAmount, setFillAmount] = useState('')
  const { address } = useAccount()

  const sellTokenAddr = order.sellToken0 ? token0 : token1
  const buyTokenAddr = order.sellToken0 ? token1 : token0

  const { decimals: sellDecimals } = useTokenInfo(sellTokenAddr)
  const { decimals: buyDecimals } = useTokenInfo(buyTokenAddr)
  const { fillOrder, isPending, isSuccess, error, reset } = useFillOrder()

  const remaining = order.sellAmount - order.filledSellAmount
  const decimalsReady = sellDecimals != null && buyDecimals != null
  const sd = sellDecimals ?? 0
  const bd = buyDecimals ?? 0

  let buyAmountNeeded = 0n
  let fillAmountParsed = 0n

  if (decimalsReady) {
    try {
      fillAmountParsed = parseUnits(fillAmount || '0', sd)
      if (fillAmountParsed > 0n && order.sellAmount > 0n) {
        const numerator = order.buyAmount * fillAmountParsed
        buyAmountNeeded = numerator === 0n ? 0n : (numerator - 1n) / order.sellAmount + 1n
      }
    } catch {
      fillAmountParsed = 0n
    }
  }

  const { allowance, approve, isApproving, refetchAllowance, approvalConfirmed } = useTokenAllowance(
    buyTokenAddr,
    address,
    pairAddress,
  )

  const needsApproval = buyAmountNeeded > 0n && allowance < buyAmountNeeded

  useEffect(() => {
    if (approvalConfirmed) {
      refetchAllowance()
    }
  }, [approvalConfirmed, refetchAllowance])

  const [filled, setFilled] = useState(false)

  useEffect(() => {
    if (isSuccess && !filled) {
      setFilled(true)
      refetch?.()
    }
  }, [isSuccess, filled, refetch])

  if (filled) {
    return (
      <div className="flex flex-wrap items-center gap-2">
        <span className="status-pill bg-emerald-500/15 text-emerald-700">Filled</span>
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

  return (
    <div className="flex flex-wrap items-center gap-2">
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
        placeholder={decimalsReady ? `Max ${formatUnits(remaining, sd)}` : 'Loading…'}
        onChange={event => setFillAmount(event.target.value)}
        className="input-field min-h-0 w-[9rem] px-3 py-2 text-sm"
      />

      {buyAmountNeeded > 0n && (
        <span className="text-xs font-medium text-[var(--text-soft)]">
          Cost: <span className="numeric text-[var(--text-strong)]">{formatTokenAmount(buyAmountNeeded, bd)}</span>
        </span>
      )}

      {needsApproval ? (
        <button
          type="button"
          onClick={() => approve()}
          disabled={isApproving}
          className="secondary-button min-h-0 px-3 py-2 text-sm"
        >
          {isApproving ? 'Approving…' : 'Approve'}
        </button>
      ) : (
        <button
          type="button"
          onClick={() => fillOrder(pairAddress, orderId, fillAmountParsed)}
          disabled={!decimalsReady || isPending || fillAmountParsed <= 0n || fillAmountParsed > remaining}
          className="primary-button min-h-0 px-3 py-2 text-sm"
        >
          {isPending ? 'Filling…' : 'Fill'}
        </button>
      )}

      {error && (
        <span className="text-xs font-medium text-[var(--danger)]" aria-live="polite">
          Transaction failed. Check your wallet and try again.
        </span>
      )}
    </div>
  )
}

export function OrderTable({
  orders,
  orderIds,
  pairAddress,
  token0,
  token1,
  showFillAction,
  showCancelAction,
  onCancel,
  isCancelling,
  refetch,
}: Props) {
  const { address } = useAccount()

  if (orders.length === 0) {
    return <p className="py-8 text-center text-sm text-[var(--text-muted)]">No orders found.</p>
  }

  return (
    <div className="overflow-x-auto rounded-[1.5rem] border border-[var(--border-soft)] bg-white/72">
      <table className="data-table">
        <caption className="sr-only">Selected pair orders with maker, amount, fill progress, and actions.</caption>
        <thead>
          <tr>
            <th scope="col">ID</th>
            <th scope="col">Maker</th>
            <th scope="col">Selling</th>
            <th scope="col">Wanting</th>
            <th scope="col">Sell Amount</th>
            <th scope="col">Buy Amount</th>
            <th scope="col">Filled</th>
            <th scope="col">Status</th>
            {(showFillAction || showCancelAction) && <th scope="col">Action</th>}
          </tr>
        </thead>
        <tbody>
          {orders.map((order, index) => {
            const oid = orderIds[index] ?? index
            const orderId = BigInt(oid)
            const sellTokenAddr = order.sellToken0 ? token0 : token1
            const buyTokenAddr = order.sellToken0 ? token1 : token0
            const isOwnOrder = address && order.maker.toLowerCase() === address.toLowerCase()
            const filled = filledPercent(order.sellAmount, order.filledSellAmount)

            const status = [
              {
                label: 'Active',
                className: 'bg-emerald-500/15 text-emerald-700',
              },
              {
                label: 'Filled',
                className: 'bg-sky-500/15 text-sky-700',
              },
              {
                label: 'Cancelled',
                className: 'bg-stone-400/20 text-stone-600',
              },
            ][order.status] ?? {
              label: 'Unknown',
              className: 'bg-stone-300/20 text-stone-600',
            }

            return (
              <tr key={oid}>
                <td className="numeric text-[var(--text-soft)]">#{oid}</td>
                <td>
                  <span className="text-sm font-medium text-[var(--text-strong)]" title={order.maker}>
                    {shortenAddress(order.maker)}
                    {isOwnOrder && (
                      <span className="ml-2 text-xs font-semibold uppercase tracking-[0.16em] text-emerald-700">
                        You
                      </span>
                    )}
                  </span>
                </td>
                <td><TokenBadge address={sellTokenAddr} /></td>
                <td><TokenBadge address={buyTokenAddr} /></td>
                <td><TokenAmount address={sellTokenAddr} amount={order.sellAmount} /></td>
                <td><TokenAmount address={buyTokenAddr} amount={order.buyAmount} /></td>
                <td>
                  <div className="flex items-center gap-3">
                    <div className="progress-track" aria-hidden="true">
                      <div className="progress-fill" style={{ width: `${filled}%` }} />
                    </div>
                    <span className="numeric text-xs font-semibold text-[var(--text-soft)]">{filled}%</span>
                  </div>
                </td>
                <td>
                  <span className={`status-pill ${status.className}`}>{status.label}</span>
                </td>
                {showFillAction && (
                  <td>
                    {order.status === 0 && !isOwnOrder && (
                      <FillForm
                        order={order}
                        orderId={orderId}
                        pairAddress={pairAddress}
                        token0={token0}
                        token1={token1}
                        refetch={refetch}
                      />
                    )}
                  </td>
                )}
                {showCancelAction && (
                  <td>
                    {order.status === 0 && isOwnOrder && onCancel && (
                      <button
                        type="button"
                        onClick={() => onCancel(orderId)}
                        disabled={isCancelling}
                        className="secondary-button min-h-0 border-[rgba(181,83,81,0.22)] px-3 py-2 text-sm text-[var(--danger)]"
                      >
                        {isCancelling ? 'Cancelling…' : 'Cancel'}
                      </button>
                    )}
                  </td>
                )}
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

function TokenAmount({ address, amount }: { address: `0x${string}`; amount: bigint }) {
  const { decimals } = useTokenInfo(address)

  return (
    <span className="numeric font-medium text-[var(--text-strong)]">
      {formatTokenAmount(amount, decimals ?? 18)}
    </span>
  )
}
