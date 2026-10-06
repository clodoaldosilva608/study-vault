'use client';

/**
 * Next.js global error handler — catches errors that happen OUTSIDE the
 * React tree (e.g., in the root layout, in service worker registration,
 * during chunk loading). Replaces the generic Next.js error page.
 */

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  console.error('[GlobalError]', error);

  return (
    <html lang="pt-BR">
      <body
        style={{
          margin: 0,
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: '#0a0b0d',
          color: '#e6e6e6',
          fontFamily: 'system-ui, -apple-system, sans-serif',
          padding: '1rem',
        }}
      >
        <div style={{ maxWidth: '480px', width: '100%' }}>
          <div
            style={{
              border: '1px solid rgba(239, 68, 68, 0.3)',
              background: 'rgba(239, 68, 68, 0.05)',
              borderRadius: '0.5rem',
              padding: '1.5rem',
            }}
          >
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
                color: '#ef4444',
                marginBottom: '0.75rem',
              }}
            >
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
              <h2 style={{ fontSize: '0.875rem', fontWeight: 600, margin: 0 }}>
                Erro de aplicação
              </h2>
            </div>
            <p
              style={{
                fontSize: '0.75rem',
                color: '#999',
                marginBottom: '0.75rem',
                lineHeight: 1.5,
              }}
            >
              Ocorreu uma exceção no lado do cliente ao carregar a aplicação.
              Tente recarregar a página. Se o erro persistir, limpe o cache e
              os cookies do navegador.
            </p>
            <details
              style={{
                fontSize: '0.6875rem',
                color: '#999',
                marginBottom: '0.75rem',
              }}
            >
              <summary
                style={{
                  cursor: 'pointer',
                  color: '#999',
                }}
              >
                Detalhes do erro
              </summary>
              <pre
                style={{
                  marginTop: '0.5rem',
                  padding: '0.5rem',
                  background: 'rgba(255,255,255,0.05)',
                  borderRadius: '0.25rem',
                  fontSize: '0.625rem',
                  overflow: 'auto',
                  whiteSpace: 'pre-wrap',
                  wordBreak: 'break-all',
                }}
              >
                {error.name}: {error.message}
                {error.digest ? `\n\ndigest: ${error.digest}` : ''}
                {error.stack ? `\n\n${error.stack}` : ''}
              </pre>
            </details>
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <button
                onClick={() => window.location.reload()}
                style={{
                  padding: '0.375rem 0.75rem',
                  fontSize: '0.75rem',
                  fontWeight: 500,
                  borderRadius: '0.375rem',
                  background: '#10b981',
                  color: '#0a0b0d',
                  border: 'none',
                  cursor: 'pointer',
                }}
              >
                Recarregar página
              </button>
              <button
                onClick={reset}
                style={{
                  padding: '0.375rem 0.75rem',
                  fontSize: '0.75rem',
                  fontWeight: 500,
                  borderRadius: '0.375rem',
                  background: 'transparent',
                  color: '#999',
                  border: '1px solid #333',
                  cursor: 'pointer',
                }}
              >
                Tentar novamente
              </button>
            </div>
          </div>
        </div>
      </body>
    </html>
  );
}
