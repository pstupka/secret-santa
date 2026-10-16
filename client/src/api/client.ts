import type { CreateEventInput, Event, Person } from './types';

// What went wrong, independent of the server's (English) error text. Views
// show `errors.<kind>` from the message catalog.
export type ApiErrorKind =
  | 'validation'
  | 'unauthorized'
  | 'forbidden'
  | 'notFound'
  | 'conflict'
  | 'unprocessable'
  | 'rateLimited'
  | 'server'
  | 'network';

export class ApiError extends Error {
  readonly name = 'ApiError';

  constructor(
    readonly kind: ApiErrorKind,
    // HTTP status; 0 when the server could not be reached.
    readonly status: number,
    message: string,
    // From `Retry-After` on `429`.
    readonly retryAfterSeconds: number | null = null,
  ) {
    super(message);
  }
}

export const isApiError = (error: unknown): error is ApiError =>
  error instanceof ApiError;

const kindForStatus = (status: number): ApiErrorKind => {
  switch (status) {
    case 400:
      return 'validation';
    case 401:
      return 'unauthorized';
    case 403:
      return 'forbidden';
    case 404:
      return 'notFound';
    case 409:
      return 'conflict';
    case 422:
      return 'unprocessable';
    case 429:
      return 'rateLimited';
    default:
      return 'server';
  }
};

const parseRetryAfter = (header: string | null): number | null => {
  if (!header) return null;
  const seconds = Number(header);
  return Number.isFinite(seconds) && seconds >= 0 ? Math.ceil(seconds) : null;
};

export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';

export interface RequestOptions {
  body?: unknown;
  // Extra headers, e.g. `X-Acting-As` for a caretaker.
  headers?: Record<string, string>;
}

export interface ApiClientOptions {
  // The stored magic token, sent as `Authorization: Bearer <token>`.
  getToken: () => string | null;
  // Called on any `401`: the magic token is unknown, expired or revoked.
  onUnauthorized: () => void;
  fetch?: typeof fetch;
  baseUrl?: string;
}

// A thin typed client for the same-origin `/api`. Rejects with `ApiError`.
export const createApiClient = ({
  getToken,
  onUnauthorized,
  fetch: fetchImpl = (...args) => globalThis.fetch(...args),
  baseUrl = '/api',
}: ApiClientOptions) => {
  const request = async <T>(
    method: HttpMethod,
    path: string,
    { body, headers: extraHeaders }: RequestOptions = {},
  ): Promise<T> => {
    const headers: Record<string, string> = {
      Accept: 'application/json',
      ...extraHeaders,
    };
    if (body !== undefined) headers['Content-Type'] = 'application/json';
    const token = getToken();
    if (token) headers.Authorization = `Bearer ${token}`;

    let response: Response;
    try {
      response = await fetchImpl(`${baseUrl}${path}`, {
        method,
        headers,
        body: body === undefined ? undefined : JSON.stringify(body),
      });
    } catch (cause) {
      throw new ApiError('network', 0, String(cause));
    }

    const isJson = response.headers
      .get('Content-Type')
      ?.includes('application/json');
    const data: unknown = isJson
      ? await response.json().catch(() => undefined)
      : undefined;

    if (!response.ok) {
      if (response.status === 401) onUnauthorized();
      const serverMessage =
        data && typeof data === 'object' && 'error' in data
          ? String(data.error)
          : response.statusText;
      throw new ApiError(
        kindForStatus(response.status),
        response.status,
        serverMessage,
        parseRetryAfter(response.headers.get('Retry-After')),
      );
    }
    return data as T;
  };

  return {
    request,

    createEvent: (input: CreateEventInput) =>
      request<Event>('POST', '/events', { body: input }),

    // Always resolves for a valid email, whether or not the person exists.
    requestAccessLink: (email: string) =>
      request<void>('POST', '/access-links', { body: { email } }),

    getMe: () => request<Person>('GET', '/me'),
  };
};

export type ApiClient = ReturnType<typeof createApiClient>;
