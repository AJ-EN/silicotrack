/**
 * Zod schemas for the field interview.
 *
 * One schema set, used at three boundaries: the form (per-step validation),
 * the offline outbox (before anything is persisted to IndexedDB), and the sync
 * API route (before anything touches the database). A record that never passes
 * through here never reaches storage.
 *
 * Error messages are i18n KEYS, not sentences. The renderer resolves them, so
 * a validation failure is as readable in Hindi as in English.
 */

import { z } from 'zod';

import { JEM_TASK_ORDER } from '@/lib/risk/jem';
import type { StringKey } from '@/lib/i18n/strings';

/** Narrow helper so a typo in an error key fails to compile. */
const err = (key: StringKey): string => key;

/**
 * Earliest plausible start year. A 100-year-old who began at 15 would have
 * started in 1941; anything earlier is a data-entry slip, not a career.
 */
export const EARLIEST_START_YEAR = 1940;

export const sexSchema = z.enum(['male', 'female', 'other']);
export const smokingStatusSchema = z.enum(['never', 'former', 'current']);
export const workMethodSchema = z.enum(['wet', 'dry']);
export const enclosureSchema = z.enum(['open', 'enclosed']);
export const ppeUseSchema = z.enum(['none', 'intermittent', 'consistent']);
export const siteTypeSchema = z.enum(['surface', 'underground']);
export const materialSchema = z.enum(['sandstone', 'quartzite', 'granite', 'other']);

/** Task codes come from the JEM itself, so the two can never drift apart. */
export const taskCodeSchema = z.enum(
  JEM_TASK_ORDER as unknown as [string, ...string[]],
);

/**
 * Exposure segment as captured in the interview.
 *
 * `referenceYear` is injected by the caller rather than read from a clock, for
 * the same reason the engine takes one: a schema that validates against "now"
 * behaves differently on a phone whose clock is wrong, which in the field is
 * common rather than exotic.
 */
export function exposureSegmentSchema(referenceYear: number) {
  return z
    .object({
      taskCode: taskCodeSchema,
      material: materialSchema,
      method: workMethodSchema,
      enclosure: enclosureSchema,
      ppeUse: ppeUseSchema,
      siteType: siteTypeSchema,
      startYear: z
        .number()
        .int()
        .min(EARLIEST_START_YEAR, err('error.yearRange'))
        .max(referenceYear, err('error.startFuture')),
      endYear: z
        .number()
        .int()
        .min(EARLIEST_START_YEAR, err('error.yearRange'))
        .max(referenceYear, err('error.yearRange'))
        .nullable(),
      monthsPerYear: z.number().int().min(1).max(12),
      hoursPerDay: z.number().int().min(1).max(16),
      siteName: z.string().trim().max(120).nullable(),
    })
    .refine(
      (segment) => segment.endYear === null || segment.endYear >= segment.startYear,
      { message: err('error.endBeforeStart'), path: ['endYear'] },
    );
}

export type ExposureSegmentDraft = z.infer<ReturnType<typeof exposureSegmentSchema>>;

/**
 * Worker identity and health facts.
 *
 * There is deliberately no Aadhaar field, and there never will be. CLAUDE.md
 * §2.5 forbids it even in fake-but-plausible form. `workerId` is issued by the
 * application and carries no government meaning.
 */
export const workerDraftSchema = z.object({
  name: z.string().trim().min(2, err('error.nameShort')).max(120),
  age: z.number().int().min(15, err('error.ageRange')).max(100, err('error.ageRange')),
  sex: sexSchema,
  district: z.string().trim().min(1, err('error.required')).max(80),
  block: z.string().trim().min(1, err('error.required')).max(80),
  village: z.string().trim().min(1, err('error.required')).max(80),
  // Indian mobile numbers begin 6–9. Optional: many workers share a household
  // phone or have none, and refusing to register them over it would defeat the
  // point of a person-linked registry.
  phone: z
    .string()
    .trim()
    .regex(/^[6-9]\d{9}$/, err('error.phone'))
    .nullable(),
  smokingStatus: smokingStatusSchema,
  priorTB: z.boolean(),
});

export type WorkerDraft = z.infer<typeof workerDraftSchema>;

/** A complete interview: identity, health, and the exposure ledger. */
export function fieldSubmissionSchema(referenceYear: number) {
  return z.object({
    /**
     * Client-generated. The field device may be offline for days, so it cannot
     * ask a server for an identifier, and two devices must never collide.
     */
    workerId: z.string().trim().min(6).max(64),
    worker: workerDraftSchema,
    segments: z.array(exposureSegmentSchema(referenceYear)).max(20),
    /** ISO instant, stamped by the device at capture time. */
    capturedAt: z.string().regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/),
    /** Reference date the device used to compute the tier, for reproducibility. */
    referenceDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    createdBy: z.string().trim().min(1).max(64),
  });
}

export type FieldSubmission = z.infer<ReturnType<typeof fieldSubmissionSchema>>;

/**
 * Sync payload: a batch of submissions from one device's outbox.
 *
 * Bounded because an offline device that accumulated a thousand records should
 * send them in chunks rather than one request that times out on a 2G link and
 * loses everything.
 */
export function syncPayloadSchema(referenceYear: number) {
  return z.object({
    deviceId: z.string().trim().min(1).max(64),
    submissions: z.array(fieldSubmissionSchema(referenceYear)).min(1).max(50),
  });
}

export type SyncPayload = z.infer<ReturnType<typeof syncPayloadSchema>>;
