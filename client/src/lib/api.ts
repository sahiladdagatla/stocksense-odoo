/** Thin fetch wrapper: JWT auth, JSON in/out, and the server's `{ error: { code, message } }` envelope. */

const BASE = (import.meta.env.VITE_API_URL ?? '').replace(/\/$/, '');
const TOKEN_KEY = 'stocksense-token';

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
    public readonly details?: unknown,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

/** "Remember me" keeps the token in localStorage; otherwise it lives only for this browser session. */
export const tokenStore = {
  get(): string | null {
    try {
      return localStorage.getItem(TOKEN_KEY) ?? sessionStorage.getItem(TOKEN_KEY);
    } catch {
      return null;
    }
  },
  set(token: string, remember: boolean) {
    try {
      tokenStore.clear();
      (remember ? localStorage : sessionStorage).setItem(TOKEN_KEY, token);
    } catch {
      /* storage unavailable: token stays in memory via the auth context */
    }
  },
  clear() {
    try {
      localStorage.removeItem(TOKEN_KEY);
      sessionStorage.removeItem(TOKEN_KEY);
    } catch {
      /* ignore */
    }
  },
};

let unauthorizedHandler: (() => void) | null = null;
/** Called when an authenticated request comes back 401 (expired or revoked session). */
export function setUnauthorizedHandler(fn: (() => void) | null) {
  unauthorizedHandler = fn;
}

type Query = Record<string, string | number | boolean | null | undefined | (string | number)[]>;

/** Builds `?a=1&b=2`, skipping empty values. Arrays are joined with commas. */
export function qs(params: Query = {}) {
  const sp = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v === undefined || v === null || v === '') continue;
    sp.set(k, Array.isArray(v) ? v.join(',') : String(v));
  }
  const s = sp.toString();
  return s ? `?${s}` : '';
}

export const apiUrl = (path: string) => `${BASE}/api${path}`;

async function request<T>(method: string, path: string, body?: unknown): Promise<T> {
  const token = tokenStore.get();
  let res: Response;
  try {
    res = await fetch(apiUrl(path), {
      method,
      headers: {
        ...(body !== undefined && { 'Content-Type': 'application/json' }),
        ...(token && { Authorization: `Bearer ${token}` }),
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  } catch {
    throw new ApiError(0, 'NETWORK', 'Cannot reach the server. Check your connection.');
  }

  if (res.status === 204) return undefined as T;
  const data: unknown = await res.json().catch(() => null);
  if (!res.ok) {
    const err = (data as { error?: { code?: string; message?: string; details?: unknown } } | null)
      ?.error;
    const apiError = new ApiError(
      res.status,
      err?.code ?? 'HTTP_ERROR',
      err?.message ?? `Request failed (${res.status})`,
      err?.details,
    );
    if (res.status === 401 && token) unauthorizedHandler?.();
    throw apiError;
  }
  return data as T;
}

export const api = {
  get: <T>(path: string, query?: Query) => request<T>('GET', path + qs(query)),
  post: <T>(path: string, body?: unknown) => request<T>('POST', path, body ?? {}),
  patch: <T>(path: string, body: unknown) => request<T>('PATCH', path, body),
  delete: (path: string) => request<void>('DELETE', path),
  /** Authenticated file download (PDF slip, CSV export) as a Blob. */
  async blob(path: string, query?: Query): Promise<Blob> {
    const token = tokenStore.get();
    const res = await fetch(apiUrl(path + qs(query)), {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
    if (!res.ok) {
      const data = (await res.json().catch(() => null)) as { error?: { message?: string } } | null;
      throw new ApiError(res.status, 'HTTP_ERROR', data?.error?.message ?? 'Download failed');
    }
    return res.blob();
  },
};

/** Human-readable message for any thrown value. */
export function errorMessage(err: unknown) {
  if (err instanceof Error) return err.message;
  return 'Something went wrong';
}
