import { isResubmissionForm } from './resubmissionForm';

describe('isResubmissionForm', () => {
  it('treats a fresh draft as first-time', () => {
    expect(isResubmissionForm({
      version_number: 1,
      submission_attempt_count: 0,
      submitted_at: null,
    })).toBe(false);
    expect(isResubmissionForm(null)).toBe(false);
  });

  it('detects reattempts from attempt count, version, or submitted_at', () => {
    expect(isResubmissionForm({
      version_number: 1,
      submission_attempt_count: 1,
      submitted_at: null,
    })).toBe(true);
    expect(isResubmissionForm({
      version_number: 2,
      submission_attempt_count: 0,
      submitted_at: null,
    })).toBe(true);
    expect(isResubmissionForm({
      version_number: 1,
      submission_attempt_count: 0,
      submitted_at: '2026-03-11T20:12:45Z',
    })).toBe(true);
  });
});
