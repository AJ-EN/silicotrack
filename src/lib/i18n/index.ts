/**
 * Translation lookup.
 *
 * Deliberately tiny — no ICU, no interpolation engine, no async loading. The
 * field app must work with no network, so every string ships in the bundle.
 */

import { DEFAULT_LOCALE, LOCALES, STRINGS, type Locale, type StringKey } from './strings';

export { DEFAULT_LOCALE, LOCALES, STRINGS };
export type { Locale, StringKey };

/** Look up one string. Keys are checked at compile time. */
export function t(key: StringKey, locale: Locale): string {
  return STRINGS[key][locale];
}

/** Curried form, for components that hold a locale in context. */
export function translator(locale: Locale): (key: StringKey) => string {
  return (key) => t(key, locale);
}

export function isLocale(value: string): value is Locale {
  return (LOCALES as readonly string[]).includes(value);
}

/**
 * Devanagari renders taller than Latin at the same nominal size, so Hindi
 * needs slightly more line height to stay legible on a cheap phone in
 * sunlight. Components use this rather than hardcoding a class.
 */
export function localeLineHeight(locale: Locale): string {
  return locale === 'hi' ? 'leading-[1.7]' : 'leading-[1.5]';
}
