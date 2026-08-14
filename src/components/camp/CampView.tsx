'use client';

import Link from 'next/link';

import { useLocale } from '@/components/field/locale';
import { Disclaimers, TierBadge } from '@/components/field/result';
import type { CampPlan } from '@/lib/camp/planner';
import type { StringKey } from '@/lib/i18n';

export interface CampViewProps {
  plan: CampPlan;
  districts: readonly string[];
  blocks: readonly string[];
  district: string;
  block: string | null;
  capacity: number;
  clustered: boolean;
}

function href(params: {
  district: string;
  block?: string | null;
  capacity: number;
  clustered: boolean;
}): string {
  const search = new URLSearchParams({
    district: params.district,
    capacity: String(params.capacity),
  });
  if (params.block != null && params.block !== '') search.set('block', params.block);
  if (!params.clustered) search.set('clustered', '0');
  return `/camp?${search.toString()}`;
}

/** Server-rendered filter chips — links, not JS. Works with no client bundle. */
function Chip({
  active,
  to,
  children,
}: {
  active: boolean;
  to: string;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={to}
      className={[
        'inline-flex min-h-11 items-center rounded-md border-2 px-4 text-base font-semibold',
        active ? 'bg-foreground text-white' : 'bg-white text-foreground',
      ].join(' ')}
      style={{ borderColor: 'var(--field-rule)' }}
    >
      {children}
    </Link>
  );
}

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

export function CampView({
  plan,
  districts,
  blocks,
  district,
  block,
  capacity,
  clustered,
}: CampViewProps) {
  const { t, locale } = useLocale();
  const { enrichment } = plan;

  return (
    <div className="mx-auto w-full max-w-4xl px-4 py-6">
      <h1 className="text-2xl font-bold">{t('camp.title')}</h1>
      <p className="mt-1 text-base text-muted-foreground">{t('camp.subtitle')}</p>

      {/* --- Filters --- */}
      <section className="mt-6 space-y-4">
        <div>
          <p className="mb-2 text-base font-semibold">{t('camp.district')}</p>
          <div className="flex flex-wrap gap-2">
            {districts.map((name) => (
              <Chip
                key={name}
                active={name === district}
                to={href({ district: name, capacity, clustered })}
              >
                {t(`district.${name}` as StringKey)}
              </Chip>
            ))}
          </div>
        </div>

        <div>
          <p className="mb-2 text-base font-semibold">{t('camp.block')}</p>
          <div className="flex flex-wrap gap-2">
            <Chip
              active={block === null}
              to={href({ district, block: null, capacity, clustered })}
            >
              {t('camp.allBlocks')}
            </Chip>
            {blocks.map((name) => (
              <Chip
                key={name}
                active={name === block}
                to={href({ district, block: name, capacity, clustered })}
              >
                {name}
              </Chip>
            ))}
          </div>
        </div>

        <div className="flex flex-wrap gap-6">
          <div>
            <p className="mb-2 text-base font-semibold">{t('camp.capacity')}</p>
            <div className="flex flex-wrap gap-2">
              {[20, 30, 40, 50].map((size) => (
                <Chip
                  key={size}
                  active={size === capacity}
                  to={href({ district, block, capacity: size, clustered })}
                >
                  {size}
                </Chip>
              ))}
            </div>
          </div>

          <div>
            <p className="mb-2 text-base font-semibold">{t('camp.clustering')}</p>
            <div className="flex flex-wrap gap-2">
              <Chip
                active={clustered}
                to={href({ district, block, capacity, clustered: true })}
              >
                {t('camp.clusterOn')}
              </Chip>
              <Chip
                active={!clustered}
                to={href({ district, block, capacity, clustered: false })}
              >
                {t('camp.clusterOff')}
              </Chip>
            </div>
          </div>
        </div>
      </section>

      {/* --- The targeting argument --- */}
      <section className="mt-8">
        <h2 className="text-lg font-bold">{t('camp.enrichment')}</h2>
        <dl className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-3">
          <Stat
            label="camp.selectedMean"
            value={enrichment.selectedMeanExposure.toFixed(2)}
            unit="mg/m³·yr"
          />
          <Stat
            label="camp.poolMean"
            value={enrichment.poolMeanExposure.toFixed(2)}
            unit="mg/m³·yr"
          />
          <Stat
            label="camp.ratio"
            value={`${enrichment.exposureRatio.toFixed(1)}×`}
          />
        </dl>

        <dl className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-3">
          <Stat
            label="camp.highTierShare"
            value={`${enrichment.selectedHighTierShare.toFixed(0)}%`}
            unit={`vs ${enrichment.poolHighTierShare.toFixed(0)}%`}
          />
          <Stat label="camp.villagesToVisit" value={String(enrichment.villagesToVisit)} />
          <Stat
            label="camp.eligible"
            value={String(plan.selected.length)}
            unit={`${t('camp.ofEligible')} ${plan.eligibleCount}`}
          />
        </dl>

        {/* Guard-rail. The number above is about exposure, not about cases. */}
        <p
          className="mt-3 rounded-md border-2 p-4 text-base"
          style={{
            borderColor: 'var(--field-rule)',
            backgroundColor: 'var(--field-notice)',
          }}
        >
          {t('camp.notCases')}
        </p>

        {plan.excludedCount > 0 && (
          <p className="mt-3 text-base">
            <strong className="tabular-nums">{plan.excludedCount}</strong>{' '}
            {t('camp.excluded')} — {t('camp.excludedWhy')}
          </p>
        )}
      </section>

      {/* --- Villages --- */}
      {plan.villages.length > 0 && (
        <section className="mt-8">
          <h2 className="text-lg font-bold">{t('camp.villagesToVisit')}</h2>
          <ul className="mt-3 flex flex-wrap gap-2">
            {plan.villages.map((cluster) => (
              <li
                key={cluster.village}
                className="rounded-md border-2 px-4 py-2 text-base"
                style={{ borderColor: 'var(--field-rule)' }}
              >
                <span className="font-semibold">{cluster.village}</span>{' '}
                <span className="tabular-nums text-muted-foreground">
                  {cluster.selected}/{cluster.eligible}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* --- The call list --- */}
      <section className="mt-8">
        <h2 className="text-lg font-bold">{t('camp.title')}</h2>

        {plan.selected.length === 0 ? (
          <p className="mt-3 text-base">{t('camp.emptyList')}</p>
        ) : (
          // Horizontal scroll is contained here, never on the page body.
          <div className="mt-3 overflow-x-auto">
            <table className="w-full min-w-[36rem] border-collapse text-base">
              <thead>
                <tr className="border-b-2" style={{ borderColor: 'var(--field-rule)' }}>
                  <th className="px-2 py-2 text-left font-semibold">{t('camp.rank')}</th>
                  <th className="px-2 py-2 text-left font-semibold">{t('camp.worker')}</th>
                  <th className="px-2 py-2 text-left font-semibold">{t('camp.village')}</th>
                  <th className="px-2 py-2 text-right font-semibold">{t('camp.age')}</th>
                  <th className="px-2 py-2 text-left font-semibold">{t('result.tier')}</th>
                  <th className="px-2 py-2 text-right font-semibold">
                    {t('camp.exposure')}
                  </th>
                </tr>
              </thead>
              <tbody>
                {plan.selected.map((worker) => (
                  <tr
                    key={worker.workerId}
                    className="border-b"
                    style={{ borderColor: 'var(--field-rule)' }}
                  >
                    <td className="px-2 py-3 tabular-nums font-bold">{worker.rank}</td>
                    <td className="px-2 py-3">
                      <span className="font-semibold">{worker.name}</span>
                      {/*
                        Truncated, with the full value on hover and for screen
                        readers. Seeded IDs are short (SYN-00336) but a worker
                        registered in the field gets a UUID — 38 characters,
                        which wrapped onto a second line and made its row 27%
                        taller than its neighbours, breaking the scan down the
                        list that this column exists to support.
                      */}
                      <span
                        className="block max-w-[16ch] truncate text-sm tabular-nums text-muted-foreground"
                        title={worker.workerId}
                      >
                        {worker.workerId}
                      </span>
                      {worker.insufficientData && (
                        <span className="block text-sm font-semibold">
                          {t('camp.incompleteFlag')}
                        </span>
                      )}
                    </td>
                    <td className="px-2 py-3">{worker.village}</td>
                    <td className="px-2 py-3 text-right tabular-nums">{worker.age}</td>
                    <td className="px-2 py-3">
                      <TierBadge tier={worker.tier} compact />
                    </td>
                    <td className="px-2 py-3 text-right tabular-nums">
                      {worker.cumulativeExposure.toFixed(2)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <Disclaimers />

      <p className="mt-6 text-sm text-muted-foreground">
        {locale === 'hi' ? 'कृत्रिम डेटा' : 'Synthetic data'} · {plan.eligibleCount}{' '}
        {t('camp.eligible').toLowerCase()}
      </p>
    </div>
  );
}
