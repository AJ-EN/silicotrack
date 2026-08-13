/**
 * Persistence for a synced field interview.
 *
 * Lives here rather than in the route so the ingest contract can be tested
 * directly, without an HTTP server. The route keeps only HTTP concerns:
 * parsing, validation, status codes.
 *
 * THE WHOLE CONTRACT IS IDEMPOTENCE. A field device on a 2G link will
 * re-deliver a batch it already delivered — that is the normal case, not the
 * exceptional one. Delivering the same capture twice must leave the database
 * in exactly the state one delivery would.
 */

import type { PrismaClient } from '@/generated/prisma/client';
import { assessRisk } from '@/lib/risk/engine';
import type { FieldSubmission } from '@/lib/validation/field';

/** Deterministic on (worker, capture). One capture is one assessment. */
export function assessmentId(submission: FieldSubmission): string {
  return `${submission.workerId}-RA-${submission.capturedAt}`;
}

export async function ingestSubmission(
  prisma: PrismaClient,
  submission: FieldSubmission,
): Promise<void> {
  // Recomputed server-side rather than trusting the tier the phone sent, so
  // every stored assessment carries the server's model and JEM version and a
  // coefficient change can be replayed across the whole cohort. The submission
  // carries its own referenceDate, so this stays reproducible rather than
  // depending on when sync happened to run.
  const result = assessRisk({
    segments: submission.segments,
    worker: {
      smokingStatus: submission.worker.smokingStatus,
      priorTB: submission.worker.priorTB,
    },
    referenceDate: submission.referenceDate,
  });

  const id = assessmentId(submission);

  const assessment = {
    workerId: submission.workerId,
    cumulativeExposure: result.cumulativeExposure,
    peakIntensity: result.peakIntensity,
    yearsSinceFirstExposure: result.yearsSinceFirstExposure,
    baseTier: result.baseTier,
    tier: result.tier,
    escalationsJson: JSON.stringify(result.escalations),
    rescreenMonths: result.rescreenMonths,
    topContributorsJson: JSON.stringify(result.topContributors),
    reasonEn: result.reasonEn,
    reasonHi: result.reasonHi,
    insufficientData: result.insufficientData,
    modelVersion: result.modelVersion,
    jemVersion: result.jemVersion,
    confidence: result.confidence,
    computedAt: submission.capturedAt,
    isCurrent: true,
  };

  await prisma.$transaction(async (tx) => {
    await tx.worker.upsert({
      where: { workerId: submission.workerId },
      create: {
        workerId: submission.workerId,
        ...submission.worker,
        createdBy: submission.createdBy,
        createdAt: submission.capturedAt,
      },
      // createdAt and createdBy are deliberately not updated: the first
      // capture is the record of who registered this person and when.
      update: { ...submission.worker },
    });

    // The submission is the complete ledger for this worker, so stored
    // segments are replaced wholesale. Merging would leave orphaned rows from
    // an earlier draft of the same interview.
    await tx.exposureSegment.deleteMany({ where: { workerId: submission.workerId } });
    await tx.exposureSegment.createMany({
      data: submission.segments.map((segment, index) => ({
        id: `${submission.workerId}-SEG-${index + 1}`,
        workerId: submission.workerId,
        taskCode: segment.taskCode,
        material: segment.material,
        method: segment.method,
        enclosure: segment.enclosure,
        ppeUse: segment.ppeUse,
        siteType: segment.siteType,
        startYear: segment.startYear,
        endYear: segment.endYear,
        monthsPerYear: segment.monthsPerYear,
        hoursPerDay: segment.hoursPerDay,
        siteName: segment.siteName,
      })),
    });

    // Assessments are history, never overwritten in place — so editing a JEM
    // coefficient and recomputing leaves a visible before and after.
    await tx.riskAssessment.updateMany({
      where: { workerId: submission.workerId, isCurrent: true },
      data: { isCurrent: false },
    });

    // Upsert, not create. A replayed batch would otherwise violate the primary
    // key, roll the transaction back, and be reported to the device as a
    // failure — leaving the record stuck in the outbox forever while its data
    // sits safely in the database.
    await tx.riskAssessment.upsert({
      where: { id },
      create: { id, ...assessment },
      update: assessment,
    });
  });
}
