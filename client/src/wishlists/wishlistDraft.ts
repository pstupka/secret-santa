import type { CreateWishlistInput, UpdateWishlistInput, Wishlist } from '@/api';

// Server limits (`server/src/components/wishlists/wishlists.validation.ts`).
export const MAX_ITEMS_PER_WISHLIST = 100;
export const MAX_CHILD_WISHLISTS = 10;
export const MAX_CHILD_NAME_LENGTH = 100;
export const MAX_WISHLIST_NOTES_LENGTH = 2000;
export const MAX_ITEM_TITLE_LENGTH = 200;
export const MAX_ITEM_URL_LENGTH = 2000;
export const MAX_ITEM_NOTES_LENGTH = 1000;

// A wishlist item while it is edited in the wishlist form.
export interface WishlistItemDraft {
  // Stable key for rendering, also for items not saved yet.
  key: string;
  // The saved item's id; kept on save so its claim survives.
  id?: string;
  title: string;
  url: string;
  notes: string;
}

// The wishlist form: the owner's own wishlist or a child wishlist.
export interface WishlistDraft {
  // Only for a child wishlist.
  childName: string;
  notes: string;
  items: WishlistItemDraft[];
}

let nextKey = 0;
const newKey = () => `new-${(nextKey += 1)}`;

export const emptyItemDraft = (): WishlistItemDraft => ({
  key: newKey(),
  title: '',
  url: '',
  notes: '',
});

// A new wishlist starts with one empty gift idea to fill in.
export const emptyWishlistDraft = (): WishlistDraft => ({
  childName: '',
  notes: '',
  items: [emptyItemDraft()],
});

export const wishlistDraftOf = (wishlist: Wishlist): WishlistDraft => ({
  childName: wishlist.childName ?? '',
  notes: wishlist.notes ?? '',
  items: wishlist.items.map((item) => ({
    key: item.id,
    id: item.id,
    title: item.title,
    url: item.url ?? '',
    notes: item.notes ?? '',
  })),
});

// The items with the one at `index` moved by `offset` places (-1 up, +1
// down); unchanged when it would leave the list.
export const moveItem = <T>(items: T[], index: number, offset: number): T[] => {
  const target = index + offset;
  if (index < 0 || index >= items.length) return items;
  if (target < 0 || target >= items.length) return items;
  const moved = [...items];
  const [item] = moved.splice(index, 1);
  moved.splice(target, 0, item as T);
  return moved;
};

const hasScheme = (url: string) => /^[a-z][a-z\d+.-]*:/i.test(url);

// What is saved for a typed link: trimmed, `https://` added to a bare address
// such as `allegro.pl/oferta/1`; null when empty.
export const normalizeItemUrl = (url: string): string | null => {
  const trimmed = url.trim();
  if (!trimmed) return null;
  return hasScheme(trimmed) ? trimmed : `https://${trimmed}`;
};

// Only http(s) links are accepted, so they are safe to render as anchors.
export const isWebUrl = (url: string): boolean => {
  try {
    const { protocol, hostname } = new URL(url);
    return (protocol === 'http:' || protocol === 'https:') && hostname !== '';
  } catch {
    return false;
  }
};

export type ItemDraftError = 'titleRequired' | 'urlInvalid';

export interface WishlistDraftErrors {
  childName?: 'required';
  tooManyItems?: true;
  // Item key → its problems.
  items: Record<string, ItemDraftError[]>;
}

// Whether a draft item is left blank: such items are dropped on save.
const isBlankItem = (item: WishlistItemDraft) =>
  !item.title.trim() && !item.url.trim() && !item.notes.trim();

const itemsToSave = (draft: WishlistDraft) =>
  draft.items.filter((item) => !isBlankItem(item));

export const validateWishlistDraft = (
  draft: WishlistDraft,
  { isChild }: { isChild: boolean },
): WishlistDraftErrors => {
  const errors: WishlistDraftErrors = { items: {} };
  if (isChild && !draft.childName.trim()) errors.childName = 'required';
  const items = itemsToSave(draft);
  if (items.length > MAX_ITEMS_PER_WISHLIST) errors.tooManyItems = true;
  items.forEach((item) => {
    const problems: ItemDraftError[] = [];
    if (!item.title.trim()) problems.push('titleRequired');
    const url = normalizeItemUrl(item.url);
    if (url !== null && !isWebUrl(url)) problems.push('urlInvalid');
    if (problems.length > 0) errors.items[item.key] = problems;
  });
  return errors;
};

export const hasDraftErrors = (errors: WishlistDraftErrors): boolean =>
  Boolean(errors.childName) ||
  Boolean(errors.tooManyItems) ||
  Object.keys(errors.items).length > 0;

const itemInputs = (draft: WishlistDraft) =>
  itemsToSave(draft).map((item) => ({
    ...(item.id !== undefined && { id: item.id }),
    title: item.title.trim(),
    url: normalizeItemUrl(item.url),
    notes: item.notes.trim() || null,
  }));

// `POST` body for a new wishlist; blank items are dropped.
export const createWishlistInput = (
  draft: WishlistDraft,
  { isChild }: { isChild: boolean },
): CreateWishlistInput => ({
  ...(isChild && { childName: draft.childName.trim() }),
  notes: draft.notes.trim() || null,
  items: itemInputs(draft).map(({ title, url, notes }) => ({
    title,
    url,
    notes,
  })),
});

// `PATCH` body replacing the wishlist's fields and items in the draft's
// order. Kept items carry their `id`, so their claims survive.
export const updateWishlistInput = (
  draft: WishlistDraft,
  { isChild }: { isChild: boolean },
): UpdateWishlistInput => ({
  ...(isChild && { childName: draft.childName.trim() }),
  notes: draft.notes.trim() || null,
  items: itemInputs(draft),
});
