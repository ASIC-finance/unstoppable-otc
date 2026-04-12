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
    return <div className="token-panel h-20 animate-pulse" />
  }

  return (
    <div className="token-panel">
      <div className="eyebrow mb-2">{label}</div>
      <div className="flex items-center gap-3">
        {logo ? (
          <img src={logo} alt="" width={40} height={40} className="h-10 w-10 rounded-full" />
        ) : (
          <span className="token-avatar token-avatar-lg">
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
            <div className="eyebrow mb-0 mt-1">Balance</div>
          </div>
        )}
      </div>
    </div>
  )
}

// ── Step indicator ──────────────────────────────────────────────

const stepLabels = ['Sell Token', 'Sell Size', 'Buy Token', 'Review']

function Steps({ current, total }: { current: number; total: number }) {
  return (
    <div className="ticket-steps" aria-label="Create order progress">
      {Array.from({ length: total }, (_, i) => (
        <div
          key={i}
          className="ticket-step"
          data-state={i < current ? 'done' : i === current ? 'current' : 'pending'}
          aria-current={i === current ? 'step' : undefined}
        >
          <span className="ticket-step-index">
            {i < current ? '\u2713' : i + 1}
          </span>
          <span className="truncate">{stepLabels[i]}</span>
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

  if (!isConnected) {
    return (
      <section className="workspace-header">
        <div>
          <p className="eyebrow">Wallet Required</p>
          <h1 className="workspace-title">
            Connect a wallet to create OTC orders.
          </h1>
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

  // ── Success screen ──────────────────────────────────────────

  if (orderCreated) {
    return (
      <section className="ticket-panel mx-auto max-w-2xl text-center">
        <span className="status-pill status-active mx-auto mb-4">Order Created</span>
        <h1 className="workspace-title">
          Your OTC order is live.
        </h1>
        <p className="workspace-copy mx-auto">
          The transaction has been submitted successfully.
        </p>
        <div className="token-panel mt-6 text-left">
          <div className="eyebrow">Transaction Hash</div>
          <div className="mt-2 break-all text-sm font-medium text-[var(--text-strong)]">{txHash}</div>
        </div>
        <div className="mt-6 flex justify-center">
          <button type="button" onClick={resetAll} className="primary-button">Create Another Order</button>
        </div>
      </section>
    )
  }

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

        <Steps current={step} total={4} />

        {/* ── Step 0: Sell token ──────────────────────────────── */}
        {step === 0 && (
          <div className="ticket-body">
            <div className="field-stack">
              <label htmlFor="sell-token" className="field-label">Sell Token Address</label>
              <input
                id="sell-token"
                name="sell_token"
                type="text"
                value={sellToken}
                onChange={e => setSellToken(e.target.value)}
                placeholder="Paste token address, 0x…"
                autoComplete="off"
                spellCheck={false}
                className="input-field"
              />
            </div>

            {sellAddr && sellInfo.symbol && sellDecimals != null && (
              <TokenCard address={sellAddr} balance={sellBalance} decimals={sellDecimals} label="Sell Token" />
            )}

            {sellToken && !sellAddr && (
              <p className="text-sm font-medium text-[var(--danger)]">Enter a valid token address.</p>
            )}

            <button type="button" onClick={() => setStep(1)} disabled={!step0Valid} className="primary-button w-full">
              Set Sell Amount
            </button>
          </div>
        )}

        {/* ── Step 1: Sell amount ─────────────────────────────── */}
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
                  placeholder="0.00…"
                  autoComplete="off"
                  inputMode="decimal"
                  spellCheck={false}
                  className="input-field pr-20 text-lg"
                />
                {sellBalance !== undefined && sellBalance > 0n && sellDecimals != null && (
                  <button type="button"
                    onClick={() => setSellAmount(formatUnits(sellBalance, sellDecimals))}
                    className="secondary-button absolute right-3 top-1/2 min-h-0 -translate-y-1/2 px-3 py-1.5 text-xs">
                    Max
                  </button>
                )}
              </div>
              {sellBalance !== undefined && sellDecimals != null && (
                <p className="text-xs text-[var(--text-muted)]">
                  Available: <span className="numeric font-semibold text-[var(--text-strong)]">{formatTokenAmount(sellBalance, sellDecimals)}</span> {sellInfo.symbol}
                </p>
              )}
              {insufficientBalance && (
                <p className="text-sm font-medium text-[var(--danger)]">Insufficient balance.</p>
              )}
            </div>

            <div className="ticket-actions">
              <button type="button" onClick={() => setStep(0)} className="ghost-button">Back</button>
              <button type="button" onClick={() => setStep(2)} disabled={!step1Valid} className="primary-button">
                Choose Buy Token
              </button>
            </div>
          </div>
        )}

        {/* ── Step 2: Buy token ──────────────────────────────── */}
        {step === 2 && (
          <div className="ticket-body">
            <div className="token-panel flex items-center justify-between gap-3 text-sm">
              <span className="text-[var(--text-muted)]">Selling</span>
              <span className="font-semibold text-[var(--text-strong)]">{sellAmount} {sellInfo.symbol}</span>
            </div>

            <div className="field-stack">
              <label htmlFor="buy-token" className="field-label">Buy Token Address</label>
              <input
                id="buy-token"
                name="buy_token"
                type="text"
                value={buyToken}
                onChange={e => setBuyToken(e.target.value)}
                placeholder="Paste token address, 0x…"
                autoComplete="off"
                spellCheck={false}
                className="input-field"
              />
            </div>

            {buyAddr && buyInfo.symbol && buyDecimals != null && (
              <TokenCard address={buyAddr} decimals={buyDecimals} label="Buy Token" />
            )}

            {sellToken && buyToken && sellToken.toLowerCase() === buyToken.toLowerCase() && (
              <p className="text-sm font-medium text-[var(--danger)]">Cannot be the same as the sell token.</p>
            )}

            <div className="ticket-actions">
              <button type="button" onClick={() => setStep(1)} className="ghost-button">Back</button>
              <button type="button" onClick={() => setStep(3)} disabled={!step2Valid} className="primary-button">
                Review Order
              </button>
            </div>
          </div>
        )}

        {/* ── Step 3: Buy amount + review + submit ───────────── */}
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
                placeholder="0.00…"
                autoComplete="off"
                inputMode="decimal"
                spellCheck={false}
                className="input-field text-lg"
              />
              {parsedSellAmount > 0n && parsedBuyAmount > 0n && (
                <p className="text-xs text-[var(--text-muted)]">
                  Rate: <span className="numeric font-semibold text-[var(--text-strong)]">1 {sellInfo.symbol} = {(Number(parsedBuyAmount) / Number(parsedSellAmount)).toFixed(6)} {buyInfo.symbol}</span>
                </p>
              )}
            </div>

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
                <button type="button"
                  onClick={() => sellAddr && buyAddr && createPair(sellAddr, buyAddr)}
                  disabled={isCreatingPair}
                  className="primary-button">
                  {isCreatingPair ? 'Creating Pair\u2026' : 'Create Pair'}
                </button>
              )}

              {pairExists && needsApproval && (
                <button type="button" onClick={approve} disabled={isApproving} className="warning-button">
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
                  className="primary-button">
                  {isCreatingOrder ? 'Creating Order\u2026' : 'Submit Order'}
                </button>
              )}
            </div>

            {error && <p className="text-sm font-medium text-[var(--danger)]">Transaction failed. Check your wallet for details.</p>}
          </div>
        )}
      </div>

      <aside className="ticket-summary" aria-label="Order summary">
        <div>
          <p className="eyebrow">Ticket Summary</p>
          <h2 className="m-0 text-lg font-extrabold text-[var(--text-strong)]">Pre-trade checks</h2>
        </div>
        <div className="summary-row">
          <span>Wallet</span>
          <strong>{address ? `${address.slice(0, 6)}…${address.slice(-4)}` : 'Not Connected'}</strong>
        </div>
        <div className="summary-row">
          <span>Selling</span>
          <strong>{sellSummary}</strong>
        </div>
        <div className="summary-row">
          <span>Receiving</span>
          <strong>{buySummary}</strong>
        </div>
        <div className="summary-row">
          <span>Pair</span>
          <strong>{pairSummary}</strong>
        </div>
        <div className="summary-row">
          <span>Allowance</span>
          <strong>{allowanceSummary}</strong>
        </div>
      </aside>
    </section>
  )
}
