import { useState, useEffect } from 'react'
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
  order: Order; orderId: bigint; pairAddress: `0x${string}`; token0: `0x${string}`; token1: `0x${string}`; refetch?: () => void
}) {
  const [fillAmount, setFillAmount] = useState('')
  const { address } = useAccount()

  const sellTokenAddr = order.sellToken0 ? token0 : token1
  const buyTokenAddr = order.sellToken0 ? token1 : token0

  const { decimals: sellDecimals } = useTokenInfo(sellTokenAddr)
  const { decimals: buyDecimals } = useTokenInfo(buyTokenAddr)
  const { fillOrder, isPending, isSuccess, error, reset } = useFillOrder()

  const remaining = order.sellAmount - order.filledSellAmount

  // Block interaction until decimals are resolved — prevents 18-decimal misparse
  const decimalsReady = sellDecimals != null && buyDecimals != null
  const sd = sellDecimals ?? 0
  const bd = buyDecimals ?? 0

  let buyAmountNeeded = 0n
  let fillAmountParsed = 0n
  if (decimalsReady) {
    try {
      fillAmountParsed = parseUnits(fillAmount || '0', sd)
      if (fillAmountParsed > 0n && order.sellAmount > 0n) {
        // ceil div to match contract
        const num = order.buyAmount * fillAmountParsed
        buyAmountNeeded = num === 0n ? 0n : (num - 1n) / order.sellAmount + 1n
      }
    } catch { /* */ }
  }

  const { allowance, approve, isApproving, refetchAllowance, approvalConfirmed } = useTokenAllowance(
    buyTokenAddr, address, pairAddress,
  )

  const needsApproval = buyAmountNeeded > 0n && allowance < buyAmountNeeded

  // P2 fix: refetch allowance on confirmation, not a timer
  useEffect(() => { if (approvalConfirmed) refetchAllowance() }, [approvalConfirmed, refetchAllowance])

  // P3 fix: move side effects out of render into useEffect
  const [filled, setFilled] = useState(false)
  useEffect(() => {
    if (isSuccess && !filled) {
      setFilled(true)
      refetch?.()
    }
  }, [isSuccess, filled, refetch])

  if (filled) {
    return (
      <div className="flex items-center gap-2">
        <span className="text-emerald-400 text-sm">Filled!</span>
        <button onClick={() => { reset(); setFillAmount(''); setFilled(false) }} className="text-xs text-gray-400 hover:text-gray-200">New fill</button>
      </div>
    )
  }

  return (
    <div className="flex items-center gap-2">
      <input type="text" placeholder={decimalsReady ? `Max ${formatUnits(remaining, sd)}` : 'Loading...'} value={fillAmount}
        disabled={!decimalsReady}
        onChange={e => setFillAmount(e.target.value)}
        className="w-28 px-2 py-1 rounded bg-gray-800 border border-gray-700 text-sm text-gray-100 placeholder-gray-500" />
      {buyAmountNeeded > 0n && (
        <span className="text-xs text-gray-400">Cost: {formatTokenAmount(buyAmountNeeded, bd)}</span>
      )}
      {needsApproval ? (
        <button onClick={() => approve()} disabled={isApproving}
          className="px-3 py-1 rounded text-sm bg-yellow-600 hover:bg-yellow-500 text-white disabled:opacity-50"
        >{isApproving ? 'Approving...' : 'Approve'}</button>
      ) : (
        <button onClick={() => fillOrder(pairAddress, orderId, fillAmountParsed)}
          disabled={!decimalsReady || isPending || fillAmountParsed <= 0n || fillAmountParsed > remaining}
          className="px-3 py-1 rounded text-sm bg-emerald-600 hover:bg-emerald-500 text-white disabled:opacity-50"
        >{isPending ? 'Filling...' : 'Fill'}</button>
      )}
      {error && <span className="text-red-400 text-xs">Failed</span>}
    </div>
  )
}

export function OrderTable({ orders, orderIds, pairAddress, token0, token1, showFillAction, showCancelAction, onCancel, isCancelling, refetch }: Props) {
  const { address } = useAccount()

  if (orders.length === 0) {
    return <p className="text-gray-500 text-center py-8">No orders found.</p>
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="text-gray-400 text-left border-b border-gray-800">
            <th className="py-3 px-2 font-medium">ID</th>
            <th className="py-3 px-2 font-medium">Maker</th>
            <th className="py-3 px-2 font-medium">Selling</th>
            <th className="py-3 px-2 font-medium">Wanting</th>
            <th className="py-3 px-2 font-medium">Sell Amt</th>
            <th className="py-3 px-2 font-medium">Buy Amt</th>
            <th className="py-3 px-2 font-medium">Filled</th>
            <th className="py-3 px-2 font-medium">Status</th>
            {(showFillAction || showCancelAction) && <th className="py-3 px-2 font-medium">Action</th>}
          </tr>
        </thead>
        <tbody>
          {orders.map((order, i) => {
            const oid = orderIds[i] ?? i
            const orderId = BigInt(oid)
            const sellTokenAddr = order.sellToken0 ? token0 : token1
            const buyTokenAddr = order.sellToken0 ? token1 : token0
            const statusLabel = ['Active', 'Filled', 'Cancelled'][order.status]
            const statusColor = order.status === 0 ? 'text-emerald-400' : order.status === 1 ? 'text-blue-400' : 'text-gray-500'
            const filled = filledPercent(order.sellAmount, order.filledSellAmount)
            const isOwnOrder = address && order.maker.toLowerCase() === address.toLowerCase()

            return (
              <tr key={oid} className="border-b border-gray-800/50 hover:bg-gray-900/50">
                <td className="py-3 px-2 text-gray-400">#{oid}</td>
                <td className="py-3 px-2">
                  <span className="text-gray-300" title={order.maker}>
                    {shortenAddress(order.maker)}
                    {isOwnOrder && <span className="ml-1 text-xs text-emerald-400">(you)</span>}
                  </span>
                </td>
                <td className="py-3 px-2"><TokenBadge address={sellTokenAddr} /></td>
                <td className="py-3 px-2"><TokenBadge address={buyTokenAddr} /></td>
                <td className="py-3 px-2"><TokenAmount address={sellTokenAddr} amount={order.sellAmount} /></td>
                <td className="py-3 px-2"><TokenAmount address={buyTokenAddr} amount={order.buyAmount} /></td>
                <td className="py-3 px-2">
                  <div className="flex items-center gap-2">
                    <div className="w-16 h-1.5 rounded-full bg-gray-800 overflow-hidden">
                      <div className="h-full bg-emerald-500 rounded-full" style={{ width: `${filled}%` }} />
                    </div>
                    <span className="text-xs text-gray-400">{filled}%</span>
                  </div>
                </td>
                <td className={`py-3 px-2 text-xs font-medium ${statusColor}`}>{statusLabel}</td>
                {showFillAction && (
                  <td className="py-3 px-2">
                    {order.status === 0 && !isOwnOrder && (
                      <FillForm order={order} orderId={orderId} pairAddress={pairAddress} token0={token0} token1={token1} refetch={refetch} />
                    )}
                  </td>
                )}
                {showCancelAction && (
                  <td className="py-3 px-2">
                    {order.status === 0 && isOwnOrder && onCancel && (
                      <button onClick={() => onCancel(orderId)} disabled={isCancelling}
                        className="px-3 py-1 rounded text-sm bg-red-600/20 hover:bg-red-600/40 text-red-400 disabled:opacity-50"
                      >{isCancelling ? 'Cancelling...' : 'Cancel'}</button>
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
  return <span>{formatTokenAmount(amount, decimals ?? 18)}</span>
}
