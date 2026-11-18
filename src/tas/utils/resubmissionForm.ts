import type { Submission } from '../types';

/**
 * True when the learner is editing/reattempting after a prior submission.
 * Uses submission version/attempt metadata — not local draft typing or an
 * `isEditing` UI flag — so first-time drafts stay on the step-by-step flow.
 */
export function isResubmissionForm(
  submission: Pick<
  Submission,
  'version_number' | 'submission_attempt_count' | 'submitted_at'
  > | null | undefined,
): boolean {
  if (!submission) {
    return false;
  }
  if ((submission.submission_attempt_count ?? 0) > 0) {
    return true;
  }
  if ((submission.version_number ?? 1) > 1) {
    return true;
  }
  return Boolean(submission.submitted_at);
}
