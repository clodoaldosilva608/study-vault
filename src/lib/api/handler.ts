import { NextResponse } from 'next/server';
import { ZodError, ZodSchema } from 'zod';
import { DomainError, Errors, toHttpError } from '@/lib/domain/errors';

/**
 * Run an async handler with standardized error handling and JSON envelope:
 *   { ok: true, data: ... } | { ok: false, error: { code, message, details } }
 */
export async function apiHandler<T>(
  handler: () => Promise<T>,
  opts: { status?: number } = {},
): Promise<NextResponse> {
  try {
    const data = await handler();
    return NextResponse.json({ ok: true, data }, { status: opts.status ?? 200 });
  } catch (err) {
    if (err instanceof ZodError) {
      return NextResponse.json(
        {
          ok: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Invalid request payload',
            details: err.flatten(),
          },
        },
        { status: 422 },
      );
    }
    const { statusCode, body } = toHttpError(err);
    return NextResponse.json({ ok: false, ...body }, { status: statusCode });
  }
}

export function validate<T>(schema: ZodSchema<T>, data: unknown): T {
  return schema.parse(data);
}

export function paginated<T>(items: T[], total: number, page: number, pageSize: number) {
  return {
    items,
    total,
    page,
    pageSize,
    totalPages: Math.max(1, Math.ceil(total / pageSize)),
  };
}

export { DomainError, Errors };
