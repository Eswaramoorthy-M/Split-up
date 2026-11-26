import { Component, ErrorInfo, ReactNode } from 'react'

interface Props {
  children: ReactNode
}

interface State {
  failed: boolean
}

/** Keeps a render error from leaving an installed PWA on a blank white page. */
export class ErrorBoundary extends Component<Props, State> {
  state: State = { failed: false }

  static getDerivedStateFromError(): State {
    return { failed: true }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('App render failed', error, info.componentStack)
  }

  render() {
    if (!this.state.failed) return this.props.children

    return (
      <div className="center-screen" style={{ flexDirection: 'column', gap: 12, padding: 24, textAlign: 'center' }}>
        <h1 style={{ fontSize: 20 }}>Something went wrong</h1>
        <p className="muted">The app couldn’t load this screen. Please reload and try again.</p>
        <button
          type="button"
          className="btn btn-primary"
          onClick={() => window.location.reload()}
        >
          Reload app
        </button>
      </div>
    )
  }
}
