import { capacitySubmitPlan } from './capacitySubmit';

describe('capacitySubmitPlan', () => {
  const original = { goal: 'keep this long original answer' };
  const clamped = { goal: 'keep this' };
  const capacityFull = { goal: true };

  it('aborts a reattempt without rewriting parent form_data', () => {
    expect(capacitySubmitPlan(original, clamped, capacityFull)).toEqual({ abort: true });
  });

  it('still applies a defensive clamp for canvas submit (no answers payload)', () => {
    expect(capacitySubmitPlan(undefined, clamped, capacityFull)).toEqual({
      abort: false,
      nextFormData: clamped,
      nextCapacityFull: capacityFull,
    });
  });
});
