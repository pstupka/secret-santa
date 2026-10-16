// `localStorage` that never throws: it can be missing or blocked (private
// mode, disabled site data, storage quota). Failures behave like an empty store.

export const readStored = (key: string): string | null => {
  try {
    return globalThis.localStorage.getItem(key);
  } catch {
    return null;
  }
};

export const writeStored = (key: string, value: string): void => {
  try {
    globalThis.localStorage.setItem(key, value);
  } catch {
    // Not persisted: the value lives only until the page is reloaded.
  }
};

export const removeStored = (key: string): void => {
  try {
    globalThis.localStorage.removeItem(key);
  } catch {
    // Nothing to clean up.
  }
};
