/**
 * Offline outbox — IndexedDB queue for records captured without a network.
 *
 * BROWSER ONLY. Imported exclusively from client components.
 *
 * Offline-first is a core claim of this project, not a progressive
 * enhancement (CLAUDE.md §2.7). An ASHA worker standing in a quarry in Karauli
 * has no signal, and the interview must complete, compute a tier, and persist
 * anyway. The record leaves the phone later, on its own.
 *
 * Design rules, all learned from how field apps actually fail:
 *
 *   1. The record is written to IndexedDB BEFORE the UI reports success.
 *      Reporting success from memory loses the interview if the phone dies.
 *   2. The device generates `workerId`. It cannot ask a server for one.
 *   3. Sync is idempotent, keyed on `workerId`. A request that timed out but
 *      actually succeeded must not create a duplicate worker on retry — the
 *      single most common failure on a 2G link.
 *   4. Nothing is deleted until the server confirms it. A "sent" record that
 *      was never received is an erased human being.
 */

import { openDB, type DBSchema, type IDBPDatabase } from 'idb';

import type { FieldSubmission } from '@/lib/validation/field';

const DB_NAME = 'silicotrack';
const DB_VERSION = 1;
const STORE = 'outbox';

export type OutboxStatus = 'pending' | 'syncing' | 'synced' | 'failed';

export interface OutboxRecord {
  /** Same as `submission.workerId`. Primary key, so re-queuing overwrites. */
  workerId: string;
  submission: FieldSubmission;
  status: OutboxStatus;
  /** ISO instant the record was queued on this device. */
  queuedAt: string;
  attempts: number;
  /** Last transport or validation error, for the retry panel. Never PII. */
  lastError: string | null;
}

interface SilicoTrackDB extends DBSchema {
  [STORE]: {
    key: string;
    value: OutboxRecord;
    indexes: { 'by-status': OutboxStatus };
  };
}

let dbPromise: Promise<IDBPDatabase<SilicoTrackDB>> | null = null;

function db(): Promise<IDBPDatabase<SilicoTrackDB>> {
  if (typeof indexedDB === 'undefined') {
    return Promise.reject(new Error('IndexedDB unavailable — outbox is browser-only'));
  }
  dbPromise ??= openDB<SilicoTrackDB>(DB_NAME, DB_VERSION, {
    upgrade(database) {
      const store = database.createObjectStore(STORE, { keyPath: 'workerId' });
      store.createIndex('by-status', 'status');
    },
  });
  return dbPromise;
}

/** Queue a completed interview. Resolves only once it is durably stored. */
export async function enqueue(submission: FieldSubmission): Promise<OutboxRecord> {
  const record: OutboxRecord = {
    workerId: submission.workerId,
    submission,
    status: 'pending',
    queuedAt: submission.capturedAt,
    attempts: 0,
    lastError: null,
  };
  await (await db()).put(STORE, record);
  return record;
}

export async function allRecords(): Promise<OutboxRecord[]> {
  return (await db()).getAll(STORE);
}

/**
 * Records still owed to the server.
 *
 * `syncing` is included: if the app was killed mid-flush, the record is
 * stranded in that state and would otherwise never be retried.
 */
export async function pendingRecords(): Promise<OutboxRecord[]> {
  const records = await allRecords();
  return records
    .filter((record) => record.status !== 'synced')
    .sort((a, b) => a.queuedAt.localeCompare(b.queuedAt));
}

export async function pendingCount(): Promise<number> {
  return (await pendingRecords()).length;
}

async function patch(workerId: string, changes: Partial<OutboxRecord>): Promise<void> {
  const database = await db();
  const existing = await database.get(STORE, workerId);
  if (existing === undefined) return;
  await database.put(STORE, { ...existing, ...changes });
}

export async function markSyncing(workerId: string): Promise<void> {
  await patch(workerId, { status: 'syncing' });
}

export async function markSynced(workerId: string): Promise<void> {
  await patch(workerId, { status: 'synced', lastError: null });
}

export async function markFailed(workerId: string, error: string): Promise<void> {
  const database = await db();
  const existing = await database.get(STORE, workerId);
  if (existing === undefined) return;
  await database.put(STORE, {
    ...existing,
    status: 'failed',
    attempts: existing.attempts + 1,
    // Truncated and generic: an error string must never carry interview
    // content into logs or storage (CLAUDE.md §2.6).
    lastError: error.slice(0, 200),
  });
}

/**
 * Drop records the server has confirmed.
 *
 * Kept separate from `markSynced` and called only after a successful flush, so
 * that a confirmed record survives in the store long enough to be visible in
 * the UI before it disappears.
 */
export async function purgeSynced(): Promise<number> {
  const database = await db();
  const records = await database.getAll(STORE);
  const synced = records.filter((record) => record.status === 'synced');
  await Promise.all(synced.map((record) => database.delete(STORE, record.workerId)));
  return synced.length;
}

/** Test/demo affordance. Never wired to a user-facing control. */
export async function clearOutbox(): Promise<void> {
  await (await db()).clear(STORE);
}
