'use client';

import { Component, type ErrorInfo, type ReactNode } from 'react';

type Props = {
  children: ReactNode;
  fallback?: (error: Error, reset: () => void) => ReactNode;
};

type State = {
  hasError: boolean;
  error: Error | null;
  retryCount: number;
};

/**
 * Global error boundary — catches client-side render errors and displays
 * a friendly message instead of the generic Next.js error overlay.
 *
 * SPECIAL HANDLING for 'removeChild' / NotFoundError:
 * These errors are DOM reconciliation issues (often caused by portals,
 * react-markdown, or browser extensions modifying the DOM). They don't
 * corrupt app state — the virtual DOM and real DOM are just out of sync.
 * A remount fixes it. So we auto-retry up to 3 times before showing
 * the error UI.
 */
export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null, retryCount: 0 };
  }

  static getDerivedStateFromError(error: Error): Partial<State> {
    const isRemoveChildError =
      error.name === 'NotFoundError' ||
      error.message.includes('removeChild') ||
      error.message.includes('not a child of this node');

    // For removeChild errors, return null (no error state) to auto-retry
    // The componentDidCatch will handle the retry logic
    if (isRemoveChildError) {
      return null;
    }

    return { hasError: true, error, retryCount: 0 };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    const isRemoveChildError =
      error.name === 'NotFoundError' ||
      error.message.includes('removeChild') ||
      error.message.includes('not a child of this node');

    if (isRemoveChildError && this.state.retryCount < 3) {
      console.warn('[ErrorBoundary] DOM reconciliation error — auto-retrying', this.state.retryCount + 1);
      this.setState((prev) => ({ hasError: false, error: null, retryCount: prev.retryCount + 1 }));
      return;
    }

    console.error('[ErrorBoundary] caught:', error, errorInfo);
  }

  reset = () => {
    this.setState({ hasError: false, error: null, retryCount: 0 });
  };

  render() {
    if (this.state.hasError && this.state.error) {
      if (this.props.fallback) {
        return this.props.fallback(this.state.error, this.reset);
      }
      return <DefaultErrorFallback error={this.state.error} reset={this.reset} />;
    }
    return this.props.children;
  }
}

function DefaultErrorFallback({ error, reset }: { error: Error; reset: () => void }) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <div className="max-w-md w-full space-y-4">
        <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-6 space-y-3">
          <div className="flex items-center gap-2 text-destructive">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
              <line x1="12" y1="9" x2="12" y2="13" />
              <line x1="12" y1="17" x2="12.01" y2="17" />
            </svg>
            <h2 className="text-sm font-semibold">Algo deu errado</h2>
          </div>
          <p className="text-xs text-muted-foreground">
            Ocorreu um erro ao renderizar a página. Tente recarregar — se persistir,
            limpe o cache do navegador.
          </p>
          <details className="text-[11px] text-muted-foreground">
            <summary className="cursor-pointer hover:text-foreground transition-colors">
              Detalhes do erro
            </summary>
            <pre className="mt-2 p-2 bg-muted rounded text-[10px] overflow-x-auto whitespace-pre-wrap break-all">
              {error.name}: {error.message}
              {error.stack ? `\n\n${error.stack}` : ''}
            </pre>
          </details>
          <div className="flex gap-2">
            <button
              onClick={() => window.location.reload()}
              className="px-3 py-1.5 text-xs font-medium rounded-md bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
            >
              Recarregar página
            </button>
            <button
              onClick={reset}
              className="px-3 py-1.5 text-xs font-medium rounded-md border border-border hover:bg-accent transition-colors"
            >
              Tentar novamente
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
