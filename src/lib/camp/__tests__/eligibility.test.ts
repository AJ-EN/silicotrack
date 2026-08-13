import { describe, expect, it } from 'vitest';

import {
  CAMP_INELIGIBLE_STATUSES,
  CLINICAL_STATUSES,
  isCampEligible,
  isClinicalStatus,
} from '../eligibility';

describe('camp eligibility', () => {
  it('excludes CERTIFIED workers', () => {
    // A certified worker has already been found and compensated. A camp seat
    // spent on them is a seat not spent on someone undetected.
    expect(isCampEligible('CERTIFIED')).toBe(false);
    expect(CAMP_INELIGIBLE_STATUSES).toEqual(['CERTIFIED']);
  });

  it('includes every other status', () => {
    for (const status of CLINICAL_STATUSES) {
      if (status === 'CERTIFIED') continue;
      expect(isCampEligible(status)).toBe(true);
    }
  });

  it('still includes UNDER_TREATMENT — a flagged open decision', () => {
    // Pinned deliberately. A worker under treatment is already diagnosed, so
    // on a case-finding reading they should be excluded too; on a
    // progression-monitoring reading they should not. If that call is ever
    // made, this test is where it gets made explicitly rather than by drift.
    expect(isCampEligible('UNDER_TREATMENT')).toBe(true);
  });

  it('fails OPEN on an unrecognised status', () => {
    // Being wrongly invited costs one camp seat. Being wrongly dropped costs a
    // case. A typo or a legacy value must never silently remove someone from
    // every screening list.
    expect(isCampEligible('LEGACY_VALUE')).toBe(true);
    expect(isCampEligible('')).toBe(true);
  });
});

describe('status vocabulary', () => {
  it('matches the values documented on the schema', () => {
    expect(CLINICAL_STATUSES).toEqual([
      'UNKNOWN',
      'SCREENED_NEGATIVE',
      'SUSPECTED',
      'CERTIFIED',
      'UNDER_TREATMENT',
    ]);
  });

  it('recognises its own values and rejects others', () => {
    for (const status of CLINICAL_STATUSES) expect(isClinicalStatus(status)).toBe(true);
    expect(isClinicalStatus('certified')).toBe(false);
    expect(isClinicalStatus('toString')).toBe(false);
  });
});
