import type {
  CreateEventInput,
  CreateWishlistInput,
  Event,
  EventDetails,
  MyAssignment,
  MyClaim,
  MyEvent,
  OrganizerParticipant,
  ParticipantSummary,
  Person,
  UpdateWishlistInput,
  Wishlist,
} from './types';

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

// Header a caretaker sends to act as one of their managed participants.
export const ACTING_AS_HEADER = 'X-Acting-As';

// Request headers for acting as a managed participant; none when acting as
// oneself (`actingAs` null or undefined).
export const actingAsHeaders = (
  actingAs?: string | null,
): Record<string, string> => (actingAs ? { [ACTING_AS_HEADER]: actingAs } : {});

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

    // The person's events, soonest exchange date first.
    listMyEvents: () => request<MyEvent[]>('GET', '/events'),

    // `404` unless the person participates in the event.
    getEvent: (eventId: string) =>
      request<EventDetails>('GET', `/events/${encodeURIComponent(eventId)}`),

    // The organizer gets `OrganizerParticipant`s, everyone else summaries.
    listParticipants: (eventId: string) =>
      request<ParticipantSummary[] | OrganizerParticipant[]>(
        'GET',
        `/events/${encodeURIComponent(eventId)}/participants`,
      ),

    // Leaves the draw while the event is open. `actingAs` is a managed
    // participant's id when a caretaker acts for them. The organizer cannot
    // decline (`409`).
    declineParticipation: (eventId: string, actingAs?: string | null) =>
      request<ParticipantSummary>(
        'POST',
        `/events/${encodeURIComponent(eventId)}/participation/decline`,
        { headers: actingAsHeaders(actingAs) },
      ),

    // Undoes a decline while the event is open.
    rejoinParticipation: (eventId: string, actingAs?: string | null) =>
      request<ParticipantSummary>(
        'POST',
        `/events/${encodeURIComponent(eventId)}/participation/rejoin`,
        { headers: actingAsHeaders(actingAs) },
      ),

    // The acting participant's assignment and their recipient's wishlist.
    // `404` before the draw or when they declined before it; still readable
    // once the event is finished.
    getMyAssignment: (eventId: string, actingAs?: string | null) =>
      request<MyAssignment>(
        'GET',
        `/events/${encodeURIComponent(eventId)}/my-assignment`,
        { headers: actingAsHeaders(actingAs) },
      ),

    // The acting participant's own wishlist first, then every child
    // wishlist of the event (+ their recipient's once drawn).
    listWishlists: (eventId: string, actingAs?: string | null) =>
      request<Wishlist[]>(
        'GET',
        `/events/${encodeURIComponent(eventId)}/wishlists`,
        { headers: actingAsHeaders(actingAs) },
      ),

    // `409` for a second own wishlist, too many child wishlists or once the
    // event is finished.
    createWishlist: (
      eventId: string,
      input: CreateWishlistInput,
      actingAs?: string | null,
    ) =>
      request<Wishlist>(
        'POST',
        `/events/${encodeURIComponent(eventId)}/wishlists`,
        { body: input, headers: actingAsHeaders(actingAs) },
      ),

    // Owner only; `409` once the event is finished.
    updateWishlist: (
      eventId: string,
      wishlistId: string,
      input: UpdateWishlistInput,
      actingAs?: string | null,
    ) =>
      request<Wishlist>(
        'PATCH',
        `/events/${encodeURIComponent(eventId)}/wishlists/${encodeURIComponent(
          wishlistId,
        )}`,
        { body: input, headers: actingAsHeaders(actingAs) },
      ),

    // Owner only, with the items and their claims; `409` once finished.
    deleteWishlist: (
      eventId: string,
      wishlistId: string,
      actingAs?: string | null,
    ) =>
      request<void>(
        'DELETE',
        `/events/${encodeURIComponent(eventId)}/wishlists/${encodeURIComponent(
          wishlistId,
        )}`,
        { headers: actingAsHeaders(actingAs) },
      ),

    // Claims a child wishlist item: `409` if someone else holds the claim,
    // `403` for the child's parent.
    claimWishlistItem: (
      eventId: string,
      itemId: string,
      actingAs?: string | null,
    ) =>
      request<MyClaim>(
        'PUT',
        `/events/${encodeURIComponent(
          eventId,
        )}/wishlist-items/${encodeURIComponent(itemId)}/claim`,
        { headers: actingAsHeaders(actingAs) },
      ),

    // Releases one's own claim.
    releaseClaim: (eventId: string, itemId: string, actingAs?: string | null) =>
      request<void>(
        'DELETE',
        `/events/${encodeURIComponent(
          eventId,
        )}/wishlist-items/${encodeURIComponent(itemId)}/claim`,
        { headers: actingAsHeaders(actingAs) },
      ),

    // The acting participant's shopping list.
    listMyClaims: (eventId: string, actingAs?: string | null) =>
      request<MyClaim[]>(
        'GET',
        `/events/${encodeURIComponent(eventId)}/my-claims`,
        { headers: actingAsHeaders(actingAs) },
      ),
  };
};

export type ApiClient = ReturnType<typeof createApiClient>;
