'use client';

import Link from 'next/link';

import { useLocale } from '@/components/field/locale';
import type { StringKey } from '@/lib/i18n';

/**
 * Landing page.
 *
 * Deliberately not a product page. A government evaluator arriving cold needs
 * three things in this order: what the system claims, where the four screens
 * are, and what it does NOT claim. The honest-status block is not a footnote
 * here — it is a section, because the project's credibility rests on stating
 * its limits before anyone has to ask.
 */

const SCREENS: { href: string; label: StringKey; role: StringKey }[] = [
  { href: '/field', label: 'nav.field', role: 'role.field' },
  { href: '/camp', label: 'nav.camp', role: 'role.camp' },
  { href: '/referral', label: 'nav.referral', role: 'role.referral' },
  { href: '/dashboard', label: 'nav.dashboard', role: 'role.dashboard' },
];

const THESIS: StringKey[] = ['home.thesis1', 'home.thesis2', 'home.thesis3'];

const STATUS: StringKey[] = [
  'home.statusValidation',
  'home.statusData',
  'home.statusJem',
  'home.statusNotDevice',
];

export function HomeView() {
  const { t } = useLocale();

  return (
    <div className="mx-auto w-full max-w-4xl px-4 py-6">
      <p className="text-lg leading-relaxed">{t('home.lede')}</p>

      {/* --- Where to go. First, because most visitors want the screens. --- */}
      <section className="mt-8">
        <h2 className="text-lg font-bold">{t('home.screensTitle')}</h2>
        <ul className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
          {SCREENS.map((screen) => (
            <li key={screen.href}>
              <Link
                href={screen.href}
                className="tap flex flex-col justify-center rounded-md border-2 px-4 py-3"
                style={{ borderColor: 'var(--field-rule)' }}
              >
                <span className="text-base font-bold">{t(screen.label)}</span>
                <span className="text-sm text-muted-foreground">{t(screen.role)}</span>
              </Link>
            </li>
          ))}
        </ul>
      </section>

      {/* --- The argument, in three sourced sentences. --- */}
      <section className="mt-8">
        <h2 className="text-lg font-bold">{t('home.thesisTitle')}</h2>
        <ol className="mt-3 space-y-3">
          {THESIS.map((key, index) => (
            <li key={key} className="flex gap-3">
              <span
                className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-sm font-bold"
                style={{
                  backgroundColor: 'var(--tier-2)',
                  color: 'var(--tier-2-ink)',
                }}
              >
                {index + 1}
              </span>
              <p className="text-base leading-relaxed">{t(key)}</p>
            </li>
          ))}
        </ol>
      </section>

      {/* --- Limits, stated before anyone has to ask. --- */}
      <section className="mt-8">
        <h2 className="text-lg font-bold">{t('home.statusTitle')}</h2>
        <ul
          className="mt-3 space-y-2 rounded-md border-2 p-4"
          style={{
            borderColor: 'var(--field-rule)',
            backgroundColor: 'var(--field-notice)',
          }}
        >
          {STATUS.map((key) => (
            <li key={key} className="text-base leading-relaxed">
              {t(key)}
            </li>
          ))}
        </ul>
      </section>

      <section className="mt-8">
        <h2 className="text-lg font-bold">{t('home.docs')}</h2>
        <ul className="mt-3 space-y-2 text-base">
          <li>
            <a
              className="underline underline-offset-4"
              href="https://github.com/AJ-EN/silicotrack/blob/main/docs/RISK_MODEL.md"
            >
              {t('home.docsModel')}
            </a>
          </li>
          <li>
            <a
              className="underline underline-offset-4"
              href="https://github.com/AJ-EN/silicotrack/blob/main/docs/JEM_SOURCES.md"
            >
              {t('home.docsJem')}
            </a>
          </li>
        </ul>
      </section>
    </div>
  );
}
