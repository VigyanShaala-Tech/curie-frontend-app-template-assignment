/**
 * StudentFeedbackPanel
 * Read-only instructor feedback shown to learners after submission.
 * Renders stored Instructor Comment HTML with category headings stripped.
 */

import React from 'react';
import { Badge, Card } from '@openedx/paragon';
import type { SubmissionFeedback } from '../types';
import { stripCategoryHeadingsFromComment } from '../utils/flattenStudentFeedback';
import { InstructorCommentHtml } from './admin/InstructorCommentHtml';

interface Props {
  feedback: SubmissionFeedback;
}

const FEEDBACK_BADGE: Record<string, string> = {
  pending: 'secondary',
  approved: 'success',
  rejected: 'danger',
};

export const StudentFeedbackPanel: React.FC<Props> = ({ feedback }) => {
  const displayComment = stripCategoryHeadingsFromComment(feedback.comment ?? '');
  const isCurie = feedback.source === 'curie';
  const fieldComments = (feedback.field_feedback ?? []).filter((entry) => entry.comment);

  return (
    <Card className="shadow-sm mt-4">
      <Card.Header title={isCurie ? 'CURIE review' : 'Instructor Feedback'} />
      <Card.Section>
        <Badge variant={FEEDBACK_BADGE[feedback.status] ?? 'secondary'} className="mb-3">
          {feedback.status}
        </Badge>
        {isCurie && (
          <div className="small text-muted mb-3">
            Automatic review{feedback.verdict ? ` · ${feedback.verdict}` : ''}
          </div>
        )}

        {!displayComment.trim() ? (
          <div className="small text-muted">No instructor comment.</div>
        ) : (
          <InstructorCommentHtml comment={displayComment} className="small mb-0" />
        )}

        {fieldComments.length > 0 && (
          <ul className="small mt-3 mb-0 ps-3">
            {fieldComments.map((entry) => (
              <li key={entry.field_id} className="mb-2">
                <strong>{entry.field_id}:</strong> {entry.comment}
              </li>
            ))}
          </ul>
        )}
      </Card.Section>
    </Card>
  );
};
