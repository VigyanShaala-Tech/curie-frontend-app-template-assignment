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

export const INSTRUCTOR_AWAITING_APPROVAL_COPY = 'CURIE has finished reviewing this attempt. The student cannot see this feedback until you approve it unchanged or edit and approve it.';

export const APPROVE_ACTION = 'Approve CURIE Feedback';

export const EDIT_AND_APPROVE_ACTION = 'Edit & Approve';

export const APPROVE_CONFIRM_COPY = 'Release CURIE’s feedback to the student exactly as shown? The submission status will be set from CURIE’s verdict. This cannot be undone.';

export const EDIT_APPROVE_CONFIRM_COPY = 'Release your edited feedback to the student? The feedback source will be recorded as Human and the submission status will be set from the edited scores. This cannot be undone.';

export interface CurieApprovalInfo {
  approved_by?: string | null;
  approved_at?: string | null;
  approval_modified?: boolean;
  published_source?: FeedbackSource | string | null;
  verdict?: string | null;
  overall_feedback?: string;
  field_feedback?: StaffFieldEntry[];
  star_rating?: number | null;
  gate_score?: number | null;
  gate_criterion_scores?: Array<{ criterion: string; score: number; max_score?: number }>;
  criterion_wise_scores?: Record<string, number>;
}

export interface StaffCurieReviewLike {
  status?: CurieReviewStatus | string | null;
  trigger_id?: string;
  submission_version_number?: number;
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
  awaiting_approval?: boolean;
  approval?: CurieApprovalInfo | null;
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
  /** CURIE output is stored and waiting for an instructor to release it. */
  awaitingApproval: boolean;
  /** Released through Approve / Edit & Approve; further approvals are blocked. */
  approved: boolean;
}

export function queueCurieStatusLabel(
  status: CurieReviewStatus | string | null | undefined,
): string {
  if (status === 'pending_evaluation') { return 'Pending'; }
  if (status === 'ready_for_approval') { return 'Awaiting Approval'; }
  if (status === 'approved') { return 'Approved'; }
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
  curie_review_status?: string | null;
}): boolean {
  if (row.curie_review_status === 'approved' || row.curie_review_status === 'ready_for_approval') {
    return false;
  }
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
  const awaitingApproval = status === 'ready_for_approval';
  const approved = status === 'approved';
  // Approval-workflow reviews are judged on review-level data: an Edit & Approve
  // writes source=human but the attempt stays in the CURIE lifecycle.
  const workflowOwned = awaitingApproval || approved;
  const humanOwns = input.feedbackSource === 'human' && !workflowOwned;
  const submitted = input.submissionStatus === 'submitted';
  const finalized = FINALIZED_FEEDBACK.has(input.submissionStatus ?? '');
  const pending = status === 'pending_evaluation';
  const failed = status === 'failed';
  const ready = status === 'ready';
  const lockedFlag = review?.instructor_form_locked !== false;
  const canOverride = ready && !humanOwns && finalized;

  let source: FeedbackSource | string | null | undefined = input.feedbackSource;
  if (awaitingApproval) {
    source = 'curie';
  } else if (approved) {
    source = review?.approval?.published_source ?? 'curie';
  }

  return {
    reviewStatusLabel: status ? queueCurieStatusLabel(status) : null,
    sourceLabel: source === 'human' || source === 'curie'
      ? queueSourceLabel(source) as 'CURIE' | 'Human'
      : null,
    formLocked: submitted && pending && lockedFlag,
    showFailedRecovery: submitted && failed,
    showReadyOutput: (ready && !humanOwns) || workflowOwned,
    canOverride,
    requireOverrideConfirm: canOverride,
    humanOwns,
    isSlowPending: Boolean(review?.is_slow_pending && pending),
    awaitingApproval,
    approved,
  };
}
