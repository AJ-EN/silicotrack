'use client';

/**
 * Risk result display.
 *
 * The tier is never shown alone. It always appears with the exposure figure
 * that produced it, the tasks that drove that figure, and the three
 * disclaimers. A health worker who cannot see why a worker was flagged has no
 * way to challenge the result, and a score nobody can challenge is a score
 * nobody should trust.
 */

import { getJemEntry } from '@/lib/risk/jem';
import type { RiskResult, Tier } from '@/lib/risk/types';
import type { StringKey } from '@/lib/i18n';

import { useLocale } from './locale';

const TIER_LABEL: Record<Tier, StringKey> = {
  1: 'result.tier1',
  2: 'result.tier2',
  3: 'result.tier3',
  4: 'result.tier4',
};

function tierStyle(tier: Tier): React.CSSProperties {
  return {
    backgroundColor: `var(--tier-${tier})`,
    color: `var(--tier-${tier}-ink)`,
  };
}

export function TierBadge({ tier, compact = false }: { tier: Tier; compact?: boolean }) {
  const { t } = useLocale();
  return (
    <span
      className={
        compact
          ? 'inline-flex items-center gap-2 rounded-md px-3 py-1 text-base font-bold'
          : 'inline-flex items-center gap-3 rounded-md px-5 py-3 text-2xl font-bold'
      }
      style={tierStyle(tier)}
    >
      {/* The numeral carries the ordinal meaning; the colour only reinforces
          it. Never let the colour be the sole signal. */}
      <span className="tabular-nums opacity-70">{tier}</span>
      {t(TIER_LABEL[tier])}
    </span>
  );
}

/**
 * The three statements that must accompany every score.
 *
 * Not collapsible, not behind a tooltip, not smaller than body text. If a
 * reviewer asks "where does it say this isn't a diagnosis", the answer must be
 * "on the same screen as the number, every time".
 */
export function Disclaimers() {
  const { t } = useLocale();
  return (
    <div
      className="mt-6 rounded-md border-2 p-4 text-base"
      style={{ borderColor: 'var(--field-rule)', backgroundColor: 'var(--field-notice)' }}
    >
      <p className="font-bold">{t('disclaimer.notDiagnosis')}</p>
      <p className="mt-2">{t('disclaimer.provisional')}</p>
      <p className="mt-2">{t('disclaimer.authority')}</p>
    </div>
  );
}

export function RiskResultPanel({ result }: { result: RiskResult }) {
  const { t, locale } = useLocale();

  if (result.insufficientData) {
    return (
      <section>
        <div
          className="rounded-md border-2 p-5"
          style={{ borderColor: 'var(--field-rule)', backgroundColor: 'var(--field-notice)' }}
        >
          <h2 className="text-2xl font-bold">{t('result.incomplete')}</h2>
          <p className="mt-2 text-lg">
            {locale === 'hi' ? result.reasonHi : result.reasonEn}
          </p>
        </div>
        <Disclaimers />
      </section>
    );
  }

  const applied = result.escalations.filter((escalation) => escalation.applied);

  return (
    <section>
      <div className="flex flex-wrap items-center gap-3">
        <span className="text-base font-semibold text-muted-foreground">
          {t('result.tier')}
        </span>
        <TierBadge tier={result.tier} />
      </div>

      {/* The headline number, given room. */}
      <dl className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div
          className="rounded-md border-2 p-4"
          style={{ borderColor: 'var(--field-rule)' }}
        >
          <dt className="text-base font-semibold text-muted-foreground">
            {t('result.cumulative')}
          </dt>
          <dd className="mt-1 text-3xl font-bold tabular-nums">
            {result.cumulativeExposure.toFixed(2)}
            <span className="ml-2 text-base font-normal text-muted-foreground">
              mg/m³·{t('worker.years')}
            </span>
          </dd>
        </div>
        <div
          className="rounded-md border-2 p-4"
          style={{ borderColor: 'var(--field-rule)' }}
        >
          <dt className="text-base font-semibold text-muted-foreground">
            {t('result.rescreen')}
          </dt>
          <dd className="mt-1 text-3xl font-bold tabular-nums">
            {result.rescreenMonths}
            <span className="ml-2 text-base font-normal text-muted-foreground">
              {t('result.months')}
            </span>
          </dd>
        </div>
      </dl>

      {/* Explainability. This is the part that earns trust. */}
      <h3 className="mt-6 text-lg font-bold">{t('result.why')}</h3>
      <p className="mt-2 text-lg leading-[1.7]">
        {locale === 'hi' ? result.reasonHi : result.reasonEn}
      </p>

      {result.topContributors.length > 0 && (
        <>
          <h4 className="mt-5 text-base font-semibold text-muted-foreground">
            {t('result.contributors')}
          </h4>
          <ul className="mt-2 space-y-2">
            {result.topContributors.map((contributor) => {
              const entry = getJemEntry(contributor.taskCode);
              return (
                <li key={contributor.taskCode}>
                  <div className="flex items-baseline justify-between gap-3 text-base">
                    <span className="font-semibold">
                      {locale === 'hi' ? entry.labelHi : entry.labelEn}
                    </span>
                    <span className="shrink-0 tabular-nums text-muted-foreground">
                      {contributor.calendarYears} {t('worker.years')} ·{' '}
                      {contributor.percentOfTotal.toFixed(1)}%
                    </span>
                  </div>
                  {/* Proportion bar, same sequential hue as the tier scale. */}
                  <div className="mt-1 h-3 w-full rounded-sm bg-neutral-200">
                    <div
                      className="h-3 rounded-sm"
                      style={{
                        width: `${Math.max(2, contributor.percentOfTotal)}%`,
                        backgroundColor: `var(--tier-${result.tier})`,
                      }}
                    />
                  </div>
                </li>
              );
            })}
          </ul>
        </>
      )}

      {applied.length > 0 && (
        <>
          <h4 className="mt-5 text-base font-semibold text-muted-foreground">
            {t('result.escalations')}
          </h4>
          <ul className="mt-2 space-y-1">
            {applied.map((escalation) => (
              <li key={escalation.code} className="text-base">
                • {t(`esc.${escalation.code}` as StringKey)}
              </li>
            ))}
          </ul>
        </>
      )}

      <p className="mt-4 text-sm text-muted-foreground tabular-nums">
        {result.modelVersion} · {result.jemVersion} · {result.confidence}
      </p>

      <Disclaimers />
    </section>
  );
}
