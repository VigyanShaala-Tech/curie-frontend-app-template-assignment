/**
 * Decide whether a capacity check should rewrite parent form_data.
 * Reattempt payloads (`answers` present) must abort without mutating store state.
 */

export function capacitySubmitPlan(
  answers: Record<string, string> | undefined,
  clampedData: Record<string, string>,
  capacityFull: Record<string, boolean>,
): {
    abort: boolean;
    nextFormData?: Record<string, string>;
    nextCapacityFull?: Record<string, boolean>;
  } {
  const overflowing = Object.keys(capacityFull).length > 0;
  if (answers && overflowing) {
    return { abort: true };
  }
  if (overflowing) {
    return {
      abort: false,
      nextFormData: clampedData,
      nextCapacityFull: capacityFull,
    };
  }
  if (answers) {
    return { abort: false, nextFormData: clampedData };
  }
  return { abort: false };
}
