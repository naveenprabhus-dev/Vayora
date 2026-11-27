import { Component, type ErrorInfo, type ReactNode } from 'react';
import { AlertBanner, Button, SurfaceCard } from '../components/index.ts';
import { formatSafeUserError } from '../lib/errorMessages.ts';

export interface ErrorBoundaryProps {
  readonly children: ReactNode;
  readonly landmark?: 'section' | 'main' | undefined;
}

interface ErrorBoundaryState {
  readonly hasError: boolean;
  readonly message: string;
  readonly isModuleSkew: boolean;
}

const MODULE_SKEW_RELOAD_KEY = 'vayora.module_skew_reload_at';
const MODULE_SKEW_COOLDOWN_MS = 10_000;

function isModuleSkewError(error: Error): boolean {
  const msg = error.message ?? '';
  return (
    msg.includes("reading 'useState'") ||
    msg.includes("reading 'useEffect'") ||
    msg.includes("reading 'useRef'") ||
    msg.includes("reading 'useContext'") ||
    msg.includes('Invalid hook call') ||
    msg.includes('Failed to fetch dynamically imported module') ||
    msg.includes('Importing a module script failed') ||
    msg.includes('does not provide an export named')
  );
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  public override state: ErrorBoundaryState = {
    hasError: false,
    message: '',
    isModuleSkew: false,
  };

  public static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    const isModuleSkew = isModuleSkewError(error);
    return {
      hasError: true,
      message: isModuleSkew
        ? 'Application modules fell out of sync after an update. Reloading restores a consistent session.'
        : formatSafeUserError(error, 'An unexpected rendering error occurred.'),
      isModuleSkew,
    };
  }

  public override componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    if (import.meta.env.DEV && import.meta.env.MODE !== 'production') {
      console.error(
        'Unhandled UI error:',
        formatSafeUserError(error, 'An unexpected rendering error occurred.'),
        errorInfo.componentStack,
      );
    } else {
      console.error('Unhandled UI error:', error.name || 'Error');
    }
    if (isModuleSkewError(error) && typeof window !== 'undefined') {
      try {
        const lastReloadRaw = window.sessionStorage.getItem(MODULE_SKEW_RELOAD_KEY);
        const lastReload = lastReloadRaw ? Number(lastReloadRaw) : 0;
        const now = Date.now();
        if (!Number.isFinite(lastReload) || now - lastReload > MODULE_SKEW_COOLDOWN_MS) {
          window.sessionStorage.setItem(MODULE_SKEW_RELOAD_KEY, String(now));
          window.location.reload();
        }
      } catch {
        // Ignore sessionStorage restrictions; fallback Reload Page button remains available.
      }
    }
  }

  private handleReset = (): void => {
    if (this.state.isModuleSkew && typeof window !== 'undefined') {
      window.location.reload();
      return;
    }
    this.setState({ hasError: false, message: '', isModuleSkew: false });
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
              {this.state.isModuleSkew ? 'Reload Page' : 'Retry View'}
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
