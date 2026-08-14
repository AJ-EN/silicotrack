/**
 * Outbox sync endpoint.
 *
 * Accepts a batch of field interviews from one device. HTTP concerns only —
 * the persistence contract, including its idempotence guarantee, lives in
 * `lib/db/ingest.ts` and is tested there.
 */

import { NextResponse } from 'next/server';

import { prisma } from '@/lib/db/client';
import { ingestSubmission } from '@/lib/db/ingest';
import { syncPayloadSchema } from '@/lib/validation/field';

/** Bounded so one malformed device cannot pin the request thread. */
export const maxDuration = 30;

interface Rejection {
  workerId: string;
  reason: string;
}

/**
 * Upper bound for year validation, from the SERVER clock.
 *
 * Deliberately not taken from the payload: this is the trust boundary, and a
 * phone with a wrong clock must not be able to submit a segment starting in
 * 2183 and inflate a worker's exposure.
 */
function referenceYearNow(): number {
  return new Date().getUTCFullYear();
}

export async function POST(request: Request): Promise<NextResponse> {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'malformed JSON' }, { status: 400 });
  }

  const parsed = syncPayloadSchema(referenceYearNow()).safeParse(body);
  if (!parsed.success) {
    // Issue paths are returned; submitted VALUES are not. An error response
    // must never echo interview content into a log (CLAUDE.md §2.6).
    return NextResponse.json(
      {
        error: 'validation failed',
        issues: parsed.error.issues.map((issue) => ({
          path: issue.path.join('.'),
          code: issue.code,
        })),
      },
      { status: 422 },
    );
  }

  const accepted: string[] = [];
  const rejected: Rejection[] = [];

  // Sequential, not parallel: one bad submission must not roll back its
  // neighbours, and a field device syncs a handful of records, not thousands.
  for (const submission of parsed.data.submissions) {
    try {
      await ingestSubmission(prisma, submission);
      accepted.push(submission.workerId);
    } catch {
      rejected.push({ workerId: submission.workerId, reason: 'persist failed' });
    }
  }

  return NextResponse.json({ accepted, rejected });
}
