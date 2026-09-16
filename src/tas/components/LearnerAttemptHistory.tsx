import React from 'react';
import type { SubmissionVersion } from '../types';
import { historyRowStatus, wholeStarCount } from '../utils/curieReview';

interface Props {
  versions: SubmissionVersion[];
  onViewFeedback: (version: SubmissionVersion) => void;
}

function canOpenFeedback(version: SubmissionVersion): boolean {
  return Boolean(
    version.feedback_available
    || version.curie_review_status
    || version.instructor_comment,
  );
}

export const LearnerAttemptHistory: React.FC<Props> = ({ versions, onViewFeedback }) => {
  return (
    <div className="curie-attempt-history">
      {versions.length === 0 ? (
        <p className="text-muted small mb-0">No submitted attempts yet.</p>
      ) : (
        <table className="curie-attempt-history-table">
          <thead>
            <tr>
              <th>Attempt</th>
              <th>Submitted</th>
              <th>Status</th>
              <th>Rating</th>
              <th>Action</th>
            </tr>
          </thead>
          <tbody>
            {versions.map((version, index) => {
              const attempt = version.attempt_number ?? (versions.length - index);
              const stars = wholeStarCount(version.star_rating);
              const openable = canOpenFeedback(version);
              return (
                <tr key={version.version_number}>
                  <td data-label="Attempt">{`Attempt ${attempt}`}</td>
                  <td data-label="Submitted">
                    {version.submitted_at ? new Date(version.submitted_at).toLocaleString() : '—'}
                  </td>
                  <td data-label="Status">
                    <span className={`curie-history-badge ${historyRowStatus(version).replace(/\s+/g, '-').toLowerCase()}`}>
                      {historyRowStatus(version)}
                    </span>
                  </td>
                  <td data-label="Rating" className="curie-stars-cell">
                    {version.star_rating == null
                      ? <span className="curie-pending-dash">—</span>
                      : <span aria-label={`${stars} out of 5 stars`}>{'★'.repeat(stars)}{'☆'.repeat(5 - stars)}</span>}
                  </td>
                  <td>
                    <button
                      type="button"
                      className="curie-history-view-btn"
                      disabled={!openable}
                      onClick={() => onViewFeedback(version)}
                    >
                      View Detailed Feedback
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
    </div>
  );
};
