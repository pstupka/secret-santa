// A personal link is `/auth#token=<magic token>`: the fragment never reaches
// server or proxy logs (ADR-0001).

export const magicTokenFromHash = (hash: string): string | null => {
  const token = new URLSearchParams(hash.replace(/^#/, '')).get('token');
  return token?.trim() || null;
};

// Drops the fragment from the address bar and history entry, so the magic
// token is not left in the URL (bookmarks, screenshots, shared tabs).
export const removeHashFromUrl = (
  location: Pick<Location, 'pathname' | 'search'> = window.location,
  history: Pick<History, 'replaceState' | 'state'> = window.history,
): void => {
  history.replaceState(history.state, '', location.pathname + location.search);
};
