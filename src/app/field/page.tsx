import { LocaleProvider } from '@/components/field/locale';
import { FieldHeader } from '@/components/field/header';

import { FieldInterview } from './FieldInterview';

/**
 * /field — the exposure interview.
 *
 * Server component shell. The reference date is resolved here, once, and
 * passed down: the risk engine must never read a clock, and a phone whose
 * clock is wrong should not silently change a worker's latency term.
 *
 * On a genuinely offline first load the service worker serves the cached
 * shell, and this date is whatever it was when the page was last cached —
 * acceptable, because the tier is recomputed server-side on sync anyway.
 */
export default function FieldPage() {
  const referenceDate = new Date().toISOString().slice(0, 10);

  return (
    <LocaleProvider>
      <FieldHeader />
      <main className="flex-1">
        <FieldInterview referenceDate={referenceDate} />
      </main>
    </LocaleProvider>
  );
}
