import type { Submission } from '../types';

/**
 * True when the learner has already submitted at least once (or reopened a
 * prior attempt as draft). Mid-draft first attempts stay false even if form_data
 * is partially filled.
 */
export function hasPriorSubmissionAttempt(
  submission: Pick<Submission, 'submission_attempt_count' | 'version_number'> | null | undefined,
): boolean {
  if (!submission) return false;
  return (submission.submission_attempt_count ?? 0) > 0
    || (submission.version_number ?? 1) > 1;
}
