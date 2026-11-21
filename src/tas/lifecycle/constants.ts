/** Matches TAS `CURIE_REVIEW_MAX_WAIT_SECONDS` (30 minutes from `requested_at`). */
export const CURIE_REVIEW_MAX_WAIT_MS = 30 * 60 * 1000;

/** Matches TAS `CURIE_REVIEW_TIMEOUT_SECONDS` — slow-copy only, not a status change. */
export const CURIE_SLOW_PENDING_MS = 5 * 60 * 1000;

export const PENDING_POLL_INTERVAL_MS = 5_000;

/** Instructor approval can take hours; poll less aggressively than CURIE evaluation. */
export const AWAITING_APPROVAL_POLL_INTERVAL_MS = 15_000;

export const CURIE_STATUS_PENDING = 'pending_evaluation';
export const CURIE_STATUS_READY = 'ready';
export const CURIE_STATUS_READY_FOR_APPROVAL = 'ready_for_approval';
export const CURIE_STATUS_APPROVED = 'approved';
export const CURIE_STATUS_FAILED = 'failed';
