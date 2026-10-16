import Joi from 'joi';

import { ValidationSchema } from '@core/interfaces/validationSchema';

// Abuse guards: a wishlist holds at most this many items.
export const MAX_ITEMS_PER_WISHLIST = 100;

// Nullable free text: absent, empty or blank becomes null.
const optionalText = (max: number) =>
  Joi.string().trim().max(max).allow('', null).empty('').default(null);

// Nullable free text in a partial update: absent stays unchanged; null,
// empty or blank clears it (the service stores '' as null).
const clearableText = (max: number) =>
  Joi.string().trim().max(max).allow('', null);

const childName = Joi.string().trim().min(1).max(100);

// Only web links, so the client can render them as anchors safely.
const itemUrl = Joi.string()
  .trim()
  .max(2000)
  .uri({ scheme: ['http', 'https'] })
  .allow('', null)
  .empty('')
  .default(null);

const itemFields = {
  title: Joi.string().trim().min(1).max(200).required(),
  url: itemUrl,
  notes: optionalText(1000),
};

const items = (item: Joi.ObjectSchema) =>
  Joi.array().items(item).max(MAX_ITEMS_PER_WISHLIST);

// `childName` absent or null = the participant's own wishlist.
export const createWishlistSchema: ValidationSchema = {
  body: Joi.object().keys({
    childName: childName.allow(null).default(null),
    notes: optionalText(2000),
    items: items(Joi.object().keys(itemFields)).default([]),
  }),
};

// Partial update: only the given fields change. `items` replaces the whole
// list in the given order; an item passed with its `id` is kept (with its
// claim), items left out are removed, items without an `id` are new.
export const updateWishlistSchema: ValidationSchema = {
  body: Joi.object()
    .keys({
      childName,
      notes: clearableText(2000),
      items: items(
        Joi.object().keys({
          id: Joi.string().trim().min(1).max(64),
          ...itemFields,
        }),
      ).unique((a: { id?: string }, b: { id?: string }) =>
        Boolean(a.id && a.id === b.id),
      ),
    })
    .min(1),
};
