import React from 'react';
import { LIVE_FAILED_COPY, PENDING_COPY, SLOW_PENDING_COPY } from '../utils/curieReview';

interface Props {
  variant: 'pending' | 'slow' | 'live_failed';
}

export const CurieReviewPending: React.FC<Props> = ({ variant }) => {
  if (variant === 'live_failed') {
    return (
      <div>
        <h3 className="curie-review-heading">Curie Review</h3>
        <p className="curie-pending-note">{LIVE_FAILED_COPY}</p>
      </div>
    );
  }

  const copy = variant === 'slow' ? SLOW_PENDING_COPY : PENDING_COPY;
  return (
    <div>
      <h3 className="curie-review-heading">Curie Review</h3>
      <div className="curie-pending-note curie-pending-spinner-row" role="status">
        <span className="curie-spinner" aria-hidden="true" />
        <span>{copy}</span>
      </div>
    </div>
  );
};
