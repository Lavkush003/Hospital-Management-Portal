import { env } from '@/utils/env';

export interface ApiError extends Error {
  status: number;
  code: string;
  requestId?: string;
  details?: Array<{ path?: string; message: string }>;
}

export type QueryValue = string | number | boolean | null | undefined;

let accessToken: string | null = null;
let refreshPromise: Promise<boolean> | null = null;
let onUnauthorized: (() => void) | null = null;

export function setAccessToken(token: string | null): void {
  accessToken = token;
}

export function setUnauthorizedHandler(handler: (() => void) | null): void {
  onUnauthorized = handler;
}

export function readCsrfCookie(): string | undefined {
  const value = document.cookie
    .split('; ')
    .find((cookie) => cookie.startsWith('hms_csrf_token='))
    ?.slice('hms_csrf_token='.length);

  return value ? decodeURIComponent(value) : undefined;
}

export function apiUrl(path: string): string {
  const base = env.VITE_API_BASE_URL.replace(/\/+$/, '');
  if (!path) return base;
  return `${base}${path.startsWith('/') ? path : `/${path}`}`;
}

export function toQuery(params: Record<string, QueryValue>): string {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null || value === '') continue;
    search.set(key, String(value));
  }
  const query = search.toString();
  return query ? `?${query}` : '';
}

export function newIdempotencyKey(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(36).slice(2, 12)}`;
}

function apiError(response: Response, body: unknown): ApiError {
  const data = body as {
    error?: {
      code?: string;
      message?: string;
      requestId?: string;
      details?: ApiError['details'];
    };
  };
  const error = new Error(
    data.error?.message ?? `Request failed (${response.status})`,
  ) as ApiError;
  error.status = response.status;
  error.code = data.error?.code ?? 'REQUEST_FAILED';
  error.requestId = data.error?.requestId;
  error.details = data.error?.details;
  return error;
}

async function refreshAccessToken(): Promise<boolean> {
  if (!refreshPromise) {
    refreshPromise = (async () => {
      const csrfToken = readCsrfCookie();
      if (!csrfToken) return false;

      try {
        const response = await fetch(apiUrl('/auth/refresh'), {
          method: 'POST',
          credentials: 'include',
          headers: { 'X-CSRF-Token': csrfToken },
        });

        if (!response.ok) return false;

        const session = (await response.json()) as { accessToken: string };
        accessToken = session.accessToken;
        return true;
      } catch {
        return false;
      } finally {
        refreshPromise = null;
      }
    })();
  }

  return refreshPromise;
}

export async function apiRequest<T>(
  path: string,
  options: RequestInit = {},
  retry = true,
): Promise<T> {
  const headers = new Headers(options.headers);
  if (options.body && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }
  if (accessToken) headers.set('Authorization', `Bearer ${accessToken}`);

  const response = await fetch(apiUrl(path), {
    ...options,
    headers,
    credentials: 'include',
  });

  if (response.status === 401 && retry && (await refreshAccessToken())) {
    return apiRequest<T>(path, options, false);
  }

  if (response.status === 401) {
    accessToken = null;
    onUnauthorized?.();
  }

  if (response.status === 204) return undefined as T;

  const body: unknown = await response.json().catch(() => undefined);
  if (!response.ok) throw apiError(response, body);
  return body as T;
}

export function apiGet<T>(path: string): Promise<T> {
  return apiRequest<T>(path);
}

export function apiMutate<T>(
  path: string,
  method: 'POST' | 'PATCH' | 'DELETE' | 'PUT',
  body?: unknown,
  idempotencyKey?: string,
): Promise<T> {
  const headers = new Headers();
  if (idempotencyKey) headers.set('Idempotency-Key', idempotencyKey);

  return apiRequest<T>(path, {
    method,
    headers,
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
}

export function errorMessage(error: unknown): string {
  if (error && typeof error === 'object' && 'message' in error) {
    const message = (error as { message?: unknown }).message;
    if (typeof message === 'string' && message.trim()) return message;
  }
  return 'Something went wrong. Please try again.';
}

export function fieldErrors(error: unknown): Record<string, string> {
  if (!error || typeof error !== 'object' || !('details' in error)) return {};
  const details = (error as { details?: Array<{ path?: string; message: string }> }).details;
  if (!Array.isArray(details)) return {};

  return details.reduce<Record<string, string>>((accumulator, detail) => {
    if (detail.path) accumulator[detail.path] = detail.message;
    return accumulator;
  }, {});
}
