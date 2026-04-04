import { useState, useEffect } from 'react'
import { useAccount, useReadContract } from 'wagmi'
import { erc20Abi, parseUnits, isAddress } from 'viem'
import { useTokenInfo } from '../hooks/useTokenInfo'
import { useTokenLogo } from '../hooks/useTokenLogo'
import { useTokenAllowance } from '../hooks/useTokenAllowance'
import { useCreateOrder } from '../hooks/useCreateOrder'
import { usePairAddress, useCreatePair } from '../hooks/useFactory'
import { usePairTokens } from '../hooks/useOrders'
import { formatTokenAmount } from '../utils/format'
import { isValidTokenAddress, isValidAmount } from '../utils/validation'

export function CreateOrder() {
  const { address, isConnected } = useAccount()

  const [sellToken, setSellToken] = useState('')
  const [buyToken, setBuyToken] = useState('')
  const [sellAmount, setSellAmount] = useState('')
  const [buyAmount, setBuyAmount] = useState('')

  const sellAddr = isAddress(sellToken) ? sellToken as `0x${string}` : undefined
  const buyAddr = isAddress(buyToken) ? buyToken as `0x${string}` : undefined

  const sellInfo = useTokenInfo(sellAddr)
  const buyInfo = useTokenInfo(buyAddr)
  const sellLogo = useTokenLogo(sellAddr)
  const buyLogo = useTokenLogo(buyAddr)

  // Look up pair
  const { data: pairAddr, refetch: refetchPair } = usePairAddress(sellAddr, buyAddr)
  const pairExists = pairAddr && pairAddr !== '0x0000000000000000000000000000000000000000'
  const pair = pairExists ? pairAddr as `0x${string}` : undefined

  const { token0 } = usePairTokens(pair)

  // Determine direction: is sellToken == token0?
  const sellToken0 = pair && token0 && sellAddr
    ? token0.toLowerCase() === sellAddr.toLowerCase()
    : true

  const { data: sellBalance } = useReadContract({
    address: sellAddr!,
    abi: erc20Abi,
    functionName: 'balanceOf',
    args: [address!],
    query: { enabled: !!sellAddr && !!address },
  })

  const { allowance, approve, isApproving, refetchAllowance, approvalConfirmed } = useTokenAllowance(
    sellAddr, address, pair,
  )

  const { createPair, isPending: isCreatingPair, isSuccess: pairCreated, reset: resetPair } = useCreatePair()
  const { createOrder, isPending: isCreatingOrder, isSuccess: orderCreated, error, reset: resetOrder, txHash } = useCreateOrder()

  // After pair created, refetch pair address
  useEffect(() => { if (pairCreated) { refetchPair(); resetPair() } }, [pairCreated, refetchPair, resetPair])
  useEffect(() => { if (approvalConfirmed) refetchAllowance() }, [approvalConfirmed, refetchAllowance])

  const sellDecimals = sellInfo.decimals ?? 18
  const buyDecimals = buyInfo.decimals ?? 18

  let parsedSellAmount = 0n
  try { if (isValidAmount(sellAmount)) parsedSellAmount = parseUnits(sellAmount, sellDecimals) } catch { /* */ }

  const needsApproval = pair && parsedSellAmount > 0n && allowance < parsedSellAmount

  const canCreate = isConnected && pair
    && isValidTokenAddress(sellToken) && isValidTokenAddress(buyToken)
    && sellToken.toLowerCase() !== buyToken.toLowerCase()
    && isValidAmount(sellAmount) && isValidAmount(buyAmount)
    && !needsApproval && parsedSellAmount > 0n
    && sellBalance !== undefined && parsedSellAmount <= sellBalance

  function handleCreate() {
    if (!pair) return
    createOrder(pair, sellToken0, sellAmount, buyAmount, sellDecimals, buyDecimals)
  }

  if (!isConnected) {
    return (
      <div className="text-center py-16">
        <h2 className="text-xl font-semibold text-white mb-2">Connect your wallet</h2>
        <p className="text-gray-400">Connect a wallet to create orders.</p>
      </div>
    )
  }

  if (orderCreated) {
    return (
      <div className="max-w-lg mx-auto py-16 text-center">
        <h2 className="text-xl font-semibold text-emerald-400 mb-2">Order Created!</h2>
        <p className="text-gray-400 mb-4 text-sm break-all">Tx: {txHash}</p>
        <button
          onClick={() => { resetOrder(); setSellToken(''); setBuyToken(''); setSellAmount(''); setBuyAmount('') }}
          className="px-4 py-2 rounded bg-gray-800 hover:bg-gray-700 text-gray-300"
        >Create Another</button>
      </div>
    )
  }

  return (
    <div className="max-w-lg mx-auto">
      <h1 className="text-xl font-semibold text-white mb-6">Create Order</h1>
      <div className="space-y-4">
        {/* Sell Token */}
        <div>
          <label className="block text-sm text-gray-400 mb-1">Sell Token Address</label>
          <input type="text" value={sellToken} onChange={e => setSellToken(e.target.value)} placeholder="0x..."
            className="w-full px-3 py-2 rounded-lg bg-gray-900 border border-gray-700 text-gray-100 placeholder-gray-500 focus:border-emerald-500 focus:outline-none" />
          {sellAddr && (
            <div className="mt-1.5 text-xs text-gray-400 flex items-center gap-2">
              {sellLogo && <img src={sellLogo} alt="" className="w-4 h-4 rounded-full" />}
              {sellInfo.symbol && <span>{sellInfo.name} ({sellInfo.symbol})</span>}
              {sellBalance !== undefined && <span>Balance: {formatTokenAmount(sellBalance, sellDecimals)}</span>}
            </div>
          )}
        </div>

        {/* Sell Amount */}
        <div>
          <label className="block text-sm text-gray-400 mb-1">Sell Amount</label>
          <input type="text" value={sellAmount} onChange={e => setSellAmount(e.target.value)} placeholder="0.0"
            className="w-full px-3 py-2 rounded-lg bg-gray-900 border border-gray-700 text-gray-100 placeholder-gray-500 focus:border-emerald-500 focus:outline-none" />
        </div>

        {/* Buy Token */}
        <div>
          <label className="block text-sm text-gray-400 mb-1">Buy Token Address (what you want)</label>
          <input type="text" value={buyToken} onChange={e => setBuyToken(e.target.value)} placeholder="0x..."
            className="w-full px-3 py-2 rounded-lg bg-gray-900 border border-gray-700 text-gray-100 placeholder-gray-500 focus:border-emerald-500 focus:outline-none" />
          {buyAddr && buyInfo.symbol && (
            <div className="mt-1.5 text-xs text-gray-400 flex items-center gap-2">
              {buyLogo && <img src={buyLogo} alt="" className="w-4 h-4 rounded-full" />}
              <span>{buyInfo.name} ({buyInfo.symbol})</span>
            </div>
          )}
        </div>

        {/* Buy Amount */}
        <div>
          <label className="block text-sm text-gray-400 mb-1">Buy Amount (what you want in return)</label>
          <input type="text" value={buyAmount} onChange={e => setBuyAmount(e.target.value)} placeholder="0.0"
            className="w-full px-3 py-2 rounded-lg bg-gray-900 border border-gray-700 text-gray-100 placeholder-gray-500 focus:border-emerald-500 focus:outline-none" />
        </div>

        {sellToken && buyToken && sellToken.toLowerCase() === buyToken.toLowerCase() && (
          <p className="text-red-400 text-sm">Sell and buy tokens must be different.</p>
        )}
        {parsedSellAmount > 0n && sellBalance !== undefined && parsedSellAmount > sellBalance && (
          <p className="text-red-400 text-sm">Insufficient balance.</p>
        )}

        {/* Pair status */}
        {sellAddr && buyAddr && sellAddr !== buyAddr && (
          <div className="text-xs text-gray-500">
            {pairExists
              ? <span className="text-emerald-400">Pair exists</span>
              : <span>No pair yet — will be created automatically</span>}
          </div>
        )}

        {/* Actions */}
        <div className="flex gap-3 pt-2">
          {!pairExists && sellAddr && buyAddr && sellAddr !== buyAddr && (
            <button
              onClick={() => sellAddr && buyAddr && createPair(sellAddr, buyAddr)}
              disabled={isCreatingPair}
              className="flex-1 px-4 py-3 rounded-lg font-medium bg-blue-600 hover:bg-blue-500 text-white disabled:opacity-50 transition-colors"
            >{isCreatingPair ? 'Creating Pair...' : 'Create Pair'}</button>
          )}
          {pairExists && needsApproval && (
            <button onClick={approve} disabled={isApproving}
              className="flex-1 px-4 py-3 rounded-lg font-medium bg-yellow-600 hover:bg-yellow-500 text-white disabled:opacity-50 transition-colors"
            >{isApproving ? 'Approving...' : `Approve ${sellInfo.symbol ?? 'Token'}`}</button>
          )}
          {pairExists && (
            <button onClick={handleCreate} disabled={!canCreate || isCreatingOrder}
              className="flex-1 px-4 py-3 rounded-lg font-medium bg-emerald-600 hover:bg-emerald-500 text-white disabled:opacity-50 transition-colors"
            >{isCreatingOrder ? 'Creating...' : 'Create Order'}</button>
          )}
        </div>

        {error && <p className="text-red-400 text-sm">Transaction failed. Check your wallet for details.</p>}
      </div>
    </div>
  )
}
