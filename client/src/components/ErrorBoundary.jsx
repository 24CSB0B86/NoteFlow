import { Component } from 'react'

/**
 * ErrorBoundary — Catches React render errors and shows a friendly fallback.
 * Wrap top-level routes or heavy components to prevent blank screens.
 */
export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props)
    this.state = { hasError: false, error: null, info: null }
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error }
  }

  componentDidCatch(error, info) {
    this.setState({ info })
    // Log to console (and Sentry if configured)
    console.error('[ErrorBoundary] Uncaught error:', error, info?.componentStack)
    if (window.__SENTRY__) {
      try { window.__SENTRY__.captureException(error) } catch (_) {}
    }
  }

  reset = () => this.setState({ hasError: false, error: null, info: null })

  render() {
    if (!this.state.hasError) return this.props.children

    return (
      <div style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexDirection: 'column',
        gap: '16px',
        padding: '32px',
        background: 'var(--background, #0f0f1e)',
        color: 'var(--foreground, #fff)',
        textAlign: 'center',
      }}>
        <div style={{ fontSize: '64px' }}>💥</div>
        <h2 style={{ margin: 0, fontSize: '22px', fontWeight: 700 }}>Something went wrong</h2>
        <p style={{ margin: 0, color: 'rgba(255,255,255,0.55)', maxWidth: '400px', lineHeight: 1.6 }}>
          NoteFlow encountered an unexpected error. Your data is safe — refresh the page to try again.
        </p>
        {this.state.error && (
          <pre style={{
            background: 'rgba(255,255,255,0.05)',
            border: '1px solid rgba(255,255,255,0.1)',
            borderRadius: '8px',
            padding: '12px 16px',
            fontSize: '11px',
            color: 'rgba(255,80,80,0.9)',
            maxWidth: '480px',
            overflowX: 'auto',
            textAlign: 'left',
            margin: 0,
          }}>
            {this.state.error.message}
          </pre>
        )}
        <div style={{ display: 'flex', gap: '10px', marginTop: '8px' }}>
          <button
            onClick={this.reset}
            style={{
              padding: '10px 20px', borderRadius: '10px', border: 'none',
              background: 'linear-gradient(135deg, #6366f1, #8b5cf6)', color: 'white',
              fontWeight: 600, cursor: 'pointer', fontSize: '14px',
            }}
          >
            Try Again
          </button>
          <button
            onClick={() => window.location.href = '/dashboard'}
            style={{
              padding: '10px 20px', borderRadius: '10px', border: '1px solid rgba(255,255,255,0.15)',
              background: 'rgba(255,255,255,0.05)', color: 'white',
              fontWeight: 600, cursor: 'pointer', fontSize: '14px',
            }}
          >
            Go to Dashboard
          </button>
        </div>
      </div>
    )
  }
}
