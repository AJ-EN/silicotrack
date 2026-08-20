'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

import type { StringKey } from '@/lib/i18n';

import { useLocale, LocaleToggle } from './locale';

/**
 * App header, carried by every screen.
 *
 * Two jobs. It states permanently that this is an unvalidated prototype — a
 * government demonstration tool with no clinical validation, and the person
 * holding the phone should never be in doubt about that. And it carries the
 * role switcher.
 *
 * The switcher stands in for authentication, which the demo deliberately does
 * not have (CLAUDE.md §10). Without it three of the four screens are reachable
 * only by typing a URL, so a visitor finds /field and reasonably concludes
 * that is the whole system.
 */

const SCREENS: { href: string; label: StringKey }[] = [
  { href: '/field', label: 'nav.field' },
  { href: '/camp', label: 'nav.camp' },
  { href: '/referral', label: 'nav.referral' },
  { href: '/dashboard', label: 'nav.dashboard' },
];

export function FieldHeader() {
  const { t } = useLocale();
  const pathname = usePathname();

  return (
    <header style={{ backgroundColor: 'var(--tier-4)' }}>
      <div className="mx-auto flex w-full max-w-4xl items-center gap-3 px-4 py-3">
        <Link href="/" className="min-w-0 flex-1">
          <p className="truncate text-xl font-bold text-white">{t('app.name')}</p>
          <p className="truncate text-sm text-white/80">{t('app.tagline')}</p>
        </Link>
        <div className="flex shrink-0 flex-col items-end gap-1">
          <LocaleToggle />
          <span className="max-w-44 text-right text-xs font-semibold leading-tight text-white/80">
            {t('lang.marwariPlanned')}
          </span>
        </div>
      </div>

      {/*
        Scrolls horizontally rather than wrapping. Four Devanagari labels do not
        fit across 360px, and a header that grows to two rows steals vertical
        space from the interview on every screen.
      */}
      <nav
        aria-label={t('app.name')}
        className="border-t border-white/25"
      >
        <ul className="mx-auto flex w-full max-w-4xl gap-1 overflow-x-auto px-2 py-2">
          {SCREENS.map((screen) => {
            const active = pathname.startsWith(screen.href);
            return (
              <li key={screen.href} className="shrink-0">
                <Link
                  href={screen.href}
                  aria-current={active ? 'page' : undefined}
                  className={[
                    'block rounded-md px-3 py-2 text-base font-semibold',
                    active ? 'bg-white text-black' : 'text-white/85',
                  ].join(' ')}
                >
                  {t(screen.label)}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      <p className="border-t border-white/25 px-4 py-1 text-center text-sm font-semibold text-white/90">
        {t('app.unvalidated')}
      </p>
    </header>
  );
}
