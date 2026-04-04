import { useState, useEffect } from 'react'
import { useAccount, useReadContract } from 'wagmi'
import { erc20Abi, isAddress, formatUnits } from 'viem'
import { useTokenInfo } from '../hooks/useTokenInfo'
import { useTokenLogo } from '../hooks/useTokenLogo'
import { useTokenAllowance } from '../hooks/useTokenAllowance'
import { useCreateOrder } from '../hooks/useCreateOrder'
import { usePairAddress, useCreatePair } from '../hooks/useFactory'
import { usePairTokens } from '../hooks/useOrders'
import { formatTokenAmount } from '../utils/format'
import { isValidTokenAddress, tryParseAmount } from '../utils/validation'

// ── Token card shown after entering a valid address ─────────────

function TokenCard({ address, balance, decimals, label }: {
  address: `0x${string}`; balance?: bigint; decimals: number; label: string
}) {
  const { name, symbol, isLoading } = useTokenInfo(address)
  const logo = useTokenLogo(address)

  if (isLoading) {
    return <div className="rounded-xl bg-gray-900 border border-gray-700 p-4 animate-pulse h-20" />
  }

  return (
    <div className="rounded-xl bg-gray-900 border border-gray-700 p-4">
      <div className="text-xs text-gray-500 mb-2">{label}</div>
      <div className="flex items-center gap-3">
        {logo ? (
          <img src={logo} alt="" className="w-10 h-10 rounded-full" />
        ) : (
          <span className="w-10 h-10 rounded-full bg-gray-700 flex items-center justify-center text-sm font-bold text-gray-300">
            {(symbol ?? '?').slice(0, 2).toUpperCase()}
          </span>
        )}
        <div className="min-w-0 flex-1">
          <div className="font-semibold text-white truncate">{symbol ?? 'Unknown'}</div>
          <div className="text-xs text-gray-400 truncate">{name ?? address}</div>
        </div>
        {balance !== undefined && (
          <div className="text-right">
            <div className="text-sm text-white font-medium">{formatTokenAmount(balance, decimals)}</div>
            <div className="text-xs text-gray-500">Balance</div>
          </div>
        )}
      </div>
    </div>
  )
}

// ── Step indicator ──────────────────────────────────────────────

function Steps({ current, total }: { current: number; total: number }) {
  return (
    <div className="flex items-center gap-2 mb-6">
      {Array.from({ length: total }, (_, i) => (
        <div key={i} className="flex items-center gap-2">
          <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-medium border transition-colors ${
            i < current ? 'bg-emerald-600 border-emerald-600 text-white'
            : i === current ? 'border-emerald-500 text-emerald-400'
            : 'border-gray-700 text-gray-600'
          }`}>
            {i < current ? '\u2713' : i + 1}
          </div>
          {i < total - 1 && (
            <div className={`w-8 h-px ${i < current ? 'bg-emerald-600' : 'bg-gray-700'}`} />
          )}
        </div>
      ))}
    </div>
  )
}

// ── Main wizard ─────────────────────────────────────────────────

export function CreateOrder() {
  const { address, isConnected } = useAccount()

  const [step, setStep] = useState(0)
  const [sellToken, setSellToken] = useState('')
  const [buyToken, setBuyToken] = useState('')
  const [sellAmount, setSellAmount] = useState('')
  const [buyAmount, setBuyAmount] = useState('')

  const sellAddr = isAddress(sellToken) ? sellToken as `0x${string}` : undefined
  const buyAddr = isAddress(buyToken) ? buyToken as `0x${string}` : undefined

  const sellInfo = useTokenInfo(sellAddr)
  const buyInfo = useTokenInfo(buyAddr)

  const { data: sellBalance } = useReadContract({
    address: sellAddr!,
    abi: erc20Abi,
    functionName: 'balanceOf',
    args: [address!],
    query: { enabled: !!sellAddr && !!address },
  })

  const { data: pairAddr, refetch: refetchPair } = usePairAddress(sellAddr, buyAddr)
  const pairExists = pairAddr && pairAddr !== '0x0000000000000000000000000000000000000000'
  const pair = pairExists ? pairAddr as `0x${string}` : undefined
  const { token0 } = usePairTokens(pair)
  const sellToken0 = pair && token0 && sellAddr
    ? token0.toLowerCase() === sellAddr.toLowerCase()
    : true

  const { allowance, approve, isApproving, refetchAllowance, approvalConfirmed } = useTokenAllowance(
    sellAddr, address, pair,
  )
  const { createPair, isPending: isCreatingPair, isSuccess: pairCreated, reset: resetPair } = useCreatePair()
  const { createOrder, isPending: isCreatingOrder, isSuccess: orderCreated, error, reset: resetOrder, txHash } = useCreateOrder()

  useEffect(() => { if (pairCreated) { refetchPair(); resetPair() } }, [pairCreated, refetchPair, resetPair])
  useEffect(() => { if (approvalConfirmed) refetchAllowance() }, [approvalConfirmed, refetchAllowance])

  const sellDecimals = sellInfo.decimals
  const buyDecimals = buyInfo.decimals
  const parsedSellAmount = sellDecimals != null ? (tryParseAmount(sellAmount, sellDecimals) ?? 0n) : 0n
  const parsedBuyAmount = buyDecimals != null ? (tryParseAmount(buyAmount, buyDecimals) ?? 0n) : 0n
  const needsApproval = pair && parsedSellAmount > 0n && allowance < parsedSellAmount
  const insufficientBalance = parsedSellAmount > 0n && sellBalance !== undefined && parsedSellAmount > sellBalance

  // Step validation — decimals must be resolved before advancing
  const step0Valid = sellAddr && isValidTokenAddress(sellToken) && sellInfo.symbol && sellDecimals != null
  const step1Valid = step0Valid && parsedSellAmount > 0n && !insufficientBalance
  const step2Valid = step1Valid && buyAddr && isValidTokenAddress(buyToken) && buyInfo.symbol && buyDecimals != null
    && sellToken.toLowerCase() !== buyToken.toLowerCase()
  const step3Valid = step2Valid && parsedBuyAmount > 0n

  function resetAll() {
    setStep(0); setSellToken(''); setBuyToken(''); setSellAmount(''); setBuyAmount('')
    resetOrder()
  }

  if (!isConnected) {
    return (
      <div className="text-center py-16">
        <h2 className="text-xl font-semibold text-white mb-2">Connect your wallet</h2>
        <p className="text-gray-400">Connect a wallet to create orders.</p>
      </div>
    )
  }

  // ── Success screen ──────────────────────────────────────────

  if (orderCreated) {
    return (
      <div className="max-w-lg mx-auto py-16 text-center">
        <div className="w-16 h-16 rounded-full bg-emerald-600/20 flex items-center justify-center mx-auto mb-4">
          <span className="text-3xl text-emerald-400">{'\u2713'}</span>
        </div>
        <h2 className="text-xl font-semibold text-white mb-2">Order Created</h2>
        <p className="text-gray-400 mb-6 text-sm break-all">Tx: {txHash}</p>
        <button onClick={resetAll}
          className="px-6 py-2.5 rounded-lg bg-gray-800 hover:bg-gray-700 text-gray-300 transition-colors">
          Create Another
        </button>
      </div>
    )
  }

  return (
    <div className="max-w-lg mx-auto">
      <h1 className="text-xl font-semibold text-white mb-2">Create Order</h1>
      <p className="text-sm text-gray-400 mb-6">Set up a new OTC order in 4 steps.</p>

      <Steps current={step} total={4} />

      {/* ── Step 0: Sell token ──────────────────────────────── */}
      {step === 0 && (
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">What token are you selling?</label>
            <input type="text" value={sellToken} onChange={e => setSellToken(e.target.value)}
              placeholder="Paste token address (0x...)"
              autoFocus
              className="w-full px-4 py-3 rounded-xl bg-gray-900 border border-gray-700 text-gray-100 placeholder-gray-500 focus:border-emerald-500 focus:outline-none" />
          </div>

          {sellAddr && sellInfo.symbol && (
            <TokenCard address={sellAddr} balance={sellBalance} decimals={sellDecimals} label="Sell token" />
          )}

          {sellToken && !sellAddr && (
            <p className="text-red-400 text-sm">Enter a valid token address.</p>
          )}

          <button onClick={() => setStep(1)} disabled={!step0Valid}
            className="w-full py-3 rounded-xl font-medium bg-emerald-600 hover:bg-emerald-500 text-white disabled:opacity-30 disabled:cursor-not-allowed transition-colors">
            Continue
          </button>
        </div>
      )}

      {/* ── Step 1: Sell amount ─────────────────────────────── */}
      {step === 1 && (
        <div className="space-y-4">
          {sellAddr && (
            <TokenCard address={sellAddr} balance={sellBalance} decimals={sellDecimals!} label="Selling" />
          )}

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">How much do you want to sell?</label>
            <div className="relative">
              <input type="text" value={sellAmount} onChange={e => setSellAmount(e.target.value)}
                placeholder="0.0" autoFocus
                className="w-full px-4 py-3 pr-20 rounded-xl bg-gray-900 border border-gray-700 text-gray-100 placeholder-gray-500 focus:border-emerald-500 focus:outline-none text-lg" />
              {sellBalance !== undefined && sellBalance > 0n && (
                <button
                  onClick={() => setSellAmount(formatUnits(sellBalance, sellDecimals!))}
                  className="absolute right-3 top-1/2 -translate-y-1/2 px-2 py-1 rounded text-xs bg-gray-700 hover:bg-gray-600 text-emerald-400 font-medium">
                  MAX
                </button>
              )}
            </div>
            {sellBalance !== undefined && (
              <p className="text-xs text-gray-500 mt-1">
                Available: {formatTokenAmount(sellBalance, sellDecimals!)} {sellInfo.symbol}
              </p>
            )}
            {insufficientBalance && (
              <p className="text-red-400 text-sm mt-1">Insufficient balance.</p>
            )}
          </div>

          <div className="flex gap-3">
            <button onClick={() => setStep(0)}
              className="flex-1 py-3 rounded-xl font-medium bg-gray-800 hover:bg-gray-700 text-gray-300 transition-colors">
              Back
            </button>
            <button onClick={() => setStep(2)} disabled={!step1Valid}
              className="flex-1 py-3 rounded-xl font-medium bg-emerald-600 hover:bg-emerald-500 text-white disabled:opacity-30 disabled:cursor-not-allowed transition-colors">
              Continue
            </button>
          </div>
        </div>
      )}

      {/* ── Step 2: Buy token ──────────────────────────────── */}
      {step === 2 && (
        <div className="space-y-4">
          <div className="rounded-xl bg-gray-900/50 border border-gray-800 p-3 flex items-center justify-between text-sm">
            <span className="text-gray-400">Selling</span>
            <span className="text-white font-medium">{sellAmount} {sellInfo.symbol}</span>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">What token do you want in return?</label>
            <input type="text" value={buyToken} onChange={e => setBuyToken(e.target.value)}
              placeholder="Paste token address (0x...)"
              autoFocus
              className="w-full px-4 py-3 rounded-xl bg-gray-900 border border-gray-700 text-gray-100 placeholder-gray-500 focus:border-emerald-500 focus:outline-none" />
          </div>

          {buyAddr && buyInfo.symbol && (
            <TokenCard address={buyAddr} decimals={buyDecimals} label="Buy token" />
          )}

          {sellToken && buyToken && sellToken.toLowerCase() === buyToken.toLowerCase() && (
            <p className="text-red-400 text-sm">Cannot be the same as the sell token.</p>
          )}

          <div className="flex gap-3">
            <button onClick={() => setStep(1)}
              className="flex-1 py-3 rounded-xl font-medium bg-gray-800 hover:bg-gray-700 text-gray-300 transition-colors">
              Back
            </button>
            <button onClick={() => setStep(3)} disabled={!step2Valid}
              className="flex-1 py-3 rounded-xl font-medium bg-emerald-600 hover:bg-emerald-500 text-white disabled:opacity-30 disabled:cursor-not-allowed transition-colors">
              Continue
            </button>
          </div>
        </div>
      )}

      {/* ── Step 3: Buy amount + review + submit ───────────── */}
      {step === 3 && (
        <div className="space-y-4">
          {/* Summary */}
          <div className="rounded-xl bg-gray-900/50 border border-gray-800 p-4 space-y-3">
            <div className="flex items-center justify-between text-sm">
              <span className="text-gray-400">Selling</span>
              <span className="text-white font-medium">{sellAmount} {sellInfo.symbol}</span>
            </div>
            <div className="flex justify-center">
              <span className="text-gray-600 text-lg">{'\u2193'}</span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-gray-400">Receiving</span>
              <span className="text-gray-500">{buyInfo.symbol ?? '...'}</span>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              How much {buyInfo.symbol ?? 'of the buy token'} do you want?
            </label>
            <input type="text" value={buyAmount} onChange={e => setBuyAmount(e.target.value)}
              placeholder="0.0" autoFocus
              className="w-full px-4 py-3 rounded-xl bg-gray-900 border border-gray-700 text-gray-100 placeholder-gray-500 focus:border-emerald-500 focus:outline-none text-lg" />
            {parsedSellAmount > 0n && parsedBuyAmount > 0n && (
              <p className="text-xs text-gray-500 mt-1">
                Rate: 1 {sellInfo.symbol} = {(Number(parsedBuyAmount) / Number(parsedSellAmount)).toFixed(6)} {buyInfo.symbol}
              </p>
            )}
          </div>

          {/* Pair / approval status */}
          {sellAddr && buyAddr && (
            <div className="rounded-xl bg-gray-900/50 border border-gray-800 p-3 text-xs space-y-1.5">
              <div className="flex justify-between">
                <span className="text-gray-500">Pair</span>
                {pairExists
                  ? <span className="text-emerald-400">Deployed</span>
                  : <span className="text-yellow-400">Will be created first</span>}
              </div>
              {pairExists && (
                <div className="flex justify-between">
                  <span className="text-gray-500">Allowance</span>
                  {needsApproval
                    ? <span className="text-yellow-400">Approval needed</span>
                    : <span className="text-emerald-400">Sufficient</span>}
                </div>
              )}
            </div>
          )}

          {/* Action buttons */}
          <div className="flex gap-3">
            <button onClick={() => setStep(2)}
              className="py-3 px-5 rounded-xl font-medium bg-gray-800 hover:bg-gray-700 text-gray-300 transition-colors">
              Back
            </button>

            {!pairExists && step3Valid && (
              <button onClick={() => sellAddr && buyAddr && createPair(sellAddr, buyAddr)}
                disabled={isCreatingPair}
                className="flex-1 py-3 rounded-xl font-medium bg-blue-600 hover:bg-blue-500 text-white disabled:opacity-50 transition-colors">
                {isCreatingPair ? 'Creating Pair...' : '1. Create Pair'}
              </button>
            )}

            {pairExists && needsApproval && (
              <button onClick={approve} disabled={isApproving}
                className="flex-1 py-3 rounded-xl font-medium bg-yellow-600 hover:bg-yellow-500 text-white disabled:opacity-50 transition-colors">
                {isApproving ? 'Approving...' : `Approve ${sellInfo.symbol}`}
              </button>
            )}

            {pairExists && !needsApproval && (
              <button onClick={() => {
                  if (!pair || !parsedSellAmount || !parsedBuyAmount || sellDecimals == null || buyDecimals == null) return
                  createOrder(pair, sellToken0, sellAmount, buyAmount, sellDecimals, buyDecimals)
                }}
                disabled={!step3Valid || isCreatingOrder}
                className="flex-1 py-3 rounded-xl font-medium bg-emerald-600 hover:bg-emerald-500 text-white disabled:opacity-30 disabled:cursor-not-allowed transition-colors">
                {isCreatingOrder ? 'Creating Order...' : 'Create Order'}
              </button>
            )}
          </div>

          {error && <p className="text-red-400 text-sm">Transaction failed. Check your wallet for details.</p>}
        </div>
      )}
    </div>
  )
}
