import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ErrorBoundary } from './ErrorBoundary'

function Bomb({ message = 'kaboom' }: { message?: string }): React.JSX.Element {
  throw new Error(message)
}

describe('ErrorBoundary', () => {
  it('renders children when no error is thrown', () => {
    render(
      <ErrorBoundary>
        <span>alive</span>
      </ErrorBoundary>,
    )
    expect(screen.getByText('alive')).toBeInTheDocument()
  })

  it('renders the default fallback with the error message', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
    render(
      <ErrorBoundary>
        <Bomb message="breakdown" />
      </ErrorBoundary>,
    )
    expect(screen.getByRole('alert')).toBeInTheDocument()
    expect(screen.getByText('breakdown')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /try again/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /reload page/i })).toBeInTheDocument()
    spy.mockRestore()
  })

  it('renders a custom fallback when provided', async () => {
    const user = userEvent.setup()
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
    const reset = vi.fn()
    render(
      <ErrorBoundary fallback={(err, resetFn) => (
        <button
          type="button"
          onClick={() => {
            reset()
            resetFn()
          }}
        >
          custom-{err.message}
        </button>
      )}>
        <Bomb message="x" />
      </ErrorBoundary>,
    )
    const btn = screen.getByRole('button', { name: 'custom-x' })
    await user.click(btn)
    expect(reset).toHaveBeenCalledTimes(1)
    spy.mockRestore()
  })
})
