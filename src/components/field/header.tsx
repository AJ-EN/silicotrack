'use client';

import { useLocale, LocaleToggle } from './locale';

/**
 * App header.
 *
 * Carries the unvalidated-prototype notice permanently. This is a government
 * demonstration tool with no clinical validation, and the person holding the
 * phone should never be in doubt about that.
 */
export function FieldHeader() {
  const { t } = useLocale();
  return (
    <header style={{ backgroundColor: 'var(--tier-4)' }}>
      <div className="mx-auto flex w-full max-w-2xl items-center gap-3 px-4 py-3">
        <div className="min-w-0 flex-1">
          <p className="truncate text-xl font-bold text-white">{t('app.name')}</p>
          <p className="truncate text-sm text-white/80">{t('app.tagline')}</p>
        </div>
        <LocaleToggle />
      </div>
      <p className="border-t border-white/25 px-4 py-1 text-center text-sm font-semibold text-white/90">
        {t('app.unvalidated')}
      </p>
    </header>
  );
}
