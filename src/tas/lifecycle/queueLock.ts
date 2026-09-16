import { CURIE_REVIEW_MAX_WAIT_MS, CURIE_STATUS_PENDING } from './constants';

export interface InstructorQueueLockRow {
  curie_review_status?: string | null;
  instructor_form_locked?: boolean;
  requested_at?: string | null;
  submission_date?: string | null;
}

/**
 * Queue rows are annotation-only and do not persist timeout.
 * Never treat a queue lock as authoritative after the 30-minute outer bound,
 * or when the row has no start timestamp to prove it is still inside the window.
 */
export function instructorLockFromQueueRow(
  row: InstructorQueueLockRow,
  nowMs: number = Date.now(),
): boolean {
  if (row.curie_review_status !== CURIE_STATUS_PENDING) {
    return false;
  }
  const startedAt = row.requested_at ?? row.submission_date;
  if (!startedAt) {
    return false;
  }
  const startedMs = Date.parse(startedAt);
  if (Number.isNaN(startedMs)) {
    return false;
  }
  return (nowMs - startedMs) < CURIE_REVIEW_MAX_WAIT_MS;
}
