import { Component, type ErrorInfo, type ReactNode } from 'react';
import { AlertBanner, Button, SurfaceCard } from '../components/index.ts';

export interface ErrorBoundaryProps {
  readonly children: ReactNode;
  readonly landmark?: 'section' | 'main' | undefined;
}

interface ErrorBoundaryState {
  readonly hasError: boolean;
  readonly message: string;
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  public override state: ErrorBoundaryState = {
    hasError: false,
    message: '',
  };

  public static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return {
      hasError: true,
      message: error.message || 'An unexpected rendering error occurred.',
    };
  }

  public override componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    console.error('Unhandled UI error:', error.message, errorInfo.componentStack);
  }

  private handleReset = (): void => {
    this.setState({ hasError: false, message: '' });
  };

  public override render(): ReactNode {
    if (this.state.hasError) {
      const content = (
        <SurfaceCard>
          <AlertBanner tone="error" title="Application Boundary Triggered">
            <p>{this.state.message}</p>
          </AlertBanner>
          <div className="mt-4">
            <Button variant="secondary" onClick={this.handleReset}>
              Retry View
            </Button>
          </div>
        </SurfaceCard>
      );

      if (this.props.landmark === 'main') {
        return (
          <main
            id="main-content"
            tabIndex={-1}
            className="mx-auto max-w-2xl px-6 py-16 focus:outline-none"
          >
            {content}
          </main>
        );
      }

      return (
        <section aria-label="Application recovery" className="mx-auto max-w-2xl px-6 py-16">
          {content}
        </section>
      );
    }

    return this.props.children;
  }
}
