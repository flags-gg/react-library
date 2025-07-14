import React, { Component, ErrorInfo, ReactNode } from 'react';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
  resetKeys?: Array<string | number>;
  isolate?: boolean;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    const { onError } = this.props;
    
    if (onError) {
      onError(error, errorInfo);
    } else {
      console.error('Flags.gg ErrorBoundary caught an error:', error, errorInfo);
    }
  }

  componentDidUpdate(prevProps: Props) {
    const { resetKeys } = this.props;
    const { hasError } = this.state;
    
    if (hasError && prevProps.resetKeys !== resetKeys) {
      this.setState({ hasError: false, error: null });
    }
  }

  render() {
    const { hasError, error } = this.state;
    const { children, fallback, isolate } = this.props;

    if (hasError) {
      if (fallback) {
        return <>{fallback}</>;
      }

      if (isolate) {
        return null;
      }

      return (
        <div style={{ padding: '20px', textAlign: 'center' }}>
          <h3>Something went wrong with the feature flags</h3>
          <p>The application will continue with default behavior.</p>
          {process.env.NODE_ENV === 'development' && error && (
            <details style={{ marginTop: '10px', textAlign: 'left' }}>
              <summary>Error details</summary>
              <pre style={{ overflow: 'auto' }}>{error.toString()}</pre>
            </details>
          )}
        </div>
      );
    }

    return children;
  }
}

export function withErrorBoundary<P extends object>(
  Component: React.ComponentType<P>,
  errorBoundaryProps?: Omit<Props, 'children'>
) {
  const WrappedComponent = (props: P) => (
    <ErrorBoundary {...errorBoundaryProps}>
      <Component {...props} />
    </ErrorBoundary>
  );

  WrappedComponent.displayName = `withErrorBoundary(${Component.displayName || Component.name})`;

  return WrappedComponent;
}