import React from 'react';
import { wholeStarCount } from '../utils/curieReview';

interface Props {
  rating: number | null | undefined;
}

export const CurieStarRating: React.FC<Props> = ({ rating }) => {
  const filled = wholeStarCount(rating);
  const stars = `${'★'.repeat(filled)}${'☆'.repeat(5 - filled)}`;
  return (
    <div className="curie-rating-row">
      <span className="curie-star-rating" aria-label={`${filled} out of 5 stars`}>
        {stars}
      </span>
    </div>
  );
};
