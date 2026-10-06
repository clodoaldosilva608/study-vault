/**
 * Typed fetch wrapper for the Study Vault API v1.
 * All endpoints return `{ ok: true, data }` on success or
 * `{ ok: false, error: { code, message, details } }` on failure.
 */

export type ApiEnvelope<T> =
  | { ok: true; data: T }
  | { ok: false; error: { code: string; message: string; details?: unknown } };

export class ApiError extends Error {
  code: string;
  status: number;
  details?: unknown;
  constructor(code: string, message: string, status: number, details?: unknown) {
    super(message);
    this.code = code;
    this.status = status;
    this.details = details;
  }
}

async function request<T>(
  path: string,
  init?: RequestInit & { json?: unknown },
): Promise<T> {
  const headers: Record<string, string> = {
    ...(init?.headers as Record<string, string>),
  };
  let body = init?.body;
  if (init?.json !== undefined) {
    headers['content-type'] = 'application/json';
    body = JSON.stringify(init.json);
  }
  const res = await fetch(path, {
    ...init,
    headers,
    body,
    credentials: 'include',
  });
  let parsed: ApiEnvelope<T> | null = null;
  try {
    parsed = (await res.json()) as ApiEnvelope<T>;
  } catch {
    if (!res.ok) {
      throw new ApiError('NETWORK', `Request failed (${res.status})`, res.status);
    }
    return {} as T;
  }
  if (!parsed) {
    throw new ApiError('NETWORK', 'Empty response', res.status);
  }
  if (!parsed.ok) {
    throw new ApiError(
      parsed.error.code,
      parsed.error.message,
      res.status,
      parsed.error.details,
    );
  }
  return parsed.data;
}

export const api = {
  get: <T>(path: string, init?: RequestInit) =>
    request<T>(path, { ...init, method: 'GET' }),
  post: <T>(path: string, json?: unknown, init?: RequestInit) =>
    request<T>(path, { ...init, method: 'POST', json }),
  patch: <T>(path: string, json?: unknown, init?: RequestInit) =>
    request<T>(path, { ...init, method: 'PATCH', json }),
  put: <T>(path: string, json?: unknown, init?: RequestInit) =>
    request<T>(path, { ...init, method: 'PUT', json }),
  delete: <T>(path: string, init?: RequestInit) =>
    request<T>(path, { ...init, method: 'DELETE' }),
};
