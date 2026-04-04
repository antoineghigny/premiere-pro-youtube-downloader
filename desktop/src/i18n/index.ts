import { createContext, useContext } from 'react';

import en, { type Translations } from './locales/en';
import fr from './locales/fr';

const locales: Record<string, Translations> = { en, fr };

export type Language = 'en' | 'fr';

/**
 * Resolve a dot-separated key path to its value in the translation object.
 *
 *   resolve(translations, 'titleBar.ready')  →  'Ready'
 */
function resolve(obj: Record<string, unknown>, path: string): string | undefined {
  let cursor: unknown = obj;
  for (const segment of path.split('.')) {
    if (cursor === null || cursor === undefined || typeof cursor !== 'object') {
      return undefined;
    }
    cursor = (cursor as Record<string, unknown>)[segment];
  }
  return typeof cursor === 'string' ? cursor : undefined;
}

/**
 * Build a translator function bound to the given language.
 *
 *   const t = createT('fr');
 *   t('titleBar.ready')                    →  'Prêt'
 *   t('titleBar.premiereReady', { name })  →  'MyProject prêt'
 */
export function createT(lang: Language) {
  const translations = locales[lang] ?? en;

  return function t(key: string, params?: Record<string, string | number>): string {
    const value = resolve(translations as unknown as Record<string, unknown>, key)
      ?? resolve(en as unknown as Record<string, unknown>, key)
      ?? key;

    if (!params) {
      return value;
    }

    return value.replace(/\{(\w+)\}/g, (_, k: string) => {
      const v = params[k];
      return v !== undefined ? String(v) : `{${k}}`;
    });
  };
}

export type TFunction = ReturnType<typeof createT>;

const TranslationContext = createContext<TFunction>(createT('en'));

export const TranslationProvider = TranslationContext.Provider;

export function useTranslation(): TFunction {
  return useContext(TranslationContext);
}
