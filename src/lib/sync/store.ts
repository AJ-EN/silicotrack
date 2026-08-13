/**
 * Observable view of the outbox, for React. BROWSER ONLY.
 *
 * IndexedDB is an external system with async reads, so the count is held in a
 * module-level cache that components read synchronously through
 * useSyncExternalStore. Mirroring it into component state inside an effect
 * would re-render twice per change and put a setState in an effect body, which
 * React 19 rightly complains about.
 */

import { pendingCount } from './outbox';

const listeners = new Set<() => void>();

let cachedPending = 0;
let inFlight: Promise<void> | null = null;

function emit(): void {
  for (const listener of listeners) listener();
}

export function subscribePending(callback: () => void): () => void {
  listeners.add(callback);
  return () => listeners.delete(callback);
}

/** Synchronous, cached. Refreshed by `refreshPending`. */
export function getPendingSnapshot(): number {
  return cachedPending;
}

/** The server has no outbox. */
export function getPendingServerSnapshot(): number {
  return 0;
}

/**
 * Re-read the queue depth.
 *
 * Coalesced: several callers during one flush share a single read rather than
 * queueing a burst of IndexedDB transactions.
 */
export async function refreshPending(): Promise<void> {
  if (inFlight !== null) return inFlight;

  inFlight = (async () => {
    try {
      const next = await pendingCount();
      if (next !== cachedPending) {
        cachedPending = next;
        emit();
      }
    } catch {
      // IndexedDB unavailable (private mode, ancient WebView). The interview
      // still works; only the queue indicator goes dark.
      if (cachedPending !== 0) {
        cachedPending = 0;
        emit();
      }
    } finally {
      inFlight = null;
    }
  })();

  return inFlight;
}
