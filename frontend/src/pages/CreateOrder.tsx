import { useState, useEffect, useMemo } from 'react'
import { useAccount, useChainId, useReadContract } from 'wagmi'
import { erc20Abi, isAddress, formatUnits } from 'viem'
import { useTokenInfo } from '../hooks/useTokenInfo'
import { useTokenAllowance } from '../hooks/useTokenAllowance'
import { useCreateOrder } from '../hooks/useCreateOrder'
import { usePairAddress, useCreatePair } from '../hooks/useFactory'
import { usePairTokens } from '../hooks/useOrders'
import { formatTokenAmount } from '../utils/format'
import { isValidTokenAddress, tryParseAmount } from '../utils/validation'
import { isSameAddress, ZERO_ADDRESS } from '../utils/address'
import { txUrl } from '../lib/explorer'
import { TokenCard } from '../components/create-order/TokenCard'
import { Steps } from '../components/create-order/Steps'
import { OrderSummary } from '../components/create-order/OrderSummary'
import { CreateOrderSuccess } from '../components/create-order/CreateOrderSuccess'
import { TokenPicker } from '../components/TokenPicker'
import { DEFAULT_MIN_BUY_BPS } from '../types/orders'

/**
 * Slippage presets — basis points expressed as the `minBuyBps` wire value.
 *   10000 bps = 0% slippage allowed (safe for vanilla ERC-20s, rejects FoT).
 *    9950   = 0.5%
 *    9900   = 1%
 *    9700   = 3% — covers 1% FoT on both inbound and outbound hops.
 */
const SLIPPAGE_PRESETS = [
  { label: '0% (default)', bps: 10_000, hint: 'Rejects fee-on-transfer tokens.' },
  { label: '0.5%', bps: 9_950, hint: 'Small tolerance for low-fee tokens.' },
  { label: '1%', bps: 9_900, hint: 'Common FoT buy-token rate.' },
  { label: '3%', bps: 9_700, hint: '1% FoT on both inbound and outbound hops.' },
] as const

/** 6 decimals of precision is plenty for a preview rate — avoids Number() overflow. */
function computeRate(buyAmount: bigint, sellAmount: bigint, buyDecimals: number): string {
  if (sellAmount === 0n) return '—'
  const scaled = (buyAmount * 10n ** BigInt(buyDecimals + 6)) / sellAmount
  return formatUnits(scaled, buyDecimals + 6)
}

export function CreateOrder() {
  const { address, isConnected } = useAccount()
  const chainId = useChainId()

  const [step, setStep] = useState(0)
  const [sellToken, setSellToken] = useState('')
  const [buyToken, setBuyToken] = useState('')
  const [sellAmount, setSellAmount] = useState('')
  const [buyAmount, setBuyAmount] = useState('')
  const [minBuyBps, setMinBuyBps] = useState<number>(DEFAULT_MIN_BUY_BPS)

  const sellAddr = isAddress(sellToken) ? (sellToken as `0x${string}`) : undefined
  const buyAddr = isAddress(buyToken) ? (buyToken as `0x${string}`) : undefined

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
  const pairExists = pairAddr && pairAddr !== ZERO_ADDRESS
  const pair = pairExists ? (pairAddr as `0x${string}`) : undefined

  const { token0 } = usePairTokens(pair)
  const sellToken0 = useMemo(() => {
    if (!pair || !token0 || !sellAddr) return true
    return isSameAddress(token0, sellAddr)
  }, [pair, token0, sellAddr])

  const { allowance, approve, isApproving, refetchAllowance, approvalConfirmed } = useTokenAllowance(
    sellAddr,
    address,
    pair,
    sellInfo.symbol,
  )
  const { createPair, isPending: isCreatingPair, isSuccess: pairCreated, reset: resetPair } = useCreatePair()
  const { createOrder, isPending: isCreatingOrder, isSuccess: orderCreated, status: orderStatus, reset: resetOrder, txHash } = useCreateOrder()

  useEffect(() => {
    if (pairCreated) {
      refetchPair()
      resetPair()
    }
  }, [pairCreated, refetchPair, resetPair])
  useEffect(() => {
    if (approvalConfirmed) refetchAllowance()
  }, [approvalConfirmed, refetchAllowance])

  const sellDecimals = sellInfo.decimals
  const buyDecimals = buyInfo.decimals
  const parsedSellAmount = sellDecimals != null ? (tryParseAmount(sellAmount, sellDecimals) ?? 0n) : 0n
  const parsedBuyAmount = buyDecimals != null ? (tryParseAmount(buyAmount, buyDecimals) ?? 0n) : 0n
  const needsApproval = pair && parsedSellAmount > 0n && allowance < parsedSellAmount
  const insufficientBalance = parsedSellAmount > 0n && sellBalance !== undefined && parsedSellAmount > sellBalance

  const step0Valid = !!(sellAddr && isValidTokenAddress(sellToken) && sellInfo.symbol && sellDecimals != null)
  const step1Valid = step0Valid && parsedSellAmount > 0n && !insufficientBalance
  const step2Valid = step1Valid && !!(buyAddr && isValidTokenAddress(buyToken) && buyInfo.symbol && buyDecimals != null)
    && !isSameAddress(sellToken, buyToken)
  const step3Valid = step2Valid && parsedBuyAmount > 0n

  function resetAll() {
    setStep(0)
    setSellToken('')
    setBuyToken('')
    setSellAmount('')
    setBuyAmount('')
    setMinBuyBps(DEFAULT_MIN_BUY_BPS)
    resetOrder()
  }

  // ── Disconnected state ──────────────────────────────────────
  if (!isConnected) {
    return (
      <section className="workspace-header">
        <div>
          <p className="eyebrow">Wallet Required</p>
          <h1 className="workspace-title">Connect a wallet to create OTC orders.</h1>
          <p className="workspace-copy">
            The ticket validates token metadata, pair state, and approvals before signing.
          </p>
        </div>
        <div className="workspace-meta">
          <span className="kpi-pill">Execution ticket locked</span>
        </div>
      </section>
    )
  }

  // ── Success ─────────────────────────────────────────────────
  if (orderCreated) {
    return (
      <CreateOrderSuccess
        txHash={txHash}
        explorerUrl={txUrl(chainId, txHash)}
        onReset={resetAll}
      />
    )
  }

  const sellSummary = sellAmount && sellInfo.symbol ? `${sellAmount} ${sellInfo.symbol}` : sellInfo.symbol ?? 'Not Set'
  const buySummary = buyAmount && buyInfo.symbol ? `${buyAmount} ${buyInfo.symbol}` : buyInfo.symbol ?? 'Not Set'
  const pairSummary = !sellAddr || !buyAddr
    ? 'Not Checked'
    : pairExists
      ? 'Deployed'
      : 'Create Pair First'
  const allowanceSummary = !pairExists
    ? 'After Pair'
    : needsApproval
      ? 'Approval Needed'
      : 'Sufficient'

  const submitCopy =
    orderStatus === 'signing' ? 'Check wallet\u2026'
      : orderStatus === 'pending' ? 'Confirming\u2026'
        : isCreatingOrder ? 'Creating Order\u2026'
          : 'Submit Order'

  return (
    <section className="ticket-shell">
      <div className="ticket-panel">
        <div className="ticket-heading">
          <div>
            <p className="eyebrow">New Order</p>
            <h1 className="workspace-title">Execution Ticket</h1>
            <p className="workspace-copy">Define the route, size, quote, and required approval.</p>
          </div>
          <span className="kpi-pill">Step {step + 1} of 4</span>
        </div>

        <Steps current={step} />

        {step === 0 && (
          <div className="ticket-body">
            <div className="field-stack">
              <label htmlFor="sell-token" className="field-label">Sell Token</label>
              <TokenPicker
                id="sell-token"
                label="Sell Token"
                value={sellToken}
                onChange={setSellToken}
                excludeAddress={buyToken || undefined}
                placeholder="Search by symbol, name, or paste 0x\u2026"
              />
            </div>

            {sellAddr && sellInfo.symbol && sellDecimals != null && (
              <TokenCard address={sellAddr} balance={sellBalance} decimals={sellDecimals} label="Sell Token" />
            )}

            <button type="button" onClick={() => setStep(1)} disabled={!step0Valid} className="primary-button w-full">
              Set Sell Amount
            </button>
          </div>
        )}

        {step === 1 && (
          <div className="ticket-body">
            {sellAddr && sellDecimals != null && (
              <TokenCard address={sellAddr} balance={sellBalance} decimals={sellDecimals} label="Selling" />
            )}

            <div className="field-stack">
              <label htmlFor="sell-amount" className="field-label">Sell Amount</label>
              <div className="relative">
                <input
                  id="sell-amount"
                  name="sell_amount"
                  type="text"
                  value={sellAmount}
                  onChange={e => setSellAmount(e.target.value)}
                  placeholder="0.00\u2026"
                  autoComplete="off"
                  inputMode="decimal"
                  spellCheck={false}
                  aria-invalid={sellAmount && parsedSellAmount === 0n ? 'true' : undefined}
                  className="input-field pr-20 text-lg"
                />
                {sellBalance !== undefined && sellBalance > 0n && sellDecimals != null && (
                  <button
                    type="button"
                    onClick={() => setSellAmount(formatUnits(sellBalance, sellDecimals))}
                    className="secondary-button absolute right-3 top-1/2 min-h-0 -translate-y-1/2 px-3 py-1.5 text-xs"
                  >
                    Max
                  </button>
                )}
              </div>
              {sellBalance !== undefined && sellDecimals != null && (
                <p className="text-xs text-[var(--text-muted)]">
                  Available:{' '}
                  <span className="numeric font-semibold text-[var(--text-strong)]">
                    {formatTokenAmount(sellBalance, sellDecimals)}
                  </span>{' '}
                  {sellInfo.symbol}
                </p>
              )}
              {insufficientBalance && (
                <p className="text-sm font-medium text-[var(--danger)]">Insufficient balance.</p>
              )}
            </div>

            <div className="ticket-actions">
              <button type="button" onClick={() => setStep(0)} className="ghost-button">Back</button>
              <button
                type="button"
                onClick={() => setStep(2)}
                disabled={!step1Valid}
                className="primary-button"
              >
                Choose Buy Token
              </button>
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="ticket-body">
            <div className="token-panel flex items-center justify-between gap-3 text-sm">
              <span className="text-[var(--text-muted)]">Selling</span>
              <span className="font-semibold text-[var(--text-strong)]">{sellAmount} {sellInfo.symbol}</span>
            </div>

            <div className="field-stack">
              <label htmlFor="buy-token" className="field-label">Buy Token</label>
              <TokenPicker
                id="buy-token"
                label="Buy Token"
                value={buyToken}
                onChange={setBuyToken}
                excludeAddress={sellToken || undefined}
                placeholder="Search by symbol, name, or paste 0x\u2026"
              />
            </div>

            {buyAddr && buyInfo.symbol && buyDecimals != null && (
              <TokenCard address={buyAddr} decimals={buyDecimals} label="Buy Token" />
            )}

            <div className="ticket-actions">
              <button type="button" onClick={() => setStep(1)} className="ghost-button">Back</button>
              <button
                type="button"
                onClick={() => setStep(3)}
                disabled={!step2Valid}
                className="primary-button"
              >
                Review Order
              </button>
            </div>
          </div>
        )}

        {step === 3 && (
          <div className="ticket-body">
            <div className="token-panel space-y-3">
              <div className="flex items-center justify-between text-sm">
                <span className="text-[var(--text-muted)]">Selling</span>
                <span className="font-semibold text-[var(--text-strong)]">{sellAmount} {sellInfo.symbol}</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-[var(--text-muted)]">Receiving</span>
                <span className="font-semibold text-[var(--text-strong)]">{buyInfo.symbol ?? 'Pending'}</span>
              </div>
            </div>

            <div className="field-stack">
              <label htmlFor="buy-amount" className="field-label">
                Requested {buyInfo.symbol ?? 'Buy Token'} Amount
              </label>
              <input
                id="buy-amount"
                name="buy_amount"
                type="text"
                value={buyAmount}
                onChange={e => setBuyAmount(e.target.value)}
                placeholder="0.00\u2026"
                autoComplete="off"
                inputMode="decimal"
                spellCheck={false}
                aria-invalid={buyAmount && parsedBuyAmount === 0n ? 'true' : undefined}
                className="input-field text-lg"
              />
              {parsedSellAmount > 0n && parsedBuyAmount > 0n && buyDecimals != null && (
                <p className="text-xs text-[var(--text-muted)]">
                  Rate:{' '}
                  <span className="numeric font-semibold text-[var(--text-strong)]">
                    1 {sellInfo.symbol} = {computeRate(parsedBuyAmount, parsedSellAmount, buyDecimals)} {buyInfo.symbol}
                  </span>
                </p>
              )}
            </div>

            <fieldset className="field-stack">
              <legend className="field-label">Slippage Tolerance (Maker)</legend>
              <p className="text-xs text-[var(--text-muted)]">
                How much less buy-token you accept on delivery. Lower values are
                stricter; use higher values only when the buy token charges a
                transfer fee (fee-on-transfer).
              </p>
              <div
                className="inline-flex flex-wrap gap-2"
                role="radiogroup"
                aria-label="Slippage tolerance"
              >
                {SLIPPAGE_PRESETS.map(preset => {
                  const selected = minBuyBps === preset.bps
                  return (
                    <button
                      key={preset.bps}
                      type="button"
                      role="radio"
                      aria-checked={selected}
                      onClick={() => setMinBuyBps(preset.bps)}
                      title={preset.hint}
                      className={selected ? 'primary-button min-h-0 px-3 py-2 text-xs' : 'ghost-button min-h-0 px-3 py-2 text-xs'}
                    >
                      {preset.label}
                    </button>
                  )
                })}
              </div>
            </fieldset>

            {sellAddr && buyAddr && (
              <div className="token-panel space-y-2 text-xs">
                <div className="flex justify-between">
                  <span className="text-[var(--text-muted)]">Pair</span>
                  {pairExists
                    ? <span className="font-semibold text-[var(--accent)]">Deployed</span>
                    : <span className="font-semibold text-[var(--warning)]">Create pair first</span>}
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

            <div className="ticket-actions">
              <button type="button" onClick={() => setStep(2)} className="ghost-button">Back</button>

              {!pairExists && step3Valid && (
                <button
                  type="button"
                  onClick={() => sellAddr && buyAddr && createPair(sellAddr, buyAddr)}
                  disabled={isCreatingPair}
                  className="primary-button"
                >
                  {isCreatingPair ? 'Creating Pair\u2026' : 'Create Pair'}
                </button>
              )}

              {pairExists && needsApproval && (
                <button
                  type="button"
                  onClick={() => approve()}
                  disabled={isApproving}
                  className="warning-button"
                  title="Grants the pair contract permission to move this token. Uses unlimited approval by default; you can revoke at any time."
                >
                  {isApproving ? 'Approving\u2026' : `Approve ${sellInfo.symbol}`}
                </button>
              )}

              {pairExists && !needsApproval && (
                <button
                  type="button"
                  onClick={() => {
                    if (!pair || !parsedSellAmount || !parsedBuyAmount || sellDecimals == null || buyDecimals == null) return
                    createOrder(pair, sellToken0, sellAmount, buyAmount, sellDecimals, buyDecimals, minBuyBps)
                  }}
                  disabled={!step3Valid || isCreatingOrder}
                  className="primary-button"
                >
                  {submitCopy}
                </button>
              )}
            </div>
          </div>
        )}
      </div>

      <OrderSummary
        walletAddress={address}
        sellSummary={sellSummary}
        buySummary={buySummary}
        pairSummary={pairSummary}
        allowanceSummary={allowanceSummary}
      />
    </section>
  )
}
