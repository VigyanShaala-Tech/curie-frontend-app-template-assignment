import type { CurieReviewStatus, FeedbackSource, SubmissionStatus } from '../types';
import {
  CURIE_STATUS_FAILED,
  CURIE_STATUS_PENDING,
  CURIE_STATUS_READY,
} from './constants';

export type DisplayState =
  | 'legacy'
  | 'draft'
  | 'pending'
  | 'live_failed'
  | 'cold_failed'
  | 'curie_accepted'
  | 'curie_rejected'
  | 'human_feedback';

export interface LifecycleInput {
  submissionStatus?: SubmissionStatus | null;
  curieReviewStatus?: CurieReviewStatus | null;
  feedbackSource?: FeedbackSource | null;
  atMaxAttempts?: boolean;
  isSlowPending?: boolean;
  hasFeedback?: boolean;
  /** True when this mounted session already observed `pending_evaluation`. */
  observedPendingInSession?: boolean;
}

export interface LifecycleCapabilities {
  displayState: DisplayState;
  hasCurieReview: boolean;
  canEdit: boolean;
  canSubmit: boolean;
  canReattempt: boolean;
  canWithdraw: boolean;
  useLegacyReopen: boolean;
  isCanvasReadOnly: boolean;
  shouldPoll: boolean;
  isSlowPending: boolean;
  atMaxAttempts: boolean;
  instructorFormLocked: boolean;
}

const emptyLifecycle = (overrides: Partial<LifecycleCapabilities> = {}): LifecycleCapabilities => ({
  displayState: 'legacy',
  hasCurieReview: false,
  canEdit: false,
  canSubmit: false,
  canReattempt: false,
  canWithdraw: false,
  useLegacyReopen: false,
  isCanvasReadOnly: true,
  shouldPoll: false,
  isSlowPending: false,
  atMaxAttempts: false,
  instructorFormLocked: false,
  ...overrides,
});

/**
 * Single derived capability model. Field components must use `canEdit` /
 * `isCanvasReadOnly` instead of inferring from raw `Submission.status`.
 *
 * When `curie_review_status` is absent, behavior matches pre-CURIE TAS.
 */
export function deriveLifecycle(input: LifecycleInput): LifecycleCapabilities {
  const status = input.submissionStatus ?? null;
  const review = input.curieReviewStatus ?? null;
  const source = input.feedbackSource ?? null;
  const atMax = Boolean(input.atMaxAttempts);
  const humanOwns = source === 'human';
  const hasCurieReview = review != null;

  if (!status) {
    return emptyLifecycle();
  }

  if (!hasCurieReview) {
    const draft = status === 'draft';
    const rejected = status === 'rejected';
    const canLegacyReopen = rejected && !atMax;
    return emptyLifecycle({
      displayState: draft ? 'draft' : 'legacy',
      canEdit: draft,
      canSubmit: draft,
      canReattempt: canLegacyReopen,
      canWithdraw: Boolean(input.hasFeedback) && source !== 'curie',
      useLegacyReopen: canLegacyReopen,
      isCanvasReadOnly: !draft,
      shouldPoll: status !== 'draft' && !input.hasFeedback,
      atMaxAttempts: atMax,
    });
  }

  const pending = review === CURIE_STATUS_PENDING;
  const failed = review === CURIE_STATUS_FAILED;
  const ready = review === CURIE_STATUS_READY;
  const instructorFormLocked = pending;
  const isSlowPending = pending && Boolean(input.isSlowPending);

  if (humanOwns) {
    const rejected = status === 'rejected';
    const canLegacyReopen = rejected && !atMax;
    return emptyLifecycle({
      displayState: 'human_feedback',
      hasCurieReview: true,
      canEdit: false,
      canSubmit: false,
      canReattempt: false,
      canWithdraw: true,
      useLegacyReopen: canLegacyReopen,
      isCanvasReadOnly: true,
      instructorFormLocked: false,
      atMaxAttempts: atMax,
    });
  }

  if (pending) {
    return emptyLifecycle({
      displayState: 'pending',
      hasCurieReview: true,
      isCanvasReadOnly: true,
      shouldPoll: true,
      isSlowPending,
      atMaxAttempts: atMax,
      instructorFormLocked,
    });
  }

  if (failed) {
    const liveFailed = Boolean(input.observedPendingInSession);
    const canRetry = !atMax && !humanOwns;
    return emptyLifecycle({
      displayState: liveFailed ? 'live_failed' : 'cold_failed',
      hasCurieReview: true,
      canEdit: canRetry && !liveFailed,
      canSubmit: canRetry,
      canReattempt: canRetry,
      isCanvasReadOnly: !canRetry || liveFailed,
      atMaxAttempts: atMax,
      instructorFormLocked: false,
    });
  }

  if (ready && status === 'approved') {
    return emptyLifecycle({
      displayState: 'curie_accepted',
      hasCurieReview: true,
      isCanvasReadOnly: true,
      atMaxAttempts: atMax,
    });
  }

  if (ready && status === 'rejected' && source === 'curie') {
    const canRetry = !atMax;
    return emptyLifecycle({
      displayState: 'curie_rejected',
      hasCurieReview: true,
      canEdit: false,
      canSubmit: false,
      canReattempt: canRetry,
      isCanvasReadOnly: true,
      atMaxAttempts: atMax,
    });
  }

  const draft = status === 'draft';
  return emptyLifecycle({
    displayState: draft ? 'draft' : 'legacy',
    hasCurieReview: true,
    canEdit: draft,
    canSubmit: draft,
    isCanvasReadOnly: !draft,
    atMaxAttempts: atMax,
  });
}
