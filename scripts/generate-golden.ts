/**
 * Regenerates the golden-file fixture.
 *
 *     npm run test:golden:update
 *
 * Run this ONLY when a model change is intentional. Review the resulting diff
 * line by line and explain it in the commit message — the fixture exists to
 * make model drift visible, so an unexamined regeneration defeats its purpose.
 */

import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { assessRisk } from '../src/lib/risk/engine';
import { GOLDEN_PROFILES } from '../src/lib/risk/__tests__/golden-profiles';

const OUTPUT = fileURLToPath(
  new URL('../src/lib/risk/__tests__/golden.json', import.meta.url),
);

const snapshot = GOLDEN_PROFILES.map((profile) => ({
  id: profile.id,
  description: profile.description,
  result: assessRisk(profile.input),
}));

writeFileSync(OUTPUT, `${JSON.stringify(snapshot, null, 2)}\n`, 'utf8');

console.log(`Wrote ${snapshot.length} profiles to ${OUTPUT}`);
for (const { id, result } of snapshot) {
  console.log(
    `  ${id}  CE=${result.cumulativeExposure.toFixed(2).padStart(6)}  ` +
      `base=${result.baseTier} → tier=${result.tier}  ` +
      `peak=${result.peakIntensity.toFixed(3)}  ` +
      `TSFE=${String(result.yearsSinceFirstExposure).padStart(2)}  ` +
      `esc=[${result.escalations.filter((e) => e.applied).map((e) => e.code).join(',')}]`,
  );
}
