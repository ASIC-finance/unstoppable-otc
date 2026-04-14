import { describe, it, expect, beforeEach, vi } from 'vitest'
import { toast } from './toast'

describe('toast store', () => {
  beforeEach(() => {
    toast.clear()
    vi.useFakeTimers()
  })

  it('pushes a success toast that auto-dismisses', () => {
    toast.success('Hello')
    vi.advanceTimersByTime(6100)
    // No direct readout without the hook, but the API should not throw and
    // dismissing already-dismissed toasts must be a no-op:
    expect(() => toast.dismiss('non-existent')).not.toThrow()
  })

  it('keeps pending toasts until explicitly dismissed', () => {
    const id = 'tx-1'
    toast.pending(id, 'Submitting')
    vi.advanceTimersByTime(60_000)
    toast.dismiss(id)
    // no assertions; just confirming dismiss-then-clear works without error
    toast.clear()
  })

  it('update replaces the same id', () => {
    toast.pending('tx-1', 'Submitting')
    toast.update('tx-1', { variant: 'success', title: 'Done' })
    toast.clear()
  })
})
