import { readStored, removeStored, writeStored } from '@/lib/safeStorage';

// The page a signed-out person tried to open (e.g. the assignment link in a
// draw-result email), so signing in with a personal link lands them there
// instead of on `/events`. The personal link usually opens in a new tab, so
// this lives in localStorage rather than in the URL or sessionStorage.

const STORAGE_KEY = 'secret-santa.returnTo';

// Older requests are stale: the person has likely moved on.
export const RETURN_TO_MAX_AGE_MS = 24 * 60 * 60 * 1000;

interface StoredReturnTo {
  path: string;
  savedAt: number;
}

// Only same-origin app paths; never `//host`, and never back into `/auth`.
const isSafePath = (path: string): boolean =>
  path.startsWith('/') && !path.startsWith('//') && !path.startsWith('/auth');

export const rememberReturnTo = (path: string, now = Date.now()): void => {
  if (!isSafePath(path)) return;
  const stored: StoredReturnTo = { path, savedAt: now };
  writeStored(STORAGE_KEY, JSON.stringify(stored));
};

// The remembered path, if still fresh; forgotten either way.
export const takeReturnTo = (now = Date.now()): string | null => {
  const raw = readStored(STORAGE_KEY);
  removeStored(STORAGE_KEY);
  if (!raw) return null;
  try {
    const { path, savedAt } = JSON.parse(raw) as Partial<StoredReturnTo>;
    if (typeof path !== 'string' || typeof savedAt !== 'number') return null;
    if (now - savedAt > RETURN_TO_MAX_AGE_MS || now < savedAt) return null;
    return isSafePath(path) ? path : null;
  } catch {
    return null;
  }
};
