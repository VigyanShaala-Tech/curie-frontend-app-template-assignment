import { CURIE_REVIEW_MAX_WAIT_MS } from './constants';
import { instructorLockFromQueueRow } from './queueLock';

describe('instructorLockFromQueueRow', () => {
  const now = Date.parse('2026-09-13T12:00:00.000Z');

  it('never treats a queue row as locked without a start timestamp', () => {
    expect(instructorLockFromQueueRow({
      curie_review_status: 'pending_evaluation',
      instructor_form_locked: true,
    }, now)).toBe(false);
  });

  it('does not trust lock after the 30-minute outer bound', () => {
    expect(instructorLockFromQueueRow({
      curie_review_status: 'pending_evaluation',
      instructor_form_locked: true,
      submission_date: new Date(now - CURIE_REVIEW_MAX_WAIT_MS).toISOString(),
    }, now)).toBe(false);
  });

  it('allows a provisional lock only while still inside the outer bound', () => {
    expect(instructorLockFromQueueRow({
      curie_review_status: 'pending_evaluation',
      instructor_form_locked: true,
      submission_date: new Date(now - 60_000).toISOString(),
    }, now)).toBe(true);
  });
});
