import { useCallback, useEffect, useMemo, useRef } from 'react'
import {
  useChainId,
  useWaitForTransactionReceipt,
  useWriteContract,
} from 'wagmi'
import { toast } from '../lib/toast'
import { txUrl } from '../lib/explorer'
import { parseContractError } from '../lib/errors'

export type TxStatus = 'idle' | 'signing' | 'pending' | 'success' | 'reverted'

type Options = {
  /** Imperative label for toasts ("Creating order", "Approving USDC", …). */
  label: string
  /** Optional callback fired once the receipt lands successfully. */
  onSuccess?: () => void
}

/**
 * Canonical transaction hook. Wraps `useWriteContract` +
 * `useWaitForTransactionReceipt` and surfaces toasts at every lifecycle
 * boundary (signing → pending → success / reverted).
 *
 * Distinct phases expose predictable copy to the user AND to screen readers
 * (ToastHost is an aria-live region). All error handling funnels through
 * `parseContractError` so revert reasons are decoded, not swallowed.
 */
export function useTx(options: Options) {
  const chainId = useChainId()
  const { label, onSuccess } = options

  const { writeContract, data: txHash, isPending: isSigning, error: writeError, reset: resetWrite } =
    useWriteContract()

  const {
    isLoading: isConfirming,
    isSuccess,
    isError: isReceiptError,
    error: receiptError,
  } = useWaitForTransactionReceipt({ hash: txHash })

  const toastIdRef = useRef<string | null>(null)
  const lastHashRef = useRef<`0x${string}` | undefined>(undefined)
  const lastCompletedHashRef = useRef<`0x${string}` | undefined>(undefined)

  // ── Signing / rejection ───────────────────────────────────────
  useEffect(() => {
    if (!writeError) return
    const parsed = parseContractError(writeError)
    if (parsed.userRejected) {
      toast.info('Signing cancelled', 'You dismissed the wallet prompt.')
    } else {
      toast.error(parsed.title, parsed.message)
    }
  }, [writeError])

  // ── Submitted → pending toast with hash / explorer link ───────
  useEffect(() => {
    if (!txHash || txHash === lastHashRef.current) return
    lastHashRef.current = txHash
    const id = `tx-${txHash}`
    toastIdRef.current = id
    const explorer = txUrl(chainId, txHash)
    toast.pending(
      id,
      `${label} submitted`,
      explorer ? 'Waiting for confirmation…' : undefined,
      explorer ? { label: 'View on Explorer', href: explorer } : undefined,
    )
  }, [txHash, chainId, label])

  // ── Success ───────────────────────────────────────────────────
  useEffect(() => {
    if (!isSuccess || !txHash) return
    if (lastCompletedHashRef.current === txHash) return
    lastCompletedHashRef.current = txHash

    if (toastIdRef.current) toast.dismiss(toastIdRef.current)
    const explorer = txUrl(chainId, txHash)
    toast.success(
      `${label} confirmed`,
      undefined,
      explorer ? { label: 'View on Explorer', href: explorer } : undefined,
    )
    onSuccess?.()
  }, [isSuccess, txHash, chainId, label, onSuccess])

  // ── Revert / receipt error ────────────────────────────────────
  useEffect(() => {
    if (!isReceiptError || !receiptError || !txHash) return
    if (lastCompletedHashRef.current === txHash) return
    lastCompletedHashRef.current = txHash

    if (toastIdRef.current) toast.dismiss(toastIdRef.current)
    const parsed = parseContractError(receiptError)
    const explorer = txUrl(chainId, txHash)
    toast.error(
      parsed.title,
      parsed.message,
      explorer ? { label: 'View on Explorer', href: explorer } : undefined,
    )
  }, [isReceiptError, receiptError, txHash, chainId])

  const status: TxStatus = useMemo<TxStatus>(() => {
    if (isSigning) return 'signing'
    if (isSuccess) return 'success'
    if (isReceiptError) return 'reverted'
    if (txHash && isConfirming) return 'pending'
    return 'idle'
  }, [isSigning, isSuccess, isReceiptError, txHash, isConfirming])

  const reset = useCallback(() => {
    if (toastIdRef.current) toast.dismiss(toastIdRef.current)
    toastIdRef.current = null
    lastHashRef.current = undefined
    lastCompletedHashRef.current = undefined
    resetWrite()
  }, [resetWrite])

  return {
    writeContract,
    reset,
    txHash,
    status,
    isBusy: status === 'signing' || status === 'pending',
    isSuccess,
    error: writeError ?? receiptError ?? null,
  }
}
