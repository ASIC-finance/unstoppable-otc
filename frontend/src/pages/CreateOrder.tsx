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
    return <div className="surface-muted h-20 animate-pulse" />
  }

  return (
    <div className="surface-muted px-4 py-4">
      <div className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--text-muted)] mb-2">{label}</div>
      <div className="flex items-center gap-3">
        {logo ? (
          <img src={logo} alt="" className="w-10 h-10 rounded-full" />
        ) : (
          <span className="w-10 h-10 rounded-full bg-[var(--surface-dark)] flex items-center justify-center text-sm font-bold text-[var(--text-inverse)]">
            {(symbol ?? '?').slice(0, 2).toUpperCase()}
          </span>
        )}
        <div className="min-w-0 flex-1">
          <div className="font-semibold text-[var(--text-strong)] truncate">{symbol ?? 'Unknown'}</div>
          <div className="text-xs text-[var(--text-soft)] truncate">{name ?? address}</div>
        </div>
        {balance !== undefined && (
          <div className="text-right">
            <div className="text-sm font-semibold text-[var(--text-strong)] numeric">{formatTokenAmount(balance, decimals)}</div>
            <div className="text-xs font-medium uppercase tracking-[0.14em] text-[var(--text-muted)]">Balance</div>
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
          <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-semibold border transition-colors ${
            i < current ? 'bg-[var(--accent)] border-[var(--accent)] text-white'
            : i === current ? 'border-[var(--accent)] text-[var(--accent)]'
            : 'border-[var(--border-strong)] text-[var(--text-muted)]'
          }`}>
            {i < current ? '\u2713' : i + 1}
          </div>
          {i < total - 1 && (
            <div className={`w-8 h-px ${i < current ? 'bg-[var(--accent)]' : 'bg-[var(--border-strong)]'}`} />
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
      <section className="surface px-6 py-10 text-center sm:px-8">
        <p className="section-label">Wallet Required</p>
        <h2 className="text-2xl font-semibold tracking-tight text-[var(--text-strong)]">
          Connect a wallet to create orders.
        </h2>
        <p className="mt-3 max-w-xl mx-auto text-sm leading-6 text-[var(--text-soft)]">
          The order creation flow validates token metadata, pair state, and approvals before signing.
        </p>
      </section>
    )
  }

  // ── Success screen ──────────────────────────────────────────

  if (orderCreated) {
    return (
      <section className="surface mx-auto max-w-xl px-6 py-10 text-center sm:px-8">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-[var(--accent-soft)] text-3xl text-[var(--accent)]">
          {'\u2713'}
        </div>
        <p className="section-label mt-5">Order Created</p>
        <h2 className="text-2xl font-semibold tracking-tight text-[var(--text-strong)]">
          Your OTC order is live.
        </h2>
        <p className="mt-3 text-sm text-[var(--text-soft)]">
          The transaction has been submitted successfully.
        </p>
        <div className="surface-muted mt-6 px-4 py-4 text-left">
          <div className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--text-muted)]">Transaction Hash</div>
          <div className="mt-2 break-all text-sm font-medium text-[var(--text-strong)]">{txHash}</div>
        </div>
        <div className="mt-6">
          <button type="button" onClick={resetAll} className="primary-button">Create Another Order</button>
        </div>
      </section>
    )
  }

  return (
    <section className="surface mx-auto max-w-xl px-6 py-6 sm:px-8">
      <div className="mb-6">
        <p className="section-label">New Order</p>
        <h1 className="text-2xl font-semibold tracking-tight text-[var(--text-strong)]">Create Order</h1>
        <p className="mt-2 text-sm text-[var(--text-soft)]">Set up a new OTC order in 4 steps.</p>
      </div>

      <Steps current={step} total={4} />

      {/* ── Step 0: Sell token ──────────────────────────────── */}
      {step === 0 && (
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-semibold text-[var(--text-strong)] mb-2">What token are you selling?</label>
            <input type="text" value={sellToken} onChange={e => setSellToken(e.target.value)}
              placeholder="Paste token address (0x...)"
              autoFocus autoComplete="off" spellCheck={false}
              className="input-field" />
          </div>

          {sellAddr && sellInfo.symbol && sellDecimals != null && (
            <TokenCard address={sellAddr} balance={sellBalance} decimals={sellDecimals} label="Sell token" />
          )}

          {sellToken && !sellAddr && (
            <p className="text-sm font-medium text-[var(--danger)]">Enter a valid token address.</p>
          )}

          <button type="button" onClick={() => setStep(1)} disabled={!step0Valid} className="primary-button w-full">
            Continue
          </button>
        </div>
      )}

      {/* ── Step 1: Sell amount ─────────────────────────────── */}
      {step === 1 && (
        <div className="space-y-4">
          {sellAddr && sellDecimals != null && (
            <TokenCard address={sellAddr} balance={sellBalance} decimals={sellDecimals} label="Selling" />
          )}

          <div>
            <label className="block text-sm font-semibold text-[var(--text-strong)] mb-2">How much do you want to sell?</label>
            <div className="relative">
              <input type="text" value={sellAmount} onChange={e => setSellAmount(e.target.value)}
                placeholder="0.0" autoFocus autoComplete="off" inputMode="decimal" spellCheck={false}
                className="input-field pr-20 text-lg" />
              {sellBalance !== undefined && sellBalance > 0n && sellDecimals != null && (
                <button type="button"
                  onClick={() => setSellAmount(formatUnits(sellBalance, sellDecimals))}
                  className="secondary-button absolute right-3 top-1/2 min-h-0 -translate-y-1/2 px-3 py-1.5 text-xs">
                  MAX
                </button>
              )}
            </div>
            {sellBalance !== undefined && sellDecimals != null && (
              <p className="text-xs text-[var(--text-muted)] mt-2">
                Available: <span className="numeric font-semibold text-[var(--text-strong)]">{formatTokenAmount(sellBalance, sellDecimals)}</span> {sellInfo.symbol}
              </p>
            )}
            {insufficientBalance && (
              <p className="text-sm font-medium text-[var(--danger)] mt-2">Insufficient balance.</p>
            )}
          </div>

          <div className="flex gap-3">
            <button type="button" onClick={() => setStep(0)} className="ghost-button flex-1">Back</button>
            <button type="button" onClick={() => setStep(2)} disabled={!step1Valid} className="primary-button flex-1">
              Continue
            </button>
          </div>
        </div>
      )}

      {/* ── Step 2: Buy token ──────────────────────────────── */}
      {step === 2 && (
        <div className="space-y-4">
          <div className="surface-muted px-4 py-3 flex items-center justify-between text-sm">
            <span className="text-[var(--text-muted)]">Selling</span>
            <span className="font-semibold text-[var(--text-strong)]">{sellAmount} {sellInfo.symbol}</span>
          </div>

          <div>
            <label className="block text-sm font-semibold text-[var(--text-strong)] mb-2">What token do you want in return?</label>
            <input type="text" value={buyToken} onChange={e => setBuyToken(e.target.value)}
              placeholder="Paste token address (0x...)"
              autoFocus autoComplete="off" spellCheck={false}
              className="input-field" />
          </div>

          {buyAddr && buyInfo.symbol && buyDecimals != null && (
            <TokenCard address={buyAddr} decimals={buyDecimals} label="Buy token" />
          )}

          {sellToken && buyToken && sellToken.toLowerCase() === buyToken.toLowerCase() && (
            <p className="text-sm font-medium text-[var(--danger)]">Cannot be the same as the sell token.</p>
          )}

          <div className="flex gap-3">
            <button type="button" onClick={() => setStep(1)} className="ghost-button flex-1">Back</button>
            <button type="button" onClick={() => setStep(3)} disabled={!step2Valid} className="primary-button flex-1">
              Continue
            </button>
          </div>
        </div>
      )}

      {/* ── Step 3: Buy amount + review + submit ───────────── */}
      {step === 3 && (
        <div className="space-y-4">
          <div className="surface-muted px-4 py-4 space-y-3">
            <div className="flex items-center justify-between text-sm">
              <span className="text-[var(--text-muted)]">Selling</span>
              <span className="font-semibold text-[var(--text-strong)]">{sellAmount} {sellInfo.symbol}</span>
            </div>
            <div className="flex justify-center">
              <span className="text-lg text-[var(--text-muted)]">{'\u2193'}</span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-[var(--text-muted)]">Receiving</span>
              <span className="text-[var(--text-soft)]">{buyInfo.symbol ?? '...'}</span>
            </div>
          </div>

          <div>
            <label className="block text-sm font-semibold text-[var(--text-strong)] mb-2">
              How much {buyInfo.symbol ?? 'of the buy token'} do you want?
            </label>
            <input type="text" value={buyAmount} onChange={e => setBuyAmount(e.target.value)}
              placeholder="0.0" autoFocus autoComplete="off" inputMode="decimal" spellCheck={false}
              className="input-field text-lg" />
            {parsedSellAmount > 0n && parsedBuyAmount > 0n && (
              <p className="text-xs text-[var(--text-muted)] mt-2">
                Rate: <span className="numeric font-semibold text-[var(--text-strong)]">1 {sellInfo.symbol} = {(Number(parsedBuyAmount) / Number(parsedSellAmount)).toFixed(6)} {buyInfo.symbol}</span>
              </p>
            )}
          </div>

          {sellAddr && buyAddr && (
            <div className="surface-muted px-4 py-3 text-xs space-y-2">
              <div className="flex justify-between">
                <span className="text-[var(--text-muted)]">Pair</span>
                {pairExists
                  ? <span className="font-semibold text-[var(--accent)]">Deployed</span>
                  : <span className="font-semibold text-[var(--warning)]">Will be created first</span>}
              </div>
              {pairExists && (
                <div className="flex justify-between">
                  <span className="text-[var(--text-muted)]">Allowance</span>
                  {needsApproval
                    ? <span className="font-semibold text-[var(--warning)]">Approval needed</span>
                    : <span className="font-semibold text-[var(--accent)]">Sufficient</span>}
                </div>
              )}
            </div>
          )}

          <div className="flex gap-3">
            <button type="button" onClick={() => setStep(2)} className="ghost-button">Back</button>

            {!pairExists && step3Valid && (
              <button type="button"
                onClick={() => sellAddr && buyAddr && createPair(sellAddr, buyAddr)}
                disabled={isCreatingPair}
                className="primary-button flex-1">
                {isCreatingPair ? 'Creating Pair\u2026' : '1. Create Pair'}
              </button>
            )}

            {pairExists && needsApproval && (
              <button type="button" onClick={approve} disabled={isApproving} className="warning-button flex-1">
                {isApproving ? 'Approving\u2026' : `Approve ${sellInfo.symbol}`}
              </button>
            )}

            {pairExists && !needsApproval && (
              <button type="button"
                onClick={() => {
                  if (!pair || !parsedSellAmount || !parsedBuyAmount || sellDecimals == null || buyDecimals == null) return
                  createOrder(pair, sellToken0, sellAmount, buyAmount, sellDecimals, buyDecimals)
                }}
                disabled={!step3Valid || isCreatingOrder}
                className="primary-button flex-1">
                {isCreatingOrder ? 'Creating Order\u2026' : 'Create Order'}
              </button>
            )}
          </div>

          {error && <p className="text-sm font-medium text-[var(--danger)]">Transaction failed. Check your wallet for details.</p>}
        </div>
      )}
    </section>
  )
}
