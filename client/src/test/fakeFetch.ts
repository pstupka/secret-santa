import { vi } from 'vitest';

export interface FakeResponse {
  status?: number;
  body?: unknown;
  headers?: Record<string, string>;
}

export const jsonResponse = ({
  status = 200,
  body,
  headers = {},
}: FakeResponse = {}): Response =>
  new Response(body === undefined ? null : JSON.stringify(body), {
    status,
    headers:
      body === undefined
        ? headers
        : { 'Content-Type': 'application/json; charset=utf-8', ...headers },
  });

// A `fetch` stand-in answering every request with the given responses in turn
// (the last one repeats).
export const fakeFetch = (...responses: FakeResponse[]) => {
  let call = 0;
  return vi.fn<typeof fetch>(async () => {
    const response = responses[Math.min(call, responses.length - 1)];
    call += 1;
    return jsonResponse(response);
  });
};

// The headers a `fetch` mock was called with, by call index.
export const requestHeaders = (
  fetchMock: ReturnType<typeof fakeFetch>,
  call = 0,
): Record<string, string> =>
  (fetchMock.mock.calls[call]?.[1]?.headers ?? {}) as Record<string, string>;
