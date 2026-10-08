import React from 'react';
import { Badge } from '@openedx/paragon';
import {
  GATE_OVERALL_LABEL,
  INSTRUCTOR_FAILED_RECOVERY_COPY,
  INSTRUCTOR_HUMAN_OWNS_COPY,
  INSTRUCTOR_OVERRIDE_COPY,
  INSTRUCTOR_PENDING_COPY,
  INSTRUCTOR_SLOW_PENDING_COPY,
  fieldScoreOutOfTen,
  formatScoreOutOfTen,
  type InstructorCuriePresentation,
  type StaffCurieReviewLike,
} from '../../utils/instructorCurieUi';
import { wholeStarCount } from '../../utils/curieReview';

interface Props {
  presentation: InstructorCuriePresentation;
  review?: StaffCurieReviewLike | null;
  templateFields?: Record<string, string>;
  overrideEditing?: boolean;
}

const ScoreRow = ({ label, value }: { label: string; value: string }) => (
  <div
    className="d-flex justify-content-between small py-1"
    style={{ borderBottom: '1px solid #e9ecef' }}
  >
    <span>{label}</span>
    <strong>{value}</strong>
  </div>
);

export const InstructorCuriePanel: React.FC<Props> = ({
  presentation,
  review,
  templateFields = {},
  overrideEditing = false,
}) => {
  if (
    !presentation.formLocked
    && !presentation.showFailedRecovery
    && !presentation.showReadyOutput
    && !presentation.humanOwns
  ) {
    return null;
  }

  const fieldEntries = review?.field_feedback ?? [];
  const scoredFields = fieldEntries.filter((entry) => fieldScoreOutOfTen(entry) != null);
  const criterionWise = Object.entries(review?.criterion_wise_scores ?? {});
  const showScoreSummaries = Boolean(presentation.showReadyOutput && review);

  return (
    <div className="mb-3" data-testid="instructor-curie-panel">
      {presentation.formLocked && (
        <div className="alert alert-info small mb-3" role="status">
          {presentation.isSlowPending ? INSTRUCTOR_SLOW_PENDING_COPY : INSTRUCTOR_PENDING_COPY}
        </div>
      )}

      {presentation.showFailedRecovery && (
        <div className="alert alert-warning small mb-3" role="status">
          {INSTRUCTOR_FAILED_RECOVERY_COPY}
          {review?.error_detail ? (
            <div className="mt-1 text-muted">{review.error_detail}</div>
          ) : null}
        </div>
      )}

      {presentation.humanOwns && (
        <div className="alert alert-secondary small mb-3" role="status">
          {INSTRUCTOR_HUMAN_OWNS_COPY}
        </div>
      )}

      {overrideEditing && presentation.requireOverrideConfirm && (
        <div className="alert alert-warning small mb-3" role="status">
          {INSTRUCTOR_OVERRIDE_COPY}
        </div>
      )}

      {showScoreSummaries && (
        <div className="mb-0" data-testid="curie-staff-output">
          <div className="d-flex align-items-center mb-2" style={{ gap: '0.5rem' }}>
            {review?.verdict && (
              <Badge variant={review.verdict === 'accepted' ? 'success' : 'danger'}>
                {review.verdict === 'accepted' ? 'Accepted' : 'Rejected'}
              </Badge>
            )}
            {review?.star_rating != null && (
              <span className="small text-muted" aria-label={`${wholeStarCount(review.star_rating)} of 5 stars`}>
                {'★'.repeat(wholeStarCount(review.star_rating))}
                {'☆'.repeat(5 - wholeStarCount(review.star_rating))}
              </span>
            )}
          </div>

          <div data-testid="curie-gate-summary">
            <p className="small font-weight-bold text-muted text-uppercase mb-1" style={{ letterSpacing: '0.04em' }}>
              Gate
            </p>
            <ScoreRow label={GATE_OVERALL_LABEL} value={formatScoreOutOfTen(review?.gate_score)} />
          </div>

          {scoredFields.length === 0 ? (
            <p className="small text-muted mt-2 mb-0">
              Gate did not pass, so components were not individually scored. See CURIE comments below.
            </p>
          ) : (
            <>
              <div className="mt-3" data-testid="curie-criterion-wise">
                <p className="small font-weight-bold text-muted text-uppercase mb-1" style={{ letterSpacing: '0.04em' }}>
                  Criterion-wise score
                </p>
                {criterionWise.map(([name, score]) => (
                  <ScoreRow key={name} label={name} value={formatScoreOutOfTen(score)} />
                ))}
              </div>
              <div className="mt-3" data-testid="curie-by-field">
                <p className="small font-weight-bold text-muted text-uppercase mb-1" style={{ letterSpacing: '0.04em' }}>
                  By field
                </p>
                {fieldEntries.map((entry) => {
                  const label = templateFields[entry.field_id] ?? entry.field_id;
                  return (
                    <ScoreRow
                      key={entry.field_id}
                      label={label}
                      value={formatScoreOutOfTen(fieldScoreOutOfTen(entry))}
                    />
                  );
                })}
              </div>
            </>
          )}

          <p className="small text-muted mt-2 mb-2">
            Raw scores stay on this instructor view. Students never see them.
          </p>

          {review?.overall_feedback ? (
            <p className="small mb-2" data-testid="curie-overall-comment">{review.overall_feedback}</p>
          ) : null}

          {fieldEntries.some((entry) => entry.comment) && (
            <ul className="small mb-0 pl-3" data-testid="curie-field-comments">
              {fieldEntries.filter((entry) => entry.comment).map((entry) => {
                const label = templateFields[entry.field_id] ?? entry.field_id;
                return (
                  <li key={`comment-${entry.field_id}`}>
                    <strong>{label}:</strong>
                    {' '}
                    {entry.comment}
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      )}
    </div>
  );
};
