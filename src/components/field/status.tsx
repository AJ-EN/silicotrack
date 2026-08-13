'use client';

/**
 * Connectivity and outbox status.
 *
 * The single most important thing this strip communicates is that losing the
 * network costs the user nothing. A health worker who does not trust that will
 * stop mid-interview to hunt for signal, which is exactly the behaviour the
 * offline design exists to prevent.
 *
 * Both pieces of state here belong to external systems — the network stack and
 * IndexedDB — so both are read through useSyncExternalStore rather than
 * mirrored into component state.
 */

import { useCallback, useEffect, useState, useSyncExternalStore } from 'react';

import { flushOutbox } from '@/lib/sync/flush';
import {
  getPendingServerSnapshot,
  getPendingSnapshot,
  refreshPending,
  subscribePending,
} from '@/lib/sync/store';

import { useLocale } from './locale';

function subscribeOnline(callback: () => void): () => void {
  window.addEventListener('online', callback);
  window.addEventListener('offline', callback);
  return () => {
    window.removeEventListener('online', callback);
    window.removeEventListener('offline', callback);
  };
}

export function useOnlineStatus(): boolean {
  return useSyncExternalStore(
    subscribeOnline,
    () => navigator.onLine,
    // Assume online during SSR so the indicator does not flash "offline" on a
    // perfectly good connection.
    () => true,
  );
}

export function usePendingCount(): number {
  return useSyncExternalStore(
    subscribePending,
    getPendingSnapshot,
    getPendingServerSnapshot,
  );
}

export function SyncStatusBar({ refreshKey = 0 }: { refreshKey?: number }) {
  const { t } = useLocale();
  const online = useOnlineStatus();
  const pending = usePendingCount();
  const [busy, setBusy] = useState(false);

  const flush = useCallback(async () => {
    setBusy(true);
    try {
      await flushOutbox();
    } finally {
      await refreshPending();
      setBusy(false);
    }
  }, []);

  // Read the queue depth on mount and whenever the interview reports a save.
  useEffect(() => {
    void refreshPending();
  }, [refreshKey]);

  /**
   * Drain the moment the network returns.
   *
   * Wired to the browser's `online` event rather than to a React state
   * transition: this is a subscription to an external system, and doing it
   * that way keeps the flush out of the render cycle entirely.
   */
  useEffect(() => {
    const onReconnect = (): void => {
      void flush();
    };
    window.addEventListener('online', onReconnect);
    return () => window.removeEventListener('online', onReconnect);
  }, [flush]);

  return (
    <div
      className="flex flex-wrap items-center gap-3 border-b-2 px-4 py-2 text-base"
      style={{ borderColor: 'var(--field-rule)' }}
    >
      <span className="flex items-center gap-2 font-semibold">
        <span
          aria-hidden
          className="inline-block h-3 w-3 rounded-full"
          style={{ backgroundColor: online ? 'var(--tier-3)' : 'var(--field-rule)' }}
        />
        {online ? t('net.online') : t('net.offline')}
      </span>

      {pending > 0 && (
        <span className="tabular-nums text-muted-foreground">
          {pending} {busy ? t('net.syncing') : t('net.pending')}
        </span>
      )}

      {pending > 0 && online && !busy && (
        <button
          type="button"
          onClick={() => void flush()}
          className="ml-auto rounded-md border-2 px-3 py-1 text-base font-semibold"
          style={{ borderColor: 'var(--field-rule)' }}
        >
          {t('net.syncNow')}
        </button>
      )}
    </div>
  );
}

/** Shown on the result step when the record was stored without a network. */
export function OfflineNotice() {
  const { t } = useLocale();
  return (
    <p
      className="mt-4 rounded-md border-2 p-4 text-base"
      style={{ borderColor: 'var(--field-rule)', backgroundColor: 'var(--field-notice)' }}
    >
      {t('net.offlineNotice')}
    </p>
  );
}
