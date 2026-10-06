// Centralized typed error hierarchy for the Study Vault domain.
// APIs map these to HTTP status codes via `toHttpError`.

export type ErrorCode =
  | 'UNAUTHORIZED'
  | 'FORBIDDEN'
  | 'NOT_FOUND'
  | 'VALIDATION_ERROR'
  | 'CONFLICT'
  | 'QUOTA_EXCEEDED'
  | 'RATE_LIMITED'
  | 'INTERNAL'
  | 'BAD_REQUEST';

export class DomainError extends Error {
  code: ErrorCode;
  statusCode: number;
  details?: Record<string, unknown>;

  constructor(
    code: ErrorCode,
    message: string,
    statusCode: number,
    details?: Record<string, unknown>,
  ) {
    super(message);
    this.code = code;
    this.statusCode = statusCode;
    this.details = details;
    this.name = this.constructor.name;
  }
}

export const Errors = {
  unauthorized: (msg = 'Unauthorized') =>
    new DomainError('UNAUTHORIZED', msg, 401),
  forbidden: (msg = 'Forbidden') => new DomainError('FORBIDDEN', msg, 403),
  notFound: (resource: string) =>
    new DomainError('NOT_FOUND', `${resource} not found`, 404),
  validation: (msg: string, details?: Record<string, unknown>) =>
    new DomainError('VALIDATION_ERROR', msg, 422, details),
  conflict: (msg: string) => new DomainError('CONFLICT', msg, 409),
  quotaExceeded: (msg = 'Storage quota exceeded') =>
    new DomainError('QUOTA_EXCEEDED', msg, 422),
  rateLimited: (msg = 'Too many requests') =>
    new DomainError('RATE_LIMITED', msg, 429),
  internal: (msg = 'Internal server error') =>
    new DomainError('INTERNAL', msg, 500),
  badRequest: (msg = 'Bad request') =>
    new DomainError('BAD_REQUEST', msg, 400),
};

export function toHttpError(err: unknown): {
  statusCode: number;
  body: { error: { code: string; message: string; details?: unknown } };
} {
  if (err instanceof DomainError) {
    return {
      statusCode: err.statusCode,
      body: {
        error: {
          code: err.code,
          message: err.message,
          details: err.details,
        },
      },
    };
  }
  console.error('[unhandled-error]', err);
  return {
    statusCode: 500,
    body: {
      error: {
        code: 'INTERNAL',
        message: 'Internal server error',
      },
    },
  };
}
