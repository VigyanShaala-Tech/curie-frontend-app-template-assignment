/**
 * Accept / reject / clamp candidate field text against real box capacity.
 */

import type { FieldLayoutMetrics } from './fieldLayout';
import { textFitsInField } from './textFitsInField';

export type TextFitsFn = (text: string, layout: FieldLayoutMetrics) => boolean;

export interface ClampTextResult {
  value: string;
  /** True when the field cannot accept more content (at or over capacity). */
  capacityFull: boolean;
  /** True when the candidate was rejected entirely (kept previous). */
  rejected: boolean;
}

/**
 * Longest prefix of `text` that still fits in the field (binary search).
 */
export function clampTextToLongestPrefix(
  text: string,
  layout: FieldLayoutMetrics,
  fits: TextFitsFn = textFitsInField,
): string {
  if (!text) { return ''; }
  if (fits(text, layout)) { return text; }
  if (!fits(text.slice(0, 1), layout)) { return ''; }

  let lo = 1;
  let hi = text.length;
  let best = 0;

  while (lo <= hi) {
    const mid = Math.floor((lo + hi) / 2);
    if (fits(text.slice(0, mid), layout)) {
      best = mid;
      lo = mid + 1;
    } else {
      hi = mid - 1;
    }
  }

  return text.slice(0, best);
}

/**
 * Apply a candidate edit against previous value.
 * - Fits → accept, clear capacity warning
 * - Longer than previous and does not fit → clamp to longest prefix; show warning
 * - Shorter than previous → accept (fits); clear warning
 */
export function applyTextCandidate(
  previous: string,
  candidate: string,
  layout: FieldLayoutMetrics,
  fits: TextFitsFn = textFitsInField,
): ClampTextResult {
  if (candidate === previous) {
    return { value: previous, capacityFull: false, rejected: false };
  }

  if (fits(candidate, layout)) {
    return { value: candidate, capacityFull: false, rejected: false };
  }

  // Growing content (type or paste): keep as much as fits.
  if (candidate.length > previous.length) {
    const clamped = clampTextToLongestPrefix(candidate, layout, fits);
    // If nothing beyond previous fits, keep previous and mark rejected.
    if (clamped === previous || clamped.length <= previous.length) {
      // Prefer previous when clamp didn't grow (single-char reject or empty clamp).
      const keepPrevious = fits(previous, layout) ? previous : clamped;
      return {
        value: keepPrevious,
        capacityFull: true,
        rejected: keepPrevious === previous,
      };
    }
    return { value: clamped, capacityFull: true, rejected: false };
  }

  // Shrinking: accept candidate if it fits; otherwise clamp defensively.
  if (fits(candidate, layout)) {
    return { value: candidate, capacityFull: false, rejected: false };
  }
  const clamped = clampTextToLongestPrefix(candidate, layout, fits);
  return { value: clamped, capacityFull: false, rejected: false };
}

/**
 * Defensive clamp of stored form values to field capacity (e.g. before submit).
 */
export function clampFormDataToFields(
  formData: Record<string, string>,
  layoutsByFieldId: Record<string, FieldLayoutMetrics>,
  fits: TextFitsFn = textFitsInField,
): { formData: Record<string, string>; capacityFull: Record<string, boolean> } {
  const next: Record<string, string> = { ...formData };
  const capacityFull: Record<string, boolean> = {};

  Object.entries(layoutsByFieldId).forEach(([fieldId, layout]) => {
    const value = formData[fieldId] ?? '';
    if (!value) { return; }
    if (fits(value, layout)) { return; }
    const clamped = clampTextToLongestPrefix(value, layout, fits);
    next[fieldId] = clamped;
    capacityFull[fieldId] = true;
  });

  return { formData: next, capacityFull };
}
