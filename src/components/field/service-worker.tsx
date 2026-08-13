'use client';

import { useEffect } from 'react';

/**
 * Registers the service worker.
 *
 * Development is skipped deliberately: a cached shell during HMR produces
 * stale-bundle bugs that look like application bugs and waste hours.
 */
export function ServiceWorkerRegistrar() {
  useEffect(() => {
    if (process.env.NODE_ENV !== 'production') return;
    if (!('serviceWorker' in navigator)) return;

    const register = (): void => {
      void navigator.serviceWorker.register('/sw.js').catch(() => {
        // Registration failure must never break the interview. The app still
        // works online; only the offline shell is unavailable.
      });
    };

    // Registration competes with the first paint for bandwidth on a 2G link,
    // so it waits until the page has settled.
    if (document.readyState === 'complete') register();
    else window.addEventListener('load', register, { once: true });
  }, []);

  return null;
}
