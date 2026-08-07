import { Component, type ErrorInfo, type ReactNode } from 'react';

interface Props {
  children: ReactNode;
}

interface State {
  error: Error | null;
}

/**
 * Application-level error boundary. Per docs/PRODUCT_SPEC.md §18, the app
 * must never leave the user staring at a crashed blank page -- this is the
 * last line of defense for anything that slips past a stage's own error
 * handling (e.g. a Three.js/WebGL exception thrown outside a promise).
 */
export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  override componentDidCatch(error: Error, info: ErrorInfo): void {
    // eslint-disable-next-line no-console
    console.error('Punch Relief Studio crashed:', error, info.componentStack);
  }

  private handleReset = (): void => {
    this.setState({ error: null });
    window.location.reload();
  };

  override render(): ReactNode {
    if (!this.state.error) return this.props.children;
    return (
      <div role="alert" className="error-boundary">
        <h1>Something went wrong</h1>
        <p>
          Punch Relief Studio hit an unexpected error and stopped to avoid showing you a broken
          state. Your model and settings were not sent anywhere -- everything stayed on this device.
        </p>
        <p className="error-boundary__detail">{this.state.error.message}</p>
        <button type="button" onClick={this.handleReset}>
          Reload the app
        </button>
      </div>
    );
  }
}
