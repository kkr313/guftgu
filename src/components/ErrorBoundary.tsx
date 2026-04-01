import React from 'react';

interface Props {
  children: React.ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

/**
 * Global error boundary — catches any unhandled render error and shows
 * a recovery screen instead of a blank white page.
 */
export default class ErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo): void {
    console.error('[ErrorBoundary] Uncaught error:', error, info.componentStack);
  }

  handleReload = () => {
    window.location.reload();
  };

  handleReset = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError) {
      return (
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            minHeight: '100vh',
            padding: 24,
            background: '#0A0B10',
            color: '#fff',
            textAlign: 'center',
            fontFamily: 'system-ui, -apple-system, sans-serif',
          }}
        >
          <div style={{ fontSize: 48, marginBottom: 16 }}>😵</div>
          <h2 style={{ margin: '0 0 8px', fontSize: 20, fontWeight: 600 }}>
            Something went wrong
          </h2>
          <p style={{ margin: '0 0 24px', fontSize: 14, color: '#999', maxWidth: 320 }}>
            Guftgu ran into an unexpected error. Try refreshing the page.
          </p>
          {this.state.error && (
            <pre
              style={{
                margin: '0 0 24px',
                padding: 12,
                borderRadius: 8,
                background: '#1a1b24',
                color: '#ff6b6b',
                fontSize: 12,
                maxWidth: '90vw',
                overflow: 'auto',
                whiteSpace: 'pre-wrap',
                wordBreak: 'break-word',
              }}
            >
              {this.state.error.message}
            </pre>
          )}
          <div style={{ display: 'flex', gap: 12 }}>
            <button
              onClick={this.handleReset}
              style={{
                padding: '10px 24px',
                borderRadius: 20,
                border: '1px solid #333',
                background: 'transparent',
                color: '#fff',
                cursor: 'pointer',
                fontSize: 14,
              }}
            >
              Try Again
            </button>
            <button
              onClick={this.handleReload}
              style={{
                padding: '10px 24px',
                borderRadius: 20,
                border: 'none',
                background: '#6C63FF',
                color: '#fff',
                cursor: 'pointer',
                fontSize: 14,
              }}
            >
              Reload App
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
