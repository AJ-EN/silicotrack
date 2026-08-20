'use client';

/**
 * The exposure interview.
 *
 * Four steps, target six minutes per worker. Everything runs on the device:
 * the risk engine is a pure function, so the tier is computed locally with no
 * network at any point. The record is written to IndexedDB before the UI
 * reports success, and leaves the phone later.
 *
 * The interview never asks about symptoms. Early silicosis has none, which is
 * the entire reason this system exists — 57.6% of applicants to the state
 * portal are rejected at CHC level for lacking them.
 */

import { useMemo, useState } from 'react';

import {
  ChoiceGroup,
  NumberStepper,
  PrimaryButton,
  SecondaryButton,
  TextField,
  YesNoToggle,
  type Choice,
} from '@/components/field/controls';
import { useLocale } from '@/components/field/locale';
import { RiskResultPanel } from '@/components/field/result';
import { OfflineNotice, SyncStatusBar, useOnlineStatus } from '@/components/field/status';
import { assessRisk } from '@/lib/risk/engine';
import { JEM, JEM_TASK_ORDER } from '@/lib/risk/jem';
import type { ExposureSegmentInput, SmokingStatus } from '@/lib/risk/types';
import { flushOutbox } from '@/lib/sync/flush';
import { enqueue } from '@/lib/sync/outbox';
import { refreshPending } from '@/lib/sync/store';
import {
  fieldSubmissionSchema,
  workerDraftSchema,
  type ExposureSegmentDraft,
} from '@/lib/validation/field';
import type { StringKey } from '@/lib/i18n';

const DISTRICTS = ['Karauli', 'Jodhpur', 'Dausa', 'Bhilwara'] as const;

const SEX_CHOICES: readonly Choice<'male' | 'female' | 'other'>[] = [
  { value: 'male', label: 'worker.sex.male' },
  { value: 'female', label: 'worker.sex.female' },
  { value: 'other', label: 'worker.sex.other' },
];

const SMOKING_CHOICES: readonly Choice<SmokingStatus>[] = [
  { value: 'never', label: 'health.smoking.never' },
  { value: 'former', label: 'health.smoking.former' },
  { value: 'current', label: 'health.smoking.current' },
];

const MATERIAL_CHOICES: readonly Choice<
  'sandstone' | 'quartzite' | 'granite' | 'other'
>[] = [
    { value: 'sandstone', label: 'segment.material.sandstone' },
    { value: 'quartzite', label: 'segment.material.quartzite' },
    { value: 'granite', label: 'segment.material.granite' },
    { value: 'other', label: 'segment.material.other' },
  ];

const METHOD_CHOICES: readonly Choice<'wet' | 'dry'>[] = [
  { value: 'wet', label: 'segment.method.wet' },
  { value: 'dry', label: 'segment.method.dry' },
];

const ENCLOSURE_CHOICES: readonly Choice<'open' | 'enclosed'>[] = [
  { value: 'open', label: 'segment.enclosure.open' },
  { value: 'enclosed', label: 'segment.enclosure.enclosed' },
];

const PPE_CHOICES: readonly Choice<'none' | 'intermittent' | 'consistent'>[] = [
  { value: 'none', label: 'segment.ppe.none' },
  { value: 'intermittent', label: 'segment.ppe.intermittent' },
  { value: 'consistent', label: 'segment.ppe.consistent' },
];

const SITE_CHOICES: readonly Choice<'surface' | 'underground'>[] = [
  { value: 'surface', label: 'segment.siteType.surface' },
  { value: 'underground', label: 'segment.siteType.underground' },
];

const DURATION_CERTAINTY_CHOICES: readonly Choice<
  'exact' | 'approximate' | 'not_sure'
>[] = [
    { value: 'exact', label: 'segment.duration.exact' },
    { value: 'approximate', label: 'segment.duration.approximate' },
    { value: 'not_sure', label: 'segment.duration.notSure' },
  ];

const FREQUENCY_PATTERN_CHOICES: readonly Choice<
  'regular' | 'seasonal_migrant' | 'approximate' | 'not_sure'
>[] = [
    { value: 'regular', label: 'segment.frequency.regular' },
    { value: 'seasonal_migrant', label: 'segment.frequency.seasonal' },
    { value: 'approximate', label: 'segment.frequency.approximate' },
    { value: 'not_sure', label: 'segment.frequency.notSure' },
  ];

interface IdentityDraft {
  name: string;
  age: number;
  sex: 'male' | 'female' | 'other';
  district: string;
  block: string;
  village: string;
  phone: string;
}

const STEP_LABELS: StringKey[] = ['field.step1', 'field.step2', 'field.step3', 'field.step4'];

function emptySegment(referenceYear: number): ExposureSegmentDraft {
  return {
    taskCode: 'LOAD',
    material: 'sandstone',
    method: 'dry',
    enclosure: 'open',
    ppeUse: 'none',
    siteType: 'surface',
    startYear: referenceYear - 5,
    endYear: null,
    monthsPerYear: 10,
    hoursPerDay: 8,
    durationCertainty: 'exact',
    frequencyPattern: 'regular',
    siteName: null,
  };
}

export function FieldInterview({ referenceDate }: { referenceDate: string }) {
  const { t, locale } = useLocale();
  const online = useOnlineStatus();
  const referenceYear = Number.parseInt(referenceDate.slice(0, 4), 10);

  const [step, setStep] = useState(0);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saved, setSaved] = useState<'no' | 'offline' | 'sent'>('no');
  const [outboxVersion, setOutboxVersion] = useState(0);

  const [identity, setIdentity] = useState<IdentityDraft>({
    name: '',
    age: 30,
    sex: 'male',
    district: DISTRICTS[0],
    block: '',
    village: '',
    phone: '',
  });
  const [smokingStatus, setSmokingStatus] = useState<SmokingStatus>('never');
  const [priorTB, setPriorTB] = useState(false);
  const [segments, setSegments] = useState<ExposureSegmentDraft[]>([
    emptySegment(referenceYear),
  ]);

  /**
   * Live tier. Recomputed on every keystroke because the engine is pure and
   * cheap — there is no server round trip to debounce.
   */
  const result = useMemo(
    () =>
      assessRisk({
        segments: segments as ExposureSegmentInput[],
        worker: { smokingStatus, priorTB },
        referenceDate,
      }),
    [segments, smokingStatus, priorTB, referenceDate],
  );

  function updateSegment(index: number, changes: Partial<ExposureSegmentDraft>): void {
    setSegments((current) =>
      current.map((segment, i) => (i === index ? { ...segment, ...changes } : segment)),
    );
  }

  function validateIdentity(): boolean {
    const parsed = workerDraftSchema
      .pick({ name: true, age: true, sex: true, district: true, block: true, village: true, phone: true })
      .safeParse({
        ...identity,
        phone: identity.phone.trim() === '' ? null : identity.phone.trim(),
      });

    if (parsed.success) {
      setErrors({});
      return true;
    }
    const next: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      const key = issue.path[0];
      if (typeof key === 'string' && next[key] === undefined) next[key] = issue.message;
    }
    setErrors(next);
    return false;
  }

  function validateSegments(): boolean {
    if (segments.length === 0) {
      setErrors({ segments: 'error.noSegments' });
      return false;
    }
    setErrors({});
    return true;
  }

  function goNext(): void {
    if (step === 0 && !validateIdentity()) return;
    if (step === 1 && !validateSegments()) return;
    setStep((current) => Math.min(3, current + 1));
  }

  async function save(): Promise<void> {
    const capturedAt = `${new Date().toISOString().slice(0, 19)}Z`;
    const submission = {
      workerId: `W-${crypto.randomUUID()}`,
      worker: {
        ...identity,
        name: identity.name.trim(),
        block: identity.block.trim(),
        village: identity.village.trim(),
        phone: identity.phone.trim() === '' ? null : identity.phone.trim(),
        smokingStatus,
        priorTB,
      },
      segments,
      capturedAt,
      referenceDate,
      // No real auth in the prototype — a demo role switcher stands in.
      createdBy: 'ASHA-DEMO',
    };

    const parsed = fieldSubmissionSchema(referenceYear).safeParse(submission);
    if (!parsed.success) {
      setErrors({ save: 'error.saveFailed' });
      return;
    }

    try {
      // Durable first. Reporting success from memory loses the interview if
      // the phone dies before the write lands.
      await enqueue(parsed.data);
      await refreshPending();
      setOutboxVersion((v) => v + 1);
      setSaved('offline');
    } catch {
      setErrors({ save: 'error.saveFailed' });
      return;
    }

    if (online) {
      const flushed = await flushOutbox();
      await refreshPending();
      setOutboxVersion((v) => v + 1);
      if (flushed.synced > 0) setSaved('sent');
    }
  }

  function reset(): void {
    setIdentity({
      name: '',
      age: 30,
      sex: 'male',
      district: DISTRICTS[0],
      block: '',
      village: '',
      phone: '',
    });
    setSmokingStatus('never');
    setPriorTB(false);
    setSegments([emptySegment(referenceYear)]);
    setErrors({});
    setSaved('no');
    setStep(0);
  }

  return (
    <div className="mx-auto w-full max-w-2xl">
      <SyncStatusBar refreshKey={outboxVersion} />

      <div className="px-4 py-5">
        {/* Progress. Numeric, not a decorative bar — it answers "how much
            longer", which is the only question a rushed interviewer has. */}
        <p className="text-base font-semibold text-muted-foreground">
          {t('field.step')} {step + 1} {t('field.of')} 4 · {t(STEP_LABELS[step] ?? 'field.step1')}
        </p>
        <div className="mt-2 flex gap-1" aria-hidden>
          {[0, 1, 2, 3].map((index) => (
            <span
              key={index}
              className="h-2 flex-1 rounded-sm"
              style={{
                backgroundColor: index <= step ? 'var(--tier-4)' : 'var(--tier-1)',
              }}
            />
          ))}
        </div>

        <div className="mt-6">
          {step === 0 && (
            <>
              <TextField
                label="worker.name"
                placeholder="worker.namePlaceholder"
                value={identity.name}
                onChange={(name) => setIdentity({ ...identity, name })}
                error={errors['name']}
                maxLength={120}
              />
              <NumberStepper
                label="worker.age"
                unit="worker.years"
                value={identity.age}
                min={15}
                max={100}
                onChange={(age) => setIdentity({ ...identity, age })}
                error={errors['age']}
              />
              <ChoiceGroup
                label="worker.sex"
                choices={SEX_CHOICES}
                value={identity.sex}
                onChange={(sex) => setIdentity({ ...identity, sex })}
              />
              <ChoiceGroup
                label="worker.district"
                choices={DISTRICTS.map((name) => ({
                  value: name,
                  label: `district.${name}` as StringKey,
                }))}
                value={identity.district}
                onChange={(district) => setIdentity({ ...identity, district })}
              />
              <TextField
                label="worker.block"
                value={identity.block}
                onChange={(block) => setIdentity({ ...identity, block })}
                error={errors['block']}
                maxLength={80}
              />
              <TextField
                label="worker.village"
                value={identity.village}
                onChange={(village) => setIdentity({ ...identity, village })}
                error={errors['village']}
                maxLength={80}
              />
              <TextField
                label="worker.phone"
                hint="worker.phoneOptional"
                inputMode="tel"
                value={identity.phone}
                onChange={(phone) => setIdentity({ ...identity, phone })}
                error={errors['phone']}
                maxLength={10}
              />
              <div
                className="mb-4 rounded-md border-2 p-4"
                style={{
                  borderColor: 'var(--field-rule)',
                  backgroundColor: 'var(--field-notice)',
                }}
              >
                <p className="text-base font-bold">{t('worker.tokenLabel')}</p>
                <p className="mt-1 text-base leading-[1.6]">{t('worker.tokenHint')}</p>
              </div>
              {/* Standing instruction, not a validation message. */}
              <p className="mb-6 text-base font-semibold">{t('worker.noAadhaar')}</p>
            </>
          )}

          {step === 1 && (
            <>
              <p className="mb-4 text-lg leading-[1.7]">{t('segment.intro')}</p>

              {segments.map((segment, index) => (
                <fieldset
                  key={index}
                  className="mb-6 rounded-md border-2 p-4"
                  style={{ borderColor: 'var(--field-rule)' }}
                >
                  <legend className="px-2 text-base font-bold">
                    {t('segment.number')} {index + 1}
                  </legend>

                  <ChoiceGroup
                    label="segment.task"
                    stack
                    // JEM carries its own bilingual labels, so task names stay
                    // in one place rather than being duplicated into i18n.
                    choices={JEM_TASK_ORDER.map((code) => ({
                      value: code,
                      text: locale === 'hi' ? JEM[code].labelHi : JEM[code].labelEn,
                    }))}
                    value={segment.taskCode}
                    onChange={(taskCode) => updateSegment(index, { taskCode })}
                  />

                  <ChoiceGroup
                    label="segment.material"
                    choices={MATERIAL_CHOICES}
                    value={segment.material}
                    onChange={(material) => updateSegment(index, { material })}
                  />
                  <ChoiceGroup
                    label="segment.method"
                    choices={METHOD_CHOICES}
                    value={segment.method}
                    onChange={(method) => updateSegment(index, { method })}
                  />
                  <ChoiceGroup
                    label="segment.enclosure"
                    choices={ENCLOSURE_CHOICES}
                    value={segment.enclosure}
                    onChange={(enclosure) => updateSegment(index, { enclosure })}
                  />
                  <ChoiceGroup
                    label="segment.ppe"
                    choices={PPE_CHOICES}
                    value={segment.ppeUse}
                    onChange={(ppeUse) => updateSegment(index, { ppeUse })}
                  />
                  <ChoiceGroup
                    label="segment.siteType"
                    choices={SITE_CHOICES}
                    value={segment.siteType}
                    onChange={(siteType) => updateSegment(index, { siteType })}
                  />

                  <NumberStepper
                    label="segment.startYear"
                    value={segment.startYear}
                    min={1940}
                    max={referenceYear}
                    onChange={(startYear) => updateSegment(index, { startYear })}
                  />

                  <ChoiceGroup
                    label="segment.ongoing"
                    choices={[
                      { value: 'yes', label: 'health.yes' },
                      { value: 'no', label: 'health.no' },
                    ]}
                    value={segment.endYear === null ? 'yes' : 'no'}
                    onChange={(ongoing) =>
                      updateSegment(index, {
                        endYear: ongoing === 'yes' ? null : referenceYear,
                      })
                    }
                  />

                  {segment.endYear !== null && (
                    <NumberStepper
                      label="segment.endYear"
                      value={segment.endYear}
                      min={segment.startYear}
                      max={referenceYear}
                      onChange={(endYear) => updateSegment(index, { endYear })}
                    />
                  )}

                  <ChoiceGroup
                    label="segment.durationCertainty"
                    choices={DURATION_CERTAINTY_CHOICES}
                    value={segment.durationCertainty ?? 'not_sure'}
                    onChange={(durationCertainty) =>
                      updateSegment(index, { durationCertainty })
                    }
                  />

                  <NumberStepper
                    label="segment.monthsPerYear"
                    unit="segment.months"
                    value={segment.monthsPerYear}
                    min={1}
                    max={12}
                    onChange={(monthsPerYear) => updateSegment(index, { monthsPerYear })}
                  />
                  <ChoiceGroup
                    label="segment.frequencyPattern"
                    choices={FREQUENCY_PATTERN_CHOICES}
                    value={segment.frequencyPattern ?? 'not_sure'}
                    onChange={(frequencyPattern) =>
                      updateSegment(index, { frequencyPattern })
                    }
                  />
                  <NumberStepper
                    label="segment.hoursPerDay"
                    unit="segment.hours"
                    value={segment.hoursPerDay}
                    min={1}
                    max={16}
                    onChange={(hoursPerDay) => updateSegment(index, { hoursPerDay })}
                  />

                  {segments.length > 1 && (
                    <SecondaryButton
                      onClick={() =>
                        setSegments((current) => current.filter((_, i) => i !== index))
                      }
                    >
                      {t('segment.remove')}
                    </SecondaryButton>
                  )}
                </fieldset>
              ))}

              {errors['segments'] !== undefined && (
                <p role="alert" className="mb-4 text-base font-semibold text-destructive">
                  {t(errors['segments'] as StringKey)}
                </p>
              )}

              <SecondaryButton
                onClick={() =>
                  setSegments((current) => [...current, emptySegment(referenceYear)])
                }
              >
                + {t('segment.add')}
              </SecondaryButton>
            </>
          )}

          {step === 2 && (
            <>
              <ChoiceGroup
                label="health.smoking"
                choices={SMOKING_CHOICES}
                value={smokingStatus}
                onChange={setSmokingStatus}
              />
              <YesNoToggle label="health.priorTB" value={priorTB} onChange={setPriorTB} />
              {/* The thesis of the whole project, stated on the screen where
                  a health worker would otherwise expect a symptom question. */}
              <p
                className="mt-2 rounded-md border-2 p-4 text-base leading-[1.7]"
                style={{
                  borderColor: 'var(--field-rule)',
                  backgroundColor: 'var(--field-notice)',
                }}
              >
                {t('health.noSymptomQuestion')}
              </p>
            </>
          )}

          {step === 3 && (
            <>
              <RiskResultPanel result={result} />

              {saved === 'no' && !online && <OfflineNotice />}

              {saved !== 'no' && (
                <p className="mt-4 rounded-md border-2 border-foreground p-4 text-lg font-bold">
                  {saved === 'sent' ? t('result.savedSynced') : t('result.savedOffline')}
                </p>
              )}

              {errors['save'] !== undefined && (
                <p role="alert" className="mt-4 text-base font-semibold text-destructive">
                  {t(errors['save'] as StringKey)}
                </p>
              )}
            </>
          )}
        </div>

        {/* Navigation pinned to the end of flow, always full-width targets. */}
        <div className="mt-8 space-y-3">
          {step < 3 && <PrimaryButton onClick={goNext}>{t('field.next')}</PrimaryButton>}

          {step === 3 && saved === 'no' && (
            <PrimaryButton onClick={() => void save()}>{t('field.save')}</PrimaryButton>
          )}

          {step === 3 && saved !== 'no' && (
            <PrimaryButton onClick={reset}>{t('field.newWorker')}</PrimaryButton>
          )}

          {step > 0 && (
            <SecondaryButton onClick={() => setStep((current) => current - 1)}>
              {t('field.back')}
            </SecondaryButton>
          )}
        </div>

        <p className="mt-8 text-sm text-muted-foreground">
          {locale === 'hi' ? 'मॉडल' : 'Model'} {result.modelVersion}
        </p>
      </div>
    </div>
  );
}
