import { hasPriorSubmissionAttempt } from './submissionAttempt';

describe('hasPriorSubmissionAttempt', () => {
  it('is false for a brand-new draft', () => {
    expect(hasPriorSubmissionAttempt({
      submission_attempt_count: 0,
      version_number: 1,
    })).toBe(false);
    expect(hasPriorSubmissionAttempt(null)).toBe(false);
  });

  it('is true when attempt count or version indicates a prior submit', () => {
    expect(hasPriorSubmissionAttempt({
      submission_attempt_count: 1,
      version_number: 1,
    })).toBe(true);
    expect(hasPriorSubmissionAttempt({
      submission_attempt_count: 0,
      version_number: 2,
    })).toBe(true);
  });
});
