import { Component, type ErrorInfo, type ReactNode } from 'react'

interface Props { children: ReactNode }
interface State { hasError: boolean; message: string }

export default class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, message: '' }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, message: error.message ?? 'An unexpected error occurred.' }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('[OlympIQ] ErrorBoundary caught:', error, info.componentStack)
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{ padding: '48px 24px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16, textAlign: 'center' }}>
          <div className="oq-panel" style={{ padding: '32px 28px', maxWidth: 480, width: '100%', gap: 14, alignItems: 'center', textAlign: 'center' }}>
            <div style={{ fontSize: 28, color: 'var(--err)' }}>⚠</div>
            <div style={{ fontSize: 15, fontWeight: 700 }}>Something went wrong</div>
            <div style={{ fontSize: 13, color: 'var(--text-dim)', fontFamily: 'var(--font-mono)', wordBreak: 'break-word' }}>
              {this.state.message}
            </div>
            <button
              className="oq-btn-primary"
              style={{ marginTop: 8 }}
              onClick={() => window.location.reload()}
            >
              Reload the page
            </button>
          </div>
        </div>
      )
    }
    return this.props.children
  }
}
