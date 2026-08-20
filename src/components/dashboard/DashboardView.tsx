'use client';

import { useLocale } from '@/components/field/locale';
import { Disclaimers } from '@/components/field/result';
import { SyntheticDataNotice } from '@/components/ui/data-notice';
import type { Surveillance } from '@/lib/dashboard/surveillance';
import type { Funnel } from '@/lib/referral/funnel';
import type { StringKey } from '@/lib/i18n';

export interface DashboardViewProps {
  surveillance: Surveillance;
  funnel: Funnel;
}

const TIER_LABEL: Record<number, StringKey> = {
  1: 'result.tier1',
  2: 'result.tier2',
  3: 'result.tier3',
  4: 'result.tier4',
};

function Stat({
  label,
  value,
  unit,
}: {
  label: StringKey;
  value: string;
  unit?: string;
}) {
  const { t } = useLocale();
  return (
    <div className="rounded-md border-2 p-4" style={{ borderColor: 'var(--field-rule)' }}>
      <dt className="text-base font-semibold text-muted-foreground">{t(label)}</dt>
      <dd className="mt-1 text-3xl font-bold tabular-nums">
        {value}
        {unit !== undefined && (
          <span className="ml-2 text-base font-normal text-muted-foreground">{unit}</span>
        )}
      </dd>
    </div>
  );
}

export function DashboardView({ surveillance, funnel }: DashboardViewProps) {
  const { t } = useLocale();
  const { cohort, tiers, districts, symptomGate } = surveillance;

  // Cascade steps, each measured against the registry so the narrowing is
  // visible as one scale rather than a series of unrelated percentages.
  const cascade: { label: StringKey; value: number }[] = [
    { label: 'dash.registered', value: cohort.registered },
    { label: 'dash.invited', value: cohort.invited },
    { label: 'dash.attended', value: cohort.attended },
    // flaggedForReview, not abnormal: borderline 0/1 films are referred too,
    // and a cascade built on ILO 1+ alone widens at this step.
    { label: 'dash.flagged', value: cohort.flaggedForReview },
    { label: 'dash.referred', value: cohort.referred },
    { label: 'dash.certifiedCount', value: cohort.certified },
  ];

  return (
    <div className="mx-auto w-full max-w-4xl px-4 py-6">
      <h1 className="text-2xl font-bold">{t('dash.title')}</h1>
      <p className="mt-1 text-base text-muted-foreground">{t('dash.subtitle')}</p>
      <SyntheticDataNotice />

      <dl className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat label="dash.registered" value={String(cohort.registered)} />
        <Stat label="dash.assessed" value={String(cohort.assessed)} />
        <Stat label="dash.incomplete" value={String(cohort.incomplete)} />
        <Stat label="dash.certifiedCount" value={String(cohort.certified)} />
      </dl>

      {/* ── The headline ─────────────────────────────────────────────────── */}
      <section className="mt-8">
        <h2 className="text-lg font-bold">{t('dash.symptomGate')}</h2>

        <dl className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-3">
          <Stat
            label="dash.abnormalFindings"
            value={String(symptomGate.abnormalFindings)}
          />
          <Stat
            label="dash.discarded"
            value={String(symptomGate.discardedAtSymptomGate)}
          />
          <Stat
            label="dash.discardRate"
            value={`${symptomGate.discardRate.toFixed(1)}%`}
          />
        </dl>

        {symptomGate.discardedAtHighTier > 0 && (
          <p className="mt-3 text-base">
            <strong className="tabular-nums">{symptomGate.discardedAtHighTier}</strong>{' '}
            {t('dash.discardedHighTier')}
          </p>
        )}

        <p
          className="mt-3 rounded-md border-2 p-4 text-base"
          style={{
            borderColor: 'var(--field-rule)',
            backgroundColor: 'var(--field-notice)',
          }}
        >
          {/* Provenance of the claim, on the same screen as the claim. */}
          {t('dash.symptomGateNote')}
        </p>

        <p className="mt-2 text-base text-muted-foreground">
          {t('dash.stateComparator')}
        </p>
        <p className="mt-2 text-base text-muted-foreground">{t('dash.iloCaveat')}</p>
      </section>

      {/* ── Tier distribution ────────────────────────────────────────────── */}
      <section className="mt-8">
        <h2 className="text-lg font-bold">{t('dash.tierDistribution')}</h2>
        <ul className="mt-3 space-y-2">
          {tiers.map((row) => (
            <li key={row.tier}>
              <div className="flex items-baseline justify-between gap-3 text-base">
                <span className="font-semibold">
                  {row.tier} · {t(TIER_LABEL[row.tier] ?? 'result.tier1')}
                </span>
                <span className="tabular-nums text-muted-foreground">
                  {row.count} ({row.share.toFixed(1)}%)
                </span>
              </div>
              {/* Sequential scale, matching the tier ramp used everywhere else. */}
              <div className="mt-1 h-5 w-full rounded-sm bg-neutral-200">
                <div
                  className="h-5 rounded-sm"
                  style={{
                    width: `${Math.max(1, row.share)}%`,
                    backgroundColor: `var(--tier-${row.tier})`,
                  }}
                />
              </div>
            </li>
          ))}
        </ul>
      </section>

      {/* ── Detection cascade ────────────────────────────────────────────── */}
      <section className="mt-8">
        <h2 className="text-lg font-bold">{t('dash.cascade')}</h2>
        <ul className="mt-3 space-y-2">
          {cascade.map((step) => {
            const pct =
              cohort.registered === 0 ? 0 : (step.value / cohort.registered) * 100;
            return (
              <li key={step.label}>
                <div className="flex items-baseline justify-between gap-3 text-base">
                  <span className="font-semibold">{t(step.label)}</span>
                  <span className="tabular-nums text-muted-foreground">
                    {step.value} ({pct.toFixed(1)}%)
                  </span>
                </div>
                <div className="mt-1 h-5 w-full rounded-sm bg-neutral-200">
                  <div
                    className="h-5 rounded-sm"
                    style={{
                      width: `${Math.max(1, pct)}%`,
                      backgroundColor: 'var(--tier-3)',
                    }}
                  />
                </div>
              </li>
            );
          })}
        </ul>
      </section>

      {/* ── Districts ────────────────────────────────────────────────────── */}
      <section className="mt-8">
        <h2 className="text-lg font-bold">{t('dash.byDistrict')}</h2>
        <div className="mt-3 overflow-x-auto">
          <table className="w-full min-w-[34rem] border-collapse text-base">
            <thead>
              <tr className="border-b-2" style={{ borderColor: 'var(--field-rule)' }}>
                <th className="px-2 py-2 text-left font-semibold">{t('dash.district')}</th>
                <th className="px-2 py-2 text-right font-semibold">{t('dash.workers')}</th>
                <th className="px-2 py-2 text-right font-semibold">{t('dash.priority')}</th>
                <th className="px-2 py-2 text-right font-semibold">{t('dash.attended')}</th>
                <th className="px-2 py-2 text-right font-semibold">{t('dash.abnormal')}</th>
                <th className="px-2 py-2 text-right font-semibold">
                  {t('dash.certifiedCount')}
                </th>
              </tr>
            </thead>
            <tbody>
              {districts.map((row) => (
                <tr
                  key={row.district}
                  className="border-b"
                  style={{ borderColor: 'var(--field-rule)' }}
                >
                  <td className="px-2 py-3 font-semibold">
                    {t(`district.${row.district}` as StringKey)}
                  </td>
                  <td className="px-2 py-3 text-right tabular-nums">{row.workers}</td>
                  <td className="px-2 py-3 text-right tabular-nums">
                    {row.priority}{' '}
                    <span className="text-muted-foreground">
                      ({row.priorityShare.toFixed(0)}%)
                    </span>
                  </td>
                  <td className="px-2 py-3 text-right tabular-nums">{row.attended}</td>
                  <td className="px-2 py-3 text-right tabular-nums">{row.abnormal}</td>
                  <td className="px-2 py-3 text-right tabular-nums">{row.certified}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* ── Portal stages ────────────────────────────────────────────────── */}
      <section className="mt-8">
        <h2 className="text-lg font-bold">{t('dash.portalFunnel')}</h2>
        <ul className="mt-3 space-y-2">
          {funnel.stages.map((stage) => (
            <li key={stage.stage}>
              <div className="flex items-baseline justify-between gap-3 text-base">
                <span className="font-semibold">
                  {t(`stage.${stage.stage}` as StringKey)}
                </span>
                <span className="tabular-nums text-muted-foreground">
                  {stage.reached} {t('dash.of')} {funnel.total} (
                  {stage.reachedShare.toFixed(0)}%)
                </span>
              </div>
              <div className="mt-1 h-5 w-full rounded-sm bg-neutral-200">
                <div
                  className="h-5 rounded-sm"
                  style={{
                    width: `${Math.max(1, stage.reachedShare)}%`,
                    backgroundColor: 'var(--tier-4)',
                  }}
                />
              </div>
            </li>
          ))}
        </ul>
      </section>

      <Disclaimers />
    </div>
  );
}
