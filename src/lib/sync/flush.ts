/**
 * Outbox flush driver. BROWSER ONLY.
 *
 * Sends queued interviews to the server in bounded batches and reconciles the
 * outbox with what the server confirms. Conflict resolution is deliberately
 * boring: the server upserts on `workerId`, so replaying a batch is a no-op.
 * On a 2G link the same batch will be replayed, and that must be safe.
 */

import {
  markFailed,
  markSynced,
  markSyncing,
  pendingRecords,
  purgeSynced,
  type OutboxRecord,
} from './outbox';

/** Small enough to survive a bad link, large enough to drain a day's work. */
const BATCH_SIZE = 25;

export interface FlushResult {
  attempted: number;
  synced: number;
  failed: number;
  /** True when there was nothing to do. */
  idle: boolean;
  error: string | null;
}

interface SyncResponse {
  accepted: string[];
  rejected: { workerId: string; reason: string }[];
}

function deviceId(): string {
  const KEY = 'silicotrack.deviceId';
  const existing = localStorage.getItem(KEY);
  if (existing !== null) return existing;
  const generated = `DEV-${crypto.randomUUID()}`;
  localStorage.setItem(KEY, generated);
  return generated;
}

export async function flushOutbox(): Promise<FlushResult> {
  const pending = await pendingRecords();
  if (pending.length === 0) {
    return { attempted: 0, synced: 0, failed: 0, idle: true, error: null };
  }

  const batch = pending.slice(0, BATCH_SIZE);
  await Promise.all(batch.map((record) => markSyncing(record.workerId)));

  let response: Response;
  try {
    response = await fetch('/api/sync', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        deviceId: deviceId(),
        submissions: batch.map((record) => record.submission),
      }),
    });
  } catch {
    // Transport failure: the network went away mid-flush. Nothing is lost —
    // the records stay in the outbox and will be retried.
    const message = 'network unavailable';
    await Promise.all(batch.map((record) => markFailed(record.workerId, message)));
    return {
      attempted: batch.length,
      synced: 0,
      failed: batch.length,
      idle: false,
      error: message,
    };
  }

  if (!response.ok) {
    const message = `server responded ${response.status}`;
    await Promise.all(batch.map((record) => markFailed(record.workerId, message)));
    return {
      attempted: batch.length,
      synced: 0,
      failed: batch.length,
      idle: false,
      error: message,
    };
  }

  const body = (await response.json()) as SyncResponse;
  const accepted = new Set(body.accepted);

  await Promise.all(
    batch.map(async (record: OutboxRecord) => {
      if (accepted.has(record.workerId)) {
        await markSynced(record.workerId);
        return;
      }
      const rejection = body.rejected.find((item) => item.workerId === record.workerId);
      await markFailed(record.workerId, rejection?.reason ?? 'not acknowledged');
    }),
  );

  const synced = await purgeSynced();

  return {
    attempted: batch.length,
    synced,
    failed: batch.length - synced,
    idle: false,
    error: null,
  };
}
