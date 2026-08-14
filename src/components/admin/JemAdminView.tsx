'use client';

import { useMemo, useState } from 'react';

import { useLocale } from '@/components/field/locale';
import { Disclaimers } from '@/components/field/result';
import { assessRisk } from '@/lib/risk/engine';
import {
  ANCHOR_TARGET_MG_M3,
  ANCHOR_TOLERANCE_MG_M3,
  JEM,
  JEM_TASK_ORDER,
  MINE_TASK_MIX,
  type JemTaskCode,
} from '@/lib/risk/jem';
import type {
  ExposureSegmentInput,
  IntensityOverrides,
  SmokingStatus,
  Tier,
} from '@/lib/risk/types';
import type { StringKey } from '@/lib/i18n';

/**
 * The JEM admin screen (CLAUDE.md §7).
 *
 * The single biggest technical risk in this project is that a validated
 * Rajasthan sandstone job-exposure matrix does not exist, so every coefficient
 * in it is provisional. The design answer is not to hide that — it is to make
 * the matrix inspectable and correctable by the people qualified to correct
 * it, and to show immediately what any proposed change would do to real
 * screening priority.
 *
 * Recomputation runs in the browser over the whole cohort. The engine is a
 * pure function of a few hundred lines, so 500 workers re-score in a few
 * milliseconds and the feedback is instant — which is the point. A domain
 * expert should be able to drag a number and watch the tiers move.
 *
 * NOTHING IS PERSISTED. See the notice rendered at the top.
 */

export interface CohortMember {
  workerId: string;
  smokingStatus: SmokingStatus;
  priorTB: boolean;
  segments: ExposureSegmentInput[];
}

export interface JemAdminViewProps {
  cohort: CohortMember[];
  referenceDate: string;
}

const TIERS: Tier[] = [1, 2, 3, 4];

const TIER_LABEL: Record<Tier, StringKey> = {
  1: 'result.tier1',
  2: 'result.tier2',
  3: 'result.tier3',
  4: 'result.tier4',
};

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

/** Weighted mean over the mine task mix, honouring proposed values. */
function weightedMean(valueOf: (code: JemTaskCode) => number): number {
  let weightSum = 0;
  let total = 0;
  for (const [code, weight] of Object.entries(MINE_TASK_MIX)) {
    if (weight === undefined) continue;
    weightSum += weight;
    total += valueOf(code as JemTaskCode) * weight;
  }
  return weightSum === 0 ? 0 : total / weightSum;
}

export function JemAdminView({ cohort, referenceDate }: JemAdminViewProps) {
  const { t, locale } = useLocale();
  const [proposed, setProposed] = useState<Record<string, number>>({});

  const valueOf = (code: JemTaskCode): number =>
    proposed[code] ?? JEM[code].intensityMgM3;

  const overrides = useMemo<IntensityOverrides>(() => {
    const map: Record<string, number> = {};
    for (const code of JEM_TASK_ORDER) {
      if (proposed[code] !== undefined) map[code] = proposed[code];
    }
    return map as IntensityOverrides;
  }, [proposed]);

  const changedCount = Object.keys(overrides).length;

  /**
   * Both distributions in one pass. Recomputed only when a coefficient moves,
   * so typing in an unrelated field costs nothing.
   */
  const effect = useMemo(() => {
    const committedTiers: Record<Tier, number> = { 1: 0, 2: 0, 3: 0, 4: 0 };
    const proposedTiers: Record<Tier, number> = { 1: 0, 2: 0, 3: 0, 4: 0 };
    let up = 0;
    let down = 0;

    for (const member of cohort) {
      const base = {
        segments: member.segments,
        worker: { smokingStatus: member.smokingStatus, priorTB: member.priorTB },
        referenceDate,
      };
      const before = assessRisk(base).tier;
      const after =
        changedCount === 0 ? before : assessRisk({ ...base, intensityOverrides: overrides }).tier;

      committedTiers[before] += 1;
      proposedTiers[after] += 1;
      if (after > before) up += 1;
      if (after < before) down += 1;
    }

    return { committedTiers, proposedTiers, up, down };
  }, [cohort, referenceDate, overrides, changedCount]);

  const mean = weightedMean(valueOf);
  const anchorOk = Math.abs(mean - ANCHOR_TARGET_MG_M3) <= ANCHOR_TOLERANCE_MG_M3;

  const total = cohort.length;
  const share = (n: number): number => (total === 0 ? 0 : (n / total) * 100);

  function exportProposal(): void {
    const payload = JEM_TASK_ORDER.map((code) => ({
      taskCode: code,
      committed: JEM[code].intensityMgM3,
      proposed: valueOf(code),
    })).filter((row) => row.committed !== row.proposed);

    void navigator.clipboard?.writeText(JSON.stringify(payload, null, 2));
  }

  return (
    <div className="mx-auto w-full max-w-4xl px-4 py-6">
      <h1 className="text-2xl font-bold">{t('jem.title')}</h1>
      <p className="mt-1 text-base text-muted-foreground">{t('jem.subtitle')}</p>

      {/* The guard-rail, stated before anything is editable. */}
      <p
        className="mt-4 rounded-md border-2 p-4 text-base"
        style={{
          borderColor: 'var(--field-rule)',
          backgroundColor: 'var(--field-notice)',
        }}
      >
        {t('jem.sandboxNotice')}
      </p>

      {/* --- Anchor --- */}
      <section className="mt-8">
        <h2 className="text-lg font-bold">{t('jem.anchor')}</h2>
        <p className="mt-1 text-base text-muted-foreground">{t('jem.anchorExplain')}</p>
        <div
          className="mt-3 flex flex-wrap items-baseline gap-x-6 gap-y-2 rounded-md border-2 p-4"
          style={{
            borderColor: 'var(--field-rule)',
            backgroundColor: anchorOk ? undefined : 'var(--field-notice)',
          }}
        >
          <span className="text-base">
            {t('jem.anchorMean')}{' '}
            <strong className="text-xl tabular-nums">{mean.toFixed(3)}</strong> mg/m³
          </span>
          <span className="text-base text-muted-foreground">
            {t('jem.anchorTarget')} {ANCHOR_TARGET_MG_M3.toFixed(2)} ±{' '}
            {ANCHOR_TOLERANCE_MG_M3.toFixed(2)}
          </span>
          <span className="text-base font-bold">
            {anchorOk ? t('jem.anchorOk') : t('jem.anchorBreached')}
          </span>
        </div>
      </section>

      {/* --- Cohort effect --- */}
      <section className="mt-8">
        <h2 className="text-lg font-bold">
          {t('jem.cohortEffect')}{' '}
          <span className="text-base font-normal text-muted-foreground tabular-nums">
            ({total} {t('jem.workers')})
          </span>
        </h2>

        <ul className="mt-3 space-y-3">
          {TIERS.map((tier) => {
            const before = effect.committedTiers[tier];
            const after = effect.proposedTiers[tier];
            const delta = after - before;
            return (
              <li key={tier}>
                <div className="flex flex-wrap items-baseline justify-between gap-2 text-base">
                  <span className="font-semibold">
                    {tier} · {t(TIER_LABEL[tier])}
                  </span>
                  <span className="tabular-nums text-muted-foreground">
                    {before} → <strong className="text-foreground">{after}</strong>
                    {delta !== 0 && (
                      <span className="ml-2 font-bold">
                        ({delta > 0 ? '+' : ''}
                        {delta})
                      </span>
                    )}
                  </span>
                </div>

                {/* Committed above, proposed below, on one shared scale so the
                    two bars are directly comparable. */}
                <div className="mt-1 space-y-1">
                  <div className="h-3 w-full rounded-sm bg-neutral-200">
                    <div
                      className="h-3 rounded-sm opacity-45"
                      style={{
                        width: `${Math.max(0.5, share(before))}%`,
                        backgroundColor: `var(--tier-${tier})`,
                      }}
                    />
                  </div>
                  <div className="h-5 w-full rounded-sm bg-neutral-200">
                    <div
                      className="h-5 rounded-sm"
                      style={{
                        width: `${Math.max(0.5, share(after))}%`,
                        backgroundColor: `var(--tier-${tier})`,
                      }}
                    />
                  </div>
                </div>
              </li>
            );
          })}
        </ul>

        <p className="mt-4 text-base">
          {effect.up === 0 && effect.down === 0 ? (
            <span className="text-muted-foreground">{t('jem.unchanged')}</span>
          ) : (
            <>
              <strong className="tabular-nums">{effect.up}</strong> {t('jem.movedUp')} ·{' '}
              <strong className="tabular-nums">{effect.down}</strong> {t('jem.movedDown')}
            </>
          )}
        </p>
      </section>

      {/* --- The matrix --- */}
      <section className="mt-8">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-lg font-bold">
            {t('jem.changed')}{' '}
            <span className="tabular-nums text-muted-foreground">({changedCount})</span>
          </h2>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setProposed({})}
              disabled={changedCount === 0}
              className="tap rounded-md border-2 px-4 text-base font-semibold disabled:opacity-40"
              style={{ borderColor: 'var(--field-rule)' }}
            >
              {t('jem.reset')}
            </button>
            <button
              type="button"
              onClick={exportProposal}
              disabled={changedCount === 0}
              className="tap rounded-md border-2 px-4 text-base font-semibold text-white disabled:opacity-40"
              style={{
                borderColor: 'var(--field-rule)',
                backgroundColor: 'var(--tier-4)',
              }}
            >
              {t('jem.export')}
            </button>
          </div>
        </div>

        <ul className="mt-4 space-y-3">
          {JEM_TASK_ORDER.map((code) => {
            const entry = JEM[code];
            const value = valueOf(code);
            const dirty = value !== entry.intensityMgM3;
            const outOfRange = value < entry.rangeLow || value > entry.rangeHigh;

            return (
              <li
                key={code}
                className="rounded-md border-2 p-4"
                style={{ borderColor: 'var(--field-rule)' }}
              >
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <span className="text-base font-bold">
                    {locale === 'hi' ? entry.labelHi : entry.labelEn}
                  </span>
                  <span className="text-sm tabular-nums text-muted-foreground">{code}</span>
                </div>

                <div className="mt-3 flex flex-wrap items-center gap-3">
                  <label className="flex items-center gap-2 text-base">
                    <span className="text-muted-foreground">{t('jem.proposed')}</span>
                    <input
                      type="number"
                      step="0.005"
                      min="0"
                      max="2"
                      value={value}
                      onChange={(event) => {
                        const next = Number.parseFloat(event.target.value);
                        setProposed((current) => ({
                          ...current,
                          [code]: Number.isFinite(next) ? next : entry.intensityMgM3,
                        }));
                      }}
                      className="tap w-32 rounded-md border-2 px-3 text-lg font-bold tabular-nums"
                      style={{ borderColor: 'var(--field-rule)' }}
                    />
                    <span className="text-sm text-muted-foreground">mg/m³</span>
                  </label>

                  {dirty && (
                    <span className="text-sm tabular-nums text-muted-foreground">
                      {t('jem.committed')} {entry.intensityMgM3}
                    </span>
                  )}
                </div>

                <p className="mt-2 text-sm text-muted-foreground">
                  {t('jem.range')} {entry.rangeLow}–{entry.rangeHigh} · {t('jem.confidence')}{' '}
                  {entry.confidence}
                  {outOfRange && (
                    <strong className="ml-2 text-foreground">{t('jem.outOfRange')}</strong>
                  )}
                </p>
                <p className="mt-1 text-sm text-muted-foreground">
                  {t('jem.source')}: {entry.source}
                </p>
              </li>
            );
          })}
        </ul>
      </section>

      <Disclaimers />

      <p className="mt-6 text-sm tabular-nums text-muted-foreground">
        {round2(total)} synthetic workers · reference {referenceDate}
      </p>
    </div>
  );
}
