import { Component, type ErrorInfo, type ReactNode } from 'react'

type Props = {
  children: ReactNode
  fallback?: (error: Error, reset: () => void) => ReactNode
}

type State = { error: Error | null }

/**
 * Catches render-path errors and prevents the whole app from blanking.
 * Intentionally a class component — React still requires `componentDidCatch`
 * for this behaviour, and there is no hook equivalent.
 */
export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null }

  static getDerivedStateFromError(error: Error): State {
    return { error }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    // Surface to the console with React's component stack — swap for a
    // proper error reporter (Sentry, etc.) when one is wired in.
    console.error('ErrorBoundary caught:', error, info.componentStack)
  }

  private reset = () => this.setState({ error: null })

  render() {
    const { error } = this.state
    if (!error) return this.props.children
    if (this.props.fallback) return this.props.fallback(error, this.reset)

    return (
      <div role="alert" className="workspace-header" style={{ gridTemplateColumns: '1fr' }}>
        <div>
          <p className="eyebrow">Something went wrong</p>
          <h1 className="workspace-title">The interface hit an unexpected error.</h1>
          <p className="workspace-copy">
            {error.message || 'Reload the page or reconnect your wallet to try again.'}
          </p>
          <div className="workspace-meta" style={{ marginTop: '1rem', justifyContent: 'flex-start' }}>
            <button type="button" onClick={this.reset} className="primary-button">
              Try again
            </button>
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="ghost-button"
            >
              Reload page
            </button>
          </div>
        </div>
      </div>
    )
  }
}
