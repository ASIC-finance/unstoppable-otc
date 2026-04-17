import { useAccount } from 'wagmi'
import { TokenBadge } from './TokenBadge'
import { TokenAmount } from './TokenAmount'
import { FillForm } from './FillForm'
import { SkeletonRow } from './Skeleton'
import { CopyButton } from './CopyButton'
import { isSameAddress } from '../utils/address'
import { shortenAddress, filledPercent } from '../utils/format'
import type { Order } from '../types/orders'
import { DEFAULT_MIN_BUY_BPS, bpsToSlippagePercent } from '../types/orders'

type Props = {
  orders: readonly Order[]
  orderIds: number[]
  pairAddress: `0x${string}`
  token0: `0x${string}`
  token1: `0x${string}`
  showFillAction?: boolean
  showCancelAction?: boolean
  isLoading?: boolean
  onCancel?: (orderId: bigint) => void
  isCancelling?: boolean
  refetch?: () => void
}

export function OrderTable({
  orders,
  orderIds,
  pairAddress,
  token0,
  token1,
  showFillAction,
  showCancelAction,
  isLoading,
  onCancel,
  isCancelling,
  refetch,
}: Props) {
  const { address } = useAccount()

  if (!isLoading && orders.length === 0) {
    return <p className="py-8 text-center text-sm text-[var(--text-muted)]">No orders found.</p>
  }

  return (
    <div className="table-frame">
      <table className="data-table">
        <caption className="sr-only">
          Selected pair orders with maker, amount, fill progress, and actions.
        </caption>
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
          {isLoading && orders.length === 0
            ? Array.from({ length: 3 }).map((_, i) => <SkeletonRow key={`s-${i}`} />)
            : orders.map((order, index) => (
                <OrderRow
                  key={orderIds[index] ?? index}
                  order={order}
                  orderId={orderIds[index] ?? index}
                  pairAddress={pairAddress}
                  token0={token0}
                  token1={token1}
                  ownerAddress={address}
                  showFillAction={showFillAction}
                  showCancelAction={showCancelAction}
                  onCancel={onCancel}
                  isCancelling={isCancelling}
                  refetch={refetch}
                />
              ))}
        </tbody>
      </table>
    </div>
  )
}

function OrderRow({
  order,
  orderId,
  pairAddress,
  token0,
  token1,
  ownerAddress,
  showFillAction,
  showCancelAction,
  onCancel,
  isCancelling,
  refetch,
}: {
  order: Order
  orderId: number
  pairAddress: `0x${string}`
  token0: `0x${string}`
  token1: `0x${string}`
  ownerAddress: `0x${string}` | undefined
  showFillAction?: boolean
  showCancelAction?: boolean
  onCancel?: (orderId: bigint) => void
  isCancelling?: boolean
  refetch?: () => void
}) {
  const sellTokenAddr = order.sellToken0 ? token0 : token1
  const buyTokenAddr = order.sellToken0 ? token1 : token0
  const isOwnOrder = isSameAddress(ownerAddress, order.maker)
  const filled = filledPercent(order.sellAmount, order.filledSellAmount)
  const status = STATUS[order.status] ?? STATUS_UNKNOWN

  return (
    <tr>
      <td className="numeric text-[var(--text-soft)]">#{orderId}</td>
      <td>
        <span className="inline-flex items-center gap-1.5 text-sm font-medium text-[var(--text-strong)]" title={order.maker}>
          {shortenAddress(order.maker)}
          <CopyButton value={order.maker} label="Copy maker address" />
          {isOwnOrder && (
            <span className="status-pill status-active ml-1 min-h-0 px-2 py-1 text-[0.65rem]">
              You
            </span>
          )}
        </span>
      </td>
      <td><TokenBadge address={sellTokenAddr} /></td>
      <td><TokenBadge address={buyTokenAddr} /></td>
      <td className="cell-numeric"><TokenAmount address={sellTokenAddr} amount={order.sellAmount} /></td>
      <td className="cell-numeric"><TokenAmount address={buyTokenAddr} amount={order.buyAmount} /></td>
      <td className="cell-numeric">
        <div className="flex items-center justify-end gap-3">
          <div
            className="progress-track"
            role="progressbar"
            aria-valuenow={filled}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label={`${filled} percent filled`}
          >
            <div className="progress-fill" style={{ width: `${filled}%` }} />
          </div>
          <span className="numeric text-xs font-semibold text-[var(--text-soft)]">{filled}%</span>
        </div>
      </td>
      <td>
        <span className={`status-pill ${status.className}`}>
          <span aria-hidden="true">{status.icon}</span>
          <span>{status.label}</span>
        </span>
        {order.minBuyBps > 0 && order.minBuyBps < DEFAULT_MIN_BUY_BPS && (
          <span
            className="status-pill status-muted ml-1 min-h-0 px-2 py-1 text-[0.65rem]"
            title={`Maker accepts up to ${bpsToSlippagePercent(order.minBuyBps)} slippage on delivered buy-token (e.g. fee-on-transfer).`}
          >
            FoT {bpsToSlippagePercent(order.minBuyBps)}
          </span>
        )}
      </td>
      {showFillAction && (
        <td>
          {order.status === 0 && !isOwnOrder && (
            <FillForm
              order={order}
              orderId={BigInt(orderId)}
              pairAddress={pairAddress}
              token0={token0}
              token1={token1}
              onFilled={refetch}
            />
          )}
        </td>
      )}
      {showCancelAction && (
        <td>
          {order.status === 0 && isOwnOrder && onCancel && (
            <button
              type="button"
              onClick={() => onCancel(BigInt(orderId))}
              disabled={isCancelling}
              className="secondary-button danger-button min-h-0 px-3 py-2 text-sm"
            >
              {isCancelling ? 'Cancelling…' : 'Cancel'}
            </button>
          )}
        </td>
      )}
    </tr>
  )
}

const STATUS = [
  { label: 'Active', className: 'status-active', icon: '\u25CF' },
  { label: 'Filled', className: 'status-info', icon: '\u2713' },
  { label: 'Cancelled', className: 'status-muted', icon: '\u2715' },
] as const

const STATUS_UNKNOWN = { label: 'Unknown', className: 'status-muted', icon: '\u003F' } as const
