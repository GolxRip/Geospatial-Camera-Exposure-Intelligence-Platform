import createClient, { type Middleware } from 'openapi-fetch';
import type { z } from 'zod';
import type { paths } from './schema';
import { env } from '@/lib/env';
import { ApiError, detailFromBody } from './errors';

/**
 * Typed client generated from the FastAPI schema (`npm run gen:api`).
 *
 * Only POST /api/detection-event declares a response model in the backend, so every other response
 * body arrives untyped from openapi-fetch. Each consumer validates its body with a zod schema
 * (src/lib/api/normalize.ts, added with the data layer in Phase 4) instead of trusting a cast.
 * Adding `response_model` to the routes (backend touchpoints B3 and B4) would remove that duty; it is not approved.
 *
 * Never wire GET /api/devices/{id}/heartbeat or /api/heartbeat/*: they open connections to device
 * addresses, which breaks the passive-only boundary (claim C15, backend touchpoint B2).
 */
const REQUEST_TIMEOUT_MS = 10_000;

/** A request that outlives the timeout rejects with a TimeoutError, which classifyError maps to "offline". */
const timeoutFetch: typeof fetch = (input, init) => {
  const timeout = AbortSignal.timeout(REQUEST_TIMEOUT_MS);
  const caller = input instanceof Request ? input.signal : init?.signal;
  const signal = caller ? AbortSignal.any([caller, timeout]) : timeout;
  return fetch(input, { ...init, signal });
};

/** Turns every non-2xx response into an ApiError carrying the backend's own `detail`. */
const errorMiddleware: Middleware = {
  async onResponse({ response }) {
    if (response.ok) return undefined;
    let body: unknown;
    try {
      body = await response.clone().json();
    } catch {
      body = undefined;
    }
    throw new ApiError(response.status, detailFromBody(body, response.statusText), response.url);
  },
};

export const api = createClient<paths>({ baseUrl: env.apiUrl, fetch: timeoutFetch });
api.use(errorMiddleware);

/** WebSocket endpoint derived from the REST base URL. */
export function alertsSocketUrl(): string {
  const url = new URL('/api/ws/alerts', env.apiUrl);
  url.protocol = url.protocol === 'https:' ? 'wss:' : 'ws:';
  return url.toString();
}

/**
 * GET/POST helper for endpoints whose responses OpenAPI does not describe (most of this backend's
 * routes return bare dicts). The zod schema is the contract; a mismatch is a loud ApiError.
 */
export async function fetchJson<S extends z.ZodType>(
  path: string,
  schema: S,
  init?: RequestInit,
): Promise<z.infer<S>> {
  const res = await timeoutFetch(`${env.apiUrl}${path}`, init);
  if (!res.ok) {
    let body: unknown;
    try {
      body = await res.json();
    } catch {
      body = undefined;
    }
    throw new ApiError(res.status, detailFromBody(body, res.statusText || 'Request failed'), res.url);
  }
  const json: unknown = await res.json();
  const parsed = schema.safeParse(json);
  if (!parsed.success) {
    throw new ApiError(502, `Unexpected response shape from ${path}: ${parsed.error.issues[0]?.message ?? 'invalid'}`, path);
  }
  return parsed.data;
}
