/**
 * Typed API failures. `detail` is the backend's own message, shown verbatim to the user
 * (FRONTEND_SPEC.md sections 10.3 and 12: 403, 404 and 409 are never paraphrased).
 */
export class ApiError extends Error {
  readonly status: number;
  readonly detail: string;
  readonly url: string;

  constructor(status: number, detail: string, url: string) {
    super(`HTTP ${status}: ${detail}`);
    this.name = 'ApiError';
    this.status = status;
    this.detail = detail;
    this.url = url;
  }
}

export type FailureKind =
  'offline' | 'forbidden' | 'not_found' | 'conflict' | 'rate_limited' | 'server' | 'unknown';

/** Maps a thrown value to the state the UI should show. A network failure means the backend is offline. */
export function classifyError(err: unknown): FailureKind {
  if (err instanceof ApiError) {
    if (err.status === 403) return 'forbidden';
    if (err.status === 404) return 'not_found';
    if (err.status === 409) return 'conflict';
    if (err.status === 429) return 'rate_limited';
    if (err.status >= 500) return 'server';
    return 'unknown';
  }
  if (err instanceof TypeError || (err instanceof DOMException && err.name === 'TimeoutError')) {
    return 'offline';
  }
  return 'unknown';
}

/** FastAPI sends `detail` as a string or, for validation errors, a list of objects. */
export function detailFromBody(body: unknown, fallback: string): string {
  if (body && typeof body === 'object' && 'detail' in body) {
    const detail = (body as { detail: unknown }).detail;
    if (typeof detail === 'string') return detail;
    if (detail !== undefined && detail !== null) return JSON.stringify(detail);
  }
  return fallback;
}

/** Alias for backward compatibility with hooks that import `detailFrom`. */
export const detailFrom = detailFromBody;
