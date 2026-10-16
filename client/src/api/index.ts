import { createApiClient } from './client';

export * from './client';
export type * from './types';

// What the app's api client needs from the signed-in session.
export interface ApiSession {
  readonly token: string | null;
  signOut: () => void;
}

export interface ApiNavigator {
  replace: (to: string) => unknown;
}

let session: ApiSession | null = null;
let navigator: ApiNavigator | null = null;

// Where a `401` sends the person: the landing page, with a notice that their
// personal link no longer works and a form to request a new one.
export const SIGNED_OUT_LOCATION = '/?signedOut=1';

// The app-wide api client. `connectApi` wires it to the auth store and router;
// until then requests go out without a magic token.
export const api = createApiClient({
  getToken: () => session?.token ?? null,
  onUnauthorized: () => {
    session?.signOut();
    navigator?.replace(SIGNED_OUT_LOCATION);
  },
});

export const connectApi = (
  connectedSession: ApiSession,
  connectedNavigator: ApiNavigator,
) => {
  session = connectedSession;
  navigator = connectedNavigator;
};
