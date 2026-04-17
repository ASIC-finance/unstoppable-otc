import { BaseError, ContractFunctionRevertedError, UserRejectedRequestError } from 'viem'

export type ParsedTxError = {
  /** Short human-readable label, safe to surface in UI. */
  title: string
  /** One-line explanation — often the decoded revert reason or provider message. */
  message: string
  /** Custom-error name when the contract reverted with one of our defined errors. */
  errorName?: string
  /** True when the user dismissed the wallet prompt — don't toast this as an error. */
  userRejected: boolean
}

/**
 * Translate an unknown error (thrown by wagmi/viem write/simulate) into a
 * presentable shape. Uses viem's walk() to find the underlying revert or
 * user-rejection cause when the error is wrapped.
 */
export function parseContractError(error: unknown): ParsedTxError {
  if (!error) {
    return { title: 'Unknown error', message: 'Something went wrong.', userRejected: false }
  }

  if (error instanceof BaseError) {
    const rejected = error.walk(err => err instanceof UserRejectedRequestError)
    if (rejected) {
      return {
        title: 'Rejected in wallet',
        message: 'Transaction was dismissed.',
        userRejected: true,
      }
    }

    const reverted = error.walk(err => err instanceof ContractFunctionRevertedError)
    if (reverted instanceof ContractFunctionRevertedError) {
      const name = reverted.data?.errorName ?? reverted.reason
      return {
        title: 'Transaction reverted',
        message: humanizeContractError(name) ?? reverted.shortMessage,
        errorName: name,
        userRejected: false,
      }
    }

    return {
      title: 'Transaction failed',
      message: error.shortMessage || error.message,
      userRejected: false,
    }
  }

  if (error instanceof Error) {
    return { title: 'Transaction failed', message: error.message, userRejected: false }
  }

  return { title: 'Transaction failed', message: String(error), userRejected: false }
}

/**
 * Map known custom errors from OTCPair / OTCFactory / ERC20 onto friendly copy.
 * Unknown error names return undefined — caller falls back to viem's shortMessage.
 */
function humanizeContractError(name: string | undefined): string | undefined {
  if (!name) return undefined
  switch (name) {
    // ── OTCPair ────────────────────────────────────────────────
    case 'ZeroAmount':
      return 'Amount cannot be zero.'
    case 'ExceedsRemaining':
      return 'That is more than the remaining size of this order.'
    case 'ExceedsMaxBuy':
      return 'Price moved — filling would cost more buy-token than your cap allows.'
    case 'OrderNotActive':
      return 'This order is already filled or cancelled.'
    case 'NotMaker':
      return 'Only the order maker can cancel this order.'
    case 'InvalidActiveIndex':
      return 'Pair state inconsistency — refresh and try again.'
    case 'InvalidMinBuyBps':
      return 'Slippage tolerance must be between 1 and 10000 basis points.'
    case 'SlippageExceeded':
      return 'Maker short-received due to fee-on-transfer; this order needs a higher slippage tolerance to fill.'
    case 'ReentrancyGuardReentrantCall':
      return 'Blocked: the call re-entered the pair.'
    // ── OTCFactory ─────────────────────────────────────────────
    case 'IdenticalTokens':
      return 'Cannot create a pair for the same token.'
    case 'PairExists':
      return 'A pair already exists for these tokens.'
    case 'NotAContract':
      return 'At least one of the addresses has no contract code — must be a deployed ERC-20.'
    // ── Shared ─────────────────────────────────────────────────
    case 'ZeroAddress':
      return 'Recipient cannot be the zero address.'
    // ── ERC-20 ─────────────────────────────────────────────────
    case 'ERC20InsufficientBalance':
      return 'Insufficient token balance.'
    case 'ERC20InsufficientAllowance':
      return 'Insufficient approval — approve the pair to spend this token first.'
    case 'SafeERC20FailedOperation':
      return 'Token transfer failed — the token returned false or reverted.'
    default:
      return undefined
  }
}
