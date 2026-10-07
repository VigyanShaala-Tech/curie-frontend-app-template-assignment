import type { CurieReviewStatus, FeedbackSource } from '../types';

export const INSTRUCTOR_PENDING_COPY = 'CURIE is reviewing this submission. Manual grading is locked until the review finishes or times out. This page will update automatically.';

export const INSTRUCTOR_SLOW_PENDING_COPY = 'This is taking longer than usual. Manual grading stays locked. The page will update when CURIE responds or the review times out.';

export const INSTRUCTOR_FAILED_RECOVERY_COPY = 'CURIE could not complete this review. You can grade this attempt now. Saving sets the feedback source to Human.';

export const INSTRUCTOR_OVERRIDE_COPY = 'CURIE already produced a review for this attempt. Saving your grade replaces it and permanently sets the source to Human.';

export const INSTRUCTOR_OVERRIDE_CONFIRM = 'Saving this grade replaces CURIE’s review for this attempt and permanently sets the feedback source to Human. Continue?';

export const INSTRUCTOR_HUMAN_OWNS_COPY = 'This attempt is owned by instructor grading (source: Human). CURIE cannot reclaim it.';

export const INSTRUCTOR_OVERRIDE_ACTION = 'Override CURIE review';

export const GATE_OVERALL_LABEL = 'Overall SWOT Coherence & Alignment';

const FINALIZED_FEEDBACK = new Set(['approved', 'rejected']);

export interface StaffFieldEntry {
  field_id: string;
  comment?: string;
  weight?: number;
  field_score?: number | null;
  criterion_scores?: Array<{ criterion: string; score: number; max_score?: number }>;
}

export interface StaffCurieReviewLike {
  status?: CurieReviewStatus | string | null;
  verdict?: string | null;
  overall_feedback?: string;
  field_feedback?: StaffFieldEntry[];
  star_rating?: number | null;
  is_slow_pending?: boolean;
  error_detail?: string;
  instructor_form_locked?: boolean;
  gate_score?: number | null;
  gate_criterion_scores?: Array<{ criterion: string; score: number; max_score?: number }>;
  criterion_wise_scores?: Record<string, number>;
}

export interface InstructorCuriePresentation {
  reviewStatusLabel: string | null;
  sourceLabel: 'CURIE' | 'Human' | null;
  formLocked: boolean;
  showFailedRecovery: boolean;
  showReadyOutput: boolean;
  canOverride: boolean;
  requireOverrideConfirm: boolean;
  humanOwns: boolean;
  isSlowPending: boolean;
}

export function queueCurieStatusLabel(
  status: CurieReviewStatus | string | null | undefined,
): string {
  if (status === 'pending_evaluation') { return 'Pending'; }
  if (status === 'ready') { return 'Ready'; }
  if (status === 'failed') { return 'Failed'; }
  return '—';
}

export function queueSourceLabel(
  source: FeedbackSource | string | null | undefined,
): string {
  if (source === 'curie') { return 'CURIE'; }
  if (source === 'human') { return 'Human'; }
  return '—';
}

export function canWithdrawQueueRow(row: {
  feedback_status?: string | null;
  feedback_source?: string | null;
}): boolean {
  return FINALIZED_FEEDBACK.has(row.feedback_status ?? '') && row.feedback_source === 'human';
}

export function formatScoreOutOfTen(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(Number(value))) { return '—'; }
  return `${Number(value).toFixed(1)}/10`;
}

export function fieldScoreOutOfTen(entry: StaffFieldEntry): number | null {
  if (entry.field_score != null && Number.isFinite(Number(entry.field_score))) {
    return Number(entry.field_score);
  }
  const scores = entry.criterion_scores ?? [];
  if (scores.length === 0) { return null; }
  const total = scores.reduce((sum, row) => sum + Number(row.score), 0);
  return total / scores.length;
}

export function presentInstructorCurie(input: {
  submissionStatus?: string | null;
  feedbackSource?: FeedbackSource | string | null;
  curieReview?: StaffCurieReviewLike | null;
}): InstructorCuriePresentation {
  const review = input.curieReview;
  const status = review?.status ?? null;
  const humanOwns = input.feedbackSource === 'human';
  const submitted = input.submissionStatus === 'submitted';
  const finalized = FINALIZED_FEEDBACK.has(input.submissionStatus ?? '');
  const pending = status === 'pending_evaluation';
  const failed = status === 'failed';
  const ready = status === 'ready';
  const lockedFlag = review?.instructor_form_locked !== false;
  const canOverride = ready && !humanOwns && finalized;

  return {
    reviewStatusLabel: status ? queueCurieStatusLabel(status) : null,
    sourceLabel: humanOwns || input.feedbackSource === 'curie'
      ? queueSourceLabel(input.feedbackSource) as 'CURIE' | 'Human'
      : null,
    formLocked: submitted && pending && lockedFlag,
    showFailedRecovery: submitted && failed,
    showReadyOutput: ready && !humanOwns,
    canOverride,
    requireOverrideConfirm: canOverride,
    humanOwns,
    isSlowPending: Boolean(review?.is_slow_pending && pending),
  };
}
