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
    case 'ZeroAmount':
      return 'Amount cannot be zero.'
    case 'ZeroCost':
      return 'This fill would round to zero — try a larger amount.'
    case 'ExceedsRemaining':
      return 'That is more than the remaining size of this order.'
    case 'OrderNotActive':
      return 'This order is already filled or cancelled.'
    case 'NotMaker':
      return 'Only the order maker can cancel this order.'
    case 'ZeroAddress':
      return 'Recipient cannot be the zero address.'
    case 'InvalidActiveIndex':
      return 'Pair state inconsistency — refresh and try again.'
    case 'IdenticalTokens':
      return 'Cannot create a pair for the same token.'
    case 'PairExists':
      return 'A pair already exists for these tokens.'
    case 'ERC20InsufficientBalance':
      return 'Insufficient token balance.'
    case 'ERC20InsufficientAllowance':
      return 'Insufficient approval — approve the pair to spend this token first.'
    default:
      return undefined
  }
}
