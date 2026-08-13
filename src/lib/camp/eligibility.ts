/**
 * Who belongs on a screening camp list.
 *
 * Camp capacity is the scarce resource in this whole system — one handheld
 * unit, one radiographer, one day, a few dozen seats. Every seat given to
 * someone already found is a seat not given to someone undetected, which is
 * the opposite of case-finding.
 *
 * Pure functions, no I/O, so the rule is testable and the same in the camp
 * planner, the seed, and any future API route.
 */

export const CLINICAL_STATUSES = [
  'UNKNOWN',
  'SCREENED_NEGATIVE',
  'SUSPECTED',
  'CERTIFIED',
  'UNDER_TREATMENT',
] as const;

export type ClinicalStatus = (typeof CLINICAL_STATUSES)[number];

export function isClinicalStatus(value: string): value is ClinicalStatus {
  return (CLINICAL_STATUSES as readonly string[]).includes(value);
}

/**
 * Statuses that remove a worker from camp lists.
 *
 * CERTIFIED only, as specified.
 *
 * NOTE — UNDER_TREATMENT is deliberately NOT excluded here, and that is worth
 * a decision rather than an assumption. A worker under treatment has by
 * definition already been diagnosed, so screening them for CASE-FINDING finds
 * nothing new; on that reading they should be excluded too. The counter-reading
 * is that they may still need periodic imaging for progression or
 * silicotuberculosis, in which case a camp seat is the cheapest way to give it
 * to them. Those are different clinical purposes sharing one queue.
 *
 * Left inclusive until that is settled. Flagged rather than silently decided.
 */
export const CAMP_INELIGIBLE_STATUSES: readonly ClinicalStatus[] = ['CERTIFIED'];

/**
 * An unrecognised status is treated as ELIGIBLE.
 *
 * Deliberate fail-open. A typo or a legacy value must not silently remove a
 * worker from every screening list — being wrongly invited costs one seat,
 * being wrongly dropped costs a case.
 */
export function isCampEligible(clinicalStatus: string): boolean {
  return !(CAMP_INELIGIBLE_STATUSES as readonly string[]).includes(clinicalStatus);
}

/** Prisma-ready filter for camp candidate queries. Portable to Postgres. */
export const CAMP_ELIGIBLE_WHERE = {
  clinicalStatus: { notIn: CAMP_INELIGIBLE_STATUSES as unknown as string[] },
} as const;
