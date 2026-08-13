'use client';

import { createContext, useCallback, useContext, useMemo, useSyncExternalStore } from 'react';

import { DEFAULT_LOCALE, isLocale, t, type Locale, type StringKey } from '@/lib/i18n';

const STORAGE_KEY = 'silicotrack.locale';

/**
 * localStorage is an external store, so it is read through
 * useSyncExternalStore rather than mirrored into state inside an effect.
 * Mirroring would render once with the default and again with the stored
 * value, which on a slow phone is a visible flash of the wrong language.
 */
const listeners = new Set<() => void>();
let cached: Locale | null = null;

function readStored(): Locale {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored !== null && isLocale(stored) ? stored : DEFAULT_LOCALE;
  } catch {
    // Private mode or a locked-down WebView. The app must still run.
    return DEFAULT_LOCALE;
  }
}

function subscribe(callback: () => void): () => void {
  listeners.add(callback);
  // Keeps two open tabs in step.
  window.addEventListener('storage', callback);
  return () => {
    listeners.delete(callback);
    window.removeEventListener('storage', callback);
  };
}

/** Cached so repeated renders do not hit localStorage, and stays referentially stable. */
function getSnapshot(): Locale {
  cached ??= readStored();
  return cached;
}

/** The server has no localStorage; it always renders the default. */
function getServerSnapshot(): Locale {
  return DEFAULT_LOCALE;
}

function writeLocale(next: Locale): void {
  cached = next;
  try {
    localStorage.setItem(STORAGE_KEY, next);
  } catch {
    // Preference simply will not persist. Not worth failing over.
  }
  document.documentElement.lang = next;
  for (const listener of listeners) listener();
}

interface LocaleContextValue {
  locale: Locale;
  setLocale: (locale: Locale) => void;
  t: (key: StringKey) => string;
}

const LocaleContext = createContext<LocaleContextValue | null>(null);

export function LocaleProvider({ children }: { children: React.ReactNode }) {
  const locale = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  const setLocale = useCallback((next: Locale) => writeLocale(next), []);

  const value = useMemo<LocaleContextValue>(
    () => ({ locale, setLocale, t: (key) => t(key, locale) }),
    [locale, setLocale],
  );

  return <LocaleContext.Provider value={value}>{children}</LocaleContext.Provider>;
}

export function useLocale(): LocaleContextValue {
  const context = useContext(LocaleContext);
  if (context === null) {
    throw new Error('useLocale must be used inside a LocaleProvider');
  }
  return context;
}

/** Header control. Shows the language you would switch TO, not the current one. */
export function LocaleToggle() {
  const { locale, setLocale, t: translate } = useLocale();
  return (
    <button
      type="button"
      onClick={() => setLocale(locale === 'hi' ? 'en' : 'hi')}
      className="tap rounded-md border-2 border-white/70 px-4 text-base font-semibold text-white"
    >
      {translate('lang.toggle')}
    </button>
  );
}
