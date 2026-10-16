import { createI18n } from 'vue-i18n';

import pl from './locales/pl.json';

// All copy lives in `locales/pl.json`; `pl` is the only shipped locale.
export type MessageSchema = typeof pl;

declare module 'vue-i18n' {
  // Typed message keys for `t()` / `$t()`.
  // eslint-disable-next-line @typescript-eslint/no-empty-object-type
  export interface DefineLocaleMessage extends MessageSchema {}
}

export const createAppI18n = () =>
  createI18n<[MessageSchema], 'pl'>({
    legacy: false,
    locale: 'pl',
    fallbackLocale: 'pl',
    messages: { pl },
  });
