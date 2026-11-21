import type {
  CurieFieldFeedback,
  CurieReviewStatus,
  CurieVerdict,
  FieldColor,
  FormField,
  SubmissionVersion,
} from '../types';

export const FIELD_COLOR_LABEL: Record<Exclude<FieldColor, null>, string> = {
  good: 'Good',
  could_improve: 'Could improve',
  needs_revision: 'Needs revision',
};

export const COMBINED_REFLECTION_LABEL = (
  'Reflection: Broader Contribution & Personal Development'
);

const CONTRIBUTION_FIELD_ID = 'contribution';
const REFLECTION_FIELD_ID = 'reflection';

export function fieldLabel(
  fields: FormField[] | undefined,
  fieldId: string,
): string {
  return fields?.find((field) => field.id === fieldId)?.label ?? fieldId;
}

export function isCombinedReflectionFeedback(
  fieldIds: string[],
  feedback: Array<{ field_id: string }> | undefined,
): boolean {
  const ids = new Set(fieldIds);
  const feedbackIds = new Set((feedback ?? []).map((entry) => entry.field_id));
  return ids.has(CONTRIBUTION_FIELD_ID)
    && ids.has(REFLECTION_FIELD_ID)
    && feedbackIds.has(REFLECTION_FIELD_ID)
    && !feedbackIds.has(CONTRIBUTION_FIELD_ID);
}

export function feedbackFieldLabel(
  fields: FormField[] | undefined,
  feedback: CurieFieldFeedback[] | undefined,
  fieldId: string,
): string {
  if (
    fieldId === REFLECTION_FIELD_ID
    && isCombinedReflectionFeedback((fields ?? []).map((field) => field.id), feedback)
  ) {
    return COMBINED_REFLECTION_LABEL;
  }
  return fieldLabel(fields, fieldId);
}

export function feedbackAnchorFieldIds(
  fields: FormField[] | undefined,
  feedback: CurieFieldFeedback[] | undefined,
  fieldId: string,
): string[] {
  if (
    fieldId === REFLECTION_FIELD_ID
    && isCombinedReflectionFeedback((fields ?? []).map((field) => field.id), feedback)
  ) {
    return [CONTRIBUTION_FIELD_ID, REFLECTION_FIELD_ID];
  }
  return [fieldId];
}

export function isWeightedField(entry: CurieFieldFeedback): boolean {
  return Number(entry.weight) > 0;
}

export function orderFieldFeedback(
  fields: FormField[] | undefined,
  feedback: CurieFieldFeedback[] | undefined,
): CurieFieldFeedback[] {
  const items = feedback ?? [];
  if (!fields?.length) {
    return items.slice();
  }

  const byId = new Map(items.map((entry) => [entry.field_id, entry]));
  const ordered: CurieFieldFeedback[] = [];

  fields.forEach((field) => {
    const match = byId.get(field.id);
    if (match) {
      ordered.push(match);
      byId.delete(field.id);
    }
  });
  byId.forEach((entry) => ordered.push(entry));
  return ordered;
}

export function wholeStarCount(rating: number | null | undefined): number {
  if (rating == null || Number.isNaN(Number(rating))) {
    return 0;
  }
  return Math.max(0, Math.min(5, Math.round(Number(rating))));
}

export const AWAITING_APPROVAL_LABEL = 'Awaiting Instructor Review';

export function learnerVerdictLabel(
  status: CurieReviewStatus | null | undefined,
  verdict: CurieVerdict | null | undefined,
): string {
  if (status === 'pending_evaluation') {
    return 'Pending Evaluation';
  }
  if (status === 'ready_for_approval') {
    return AWAITING_APPROVAL_LABEL;
  }
  if (status === 'failed') {
    return 'Review Unavailable';
  }
  if (verdict === 'accepted') {
    return 'Accepted';
  }
  if (verdict === 'rejected') {
    return 'Rejected';
  }
  return 'Review';
}

export function historyRowStatus(version: SubmissionVersion): string {
  if (version.curie_review_status === 'ready_for_approval') { return AWAITING_APPROVAL_LABEL; }
  if (version.feedback_source === 'human') {
    if (version.feedback_status === 'approved') {
      return 'Accepted';
    }
    if (version.feedback_status === 'rejected') {
      return 'Rejected';
    }
    return 'Available for Review';
  }
  if (version.awaiting_instructor_approval) {
    return 'Awaiting Instructor Review';
  }
  if (version.curie_review_status === 'pending_evaluation') {
    return 'Pending Evaluation';
  }
  if (version.curie_review_status === 'failed') {
    return 'Review Unavailable';
  }
  if (
    version.verdict === 'accepted'
    || version.feedback_status === 'approved'
  ) {
    return 'Accepted';
  }
  if (
    version.verdict === 'rejected'
    || version.feedback_status === 'rejected'
  ) {
    return 'Rejected';
  }
  if (version.feedback_available) {
    return 'Available for Review';
  }
  return 'Pending Evaluation';
}

export const CAP_REACHED_MESSAGE = "You've used all 10 submission attempts for this assignment. Please reach out to your facilitator if you'd like to resubmit.";

export const PENDING_COPY = 'Curie is reviewing your submission — this usually takes just a moment. This page will update automatically.';

export const SLOW_PENDING_COPY = "This is taking longer than usual… we'll keep watching and update this page the moment Curie responds.";

export const AWAITING_INSTRUCTOR_APPROVAL_COPY = 'Curie has completed its review. Your instructor is checking it before it is shared with you. This page will update automatically when your feedback is available.';

export const LIVE_FAILED_COPY = "Curie wasn't able to complete a review for this submission. Your answers are unchanged below — resubmit whenever you're ready to try again.";

export const HISTORICAL_FAILED_COPY = 'CURIE did not complete a review for this attempt.';
export const AWAITING_APPROVAL_COPY = 'CURIE has completed its review. Your instructor is checking the feedback before it is shared with you. This page will update automatically once your feedback is approved.';

export const INSTRUCTOR_MODIFIED_NOTE = 'Reviewed and updated by your instructor.';

export const INSTRUCTOR_APPROVED_NOTE = 'Reviewed and approved by your instructor.';
