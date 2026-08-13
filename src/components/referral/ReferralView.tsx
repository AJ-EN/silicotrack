'use client';

import { useLocale } from '@/components/field/locale';
import { Disclaimers, TierBadge } from '@/components/field/result';
import type { Funnel } from '@/lib/referral/funnel';
import { STALLED_DAYS } from '@/lib/referral/stages';
import type { Tier } from '@/lib/risk/types';
import type { StringKey } from '@/lib/i18n';

export interface StalledRow {
  id: string;
  workerId: string;
  name: string;
  village: string;
  district: string;
  status: string;
  daysInStage: number;
  toBoard: string;
  tier: Tier | null;
}

export interface ReferralViewProps {
  funnel: Funnel;
  stalled: StalledRow[];
}

function stageLabel(stage: string): StringKey {
  return `stage.${stage}` as StringKey;
}

function Stat({ label, value, unit }: { label: StringKey; value: string; unit?: string }) {
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

export function ReferralView({ funnel, stalled }: ReferralViewProps) {
  const { t } = useLocale();

  return (
    <div className="mx-auto w-full max-w-4xl px-4 py-6">
      <h1 className="text-2xl font-bold">{t('ref.title')}</h1>
      <p className="mt-1 text-base text-muted-foreground">{t('ref.subtitle')}</p>

      <dl className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat label="ref.total" value={String(funnel.total)} />
        <Stat label="ref.inProgress" value={String(funnel.inProgress)} />
        <Stat label="ref.certified" value={String(funnel.certifiedTotal)} />
        <Stat label="ref.stalled" value={String(funnel.stalledTotal)} />
      </dl>

      {funnel.awaitingPayment > 0 && (
        <p className="mt-3 text-base">
          <strong className="tabular-nums">{funnel.awaitingPayment}</strong>{' '}
          {t('ref.awaitingPayment')} — {t('ref.awaitingPaymentNote')}
        </p>
      )}

      {/* --- The headline: where the pipeline leaks hardest --- */}
      {funnel.biggestLoss !== null && (
        <p
          className="mt-4 rounded-md border-2 p-4 text-base"
          style={{
            borderColor: 'var(--field-rule)',
            backgroundColor: 'var(--field-notice)',
          }}
        >
          <strong>{t('ref.biggestLoss')}:</strong>{' '}
          {t(stageLabel(funnel.biggestLoss.stage))} —{' '}
          <span className="tabular-nums font-bold">{funnel.biggestLoss.lost}</span>{' '}
          {t('ref.lostHere')} ({funnel.biggestLoss.lostShare.toFixed(1)}%)
        </p>
      )}

      {/* --- Funnel --- */}
      <section className="mt-8">
        <h2 className="text-lg font-bold">{t('ref.funnel')}</h2>
        <ul className="mt-4 space-y-3">
          {funnel.stages.map((stage) => (
            <li key={stage.stage}>
              <div className="flex flex-wrap items-baseline justify-between gap-2 text-base">
                <span className="font-semibold">{t(stageLabel(stage.stage))}</span>
                <span className="tabular-nums text-muted-foreground">
                  {stage.reached} {t('ref.reached')} ({stage.reachedShare.toFixed(0)}%)
                  {stage.medianDays !== null && (
                    <> · {stage.medianDays} {t('ref.medianDays')}</>
                  )}
                </span>
              </div>

              {/* Width encodes the share still in the pipeline at this stage.
                  A sequential ramp, never red/green — this is attrition, not a
                  verdict on anyone. */}
              <div className="mt-1 h-6 w-full rounded-sm bg-neutral-200">
                <div
                  className="flex h-6 items-center rounded-sm px-2"
                  style={{
                    width: `${Math.max(2, stage.reachedShare)}%`,
                    backgroundColor: 'var(--tier-3)',
                    color: 'var(--tier-3-ink)',
                  }}
                >
                  <span className="text-sm font-bold tabular-nums">{stage.reached}</span>
                </div>
              </div>

              <p className="mt-1 text-sm text-muted-foreground">
                {stage.lost > 0 && (
                  // A certified-but-unpaid worker was FOUND. Rendering that
                  // with the same words as a worker who fell out would
                  // overstate detection failure.
                  <span className="font-semibold">
                    {stage.lossKind === 'awaiting_payment' ? (
                      <>
                        {stage.lost} {t('ref.awaitingPayment')}
                      </>
                    ) : (
                      <>
                        −{stage.lost} {t('ref.lostHere')} ({stage.lostShare.toFixed(0)}%)
                      </>
                    )}
                  </span>
                )}
                {stage.current > 0 && (
                  <>
                    {stage.lost > 0 && ' · '}
                    {stage.current} {t('ref.currentlyHere')}
                    {stage.stalled > 0 && (
                      <span className="font-semibold"> ({stage.stalled} {t('ref.stalled')})</span>
                    )}
                  </>
                )}
              </p>
            </li>
          ))}
        </ul>
      </section>

      {/* --- Exits --- */}
      <section className="mt-8">
        <h2 className="text-lg font-bold">{t('ref.outcomes')}</h2>
        <ul className="mt-3 space-y-2">
          {funnel.terminal.map((outcome) => (
            <li
              key={outcome.stage}
              className="rounded-md border-2 p-4"
              style={{ borderColor: 'var(--field-rule)' }}
            >
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <span className="text-base font-semibold">
                  {t(stageLabel(outcome.stage))}
                </span>
                <span className="tabular-nums">
                  <strong>{outcome.count}</strong>{' '}
                  <span className="text-muted-foreground">
                    ({outcome.share.toFixed(1)}%)
                  </span>
                </span>
              </div>
              {outcome.lostFrom.length > 0 && (
                <p className="mt-1 text-sm text-muted-foreground">
                  {t('ref.lostFrom')}:{' '}
                  {outcome.lostFrom
                    .map((origin) => `${t(stageLabel(origin.stage))} (${origin.count})`)
                    .join(', ')}
                </p>
              )}
            </li>
          ))}
        </ul>

        {/* The project's central claim, stated where the data supports it. */}
        <p
          className="mt-3 rounded-md border-2 p-4 text-base"
          style={{
            borderColor: 'var(--field-rule)',
            backgroundColor: 'var(--field-notice)',
          }}
        >
          {t('ref.noSymptomsNote')}
        </p>
      </section>

      {/* --- Stalled --- */}
      <section className="mt-8">
        <h2 className="text-lg font-bold">
          {t('ref.stalledList')}{' '}
          <span className="tabular-nums text-muted-foreground">({stalled.length})</span>
        </h2>
        <p className="mt-1 text-base text-muted-foreground">{t('ref.stalledWhy')}</p>

        {stalled.length === 0 ? (
          <p className="mt-3 text-base">{t('ref.stalledNone')}</p>
        ) : (
          <div className="mt-3 overflow-x-auto">
            <table className="w-full min-w-[38rem] border-collapse text-base">
              <thead>
                <tr className="border-b-2" style={{ borderColor: 'var(--field-rule)' }}>
                  <th className="px-2 py-2 text-left font-semibold">{t('ref.worker')}</th>
                  <th className="px-2 py-2 text-left font-semibold">{t('ref.stage')}</th>
                  <th className="px-2 py-2 text-right font-semibold">{t('ref.days')}</th>
                  <th className="px-2 py-2 text-left font-semibold">{t('result.tier')}</th>
                  <th className="px-2 py-2 text-left font-semibold">{t('ref.board')}</th>
                </tr>
              </thead>
              <tbody>
                {stalled.map((row) => (
                  <tr
                    key={row.id}
                    className="border-b"
                    style={{ borderColor: 'var(--field-rule)' }}
                  >
                    <td className="px-2 py-3">
                      <span className="font-semibold">{row.name}</span>
                      <span className="block text-sm text-muted-foreground">
                        {row.village}, {row.district}
                      </span>
                    </td>
                    <td className="px-2 py-3">{t(stageLabel(row.status))}</td>
                    <td className="px-2 py-3 text-right tabular-nums font-bold">
                      {row.daysInStage}
                    </td>
                    <td className="px-2 py-3">
                      {row.tier === null ? '—' : <TierBadge tier={row.tier} compact />}
                    </td>
                    <td className="px-2 py-3 text-sm">{row.toBoard}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <Disclaimers />

      <p className="mt-6 text-sm text-muted-foreground tabular-nums">
        Synthetic data · stall threshold {STALLED_DAYS} days
      </p>
    </div>
  );
}
