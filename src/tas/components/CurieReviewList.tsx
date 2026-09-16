import React from 'react';
import type { CurieFieldFeedback, FormField } from '../types';
import { FIELD_COLOR_LABEL, fieldLabel, isWeightedField } from '../utils/curieReview';

interface Props {
  fields: FormField[];
  feedback: CurieFieldFeedback[];
}

export const CurieReviewList: React.FC<Props> = ({ fields, feedback }) => {
  if (!feedback.length) return null;

  return (
    <div>
      <div className="curie-section-title">Field-by-Field Feedback</div>
      {feedback.map((entry, index) => {
        const color = isWeightedField(entry) ? (entry.color ?? null) : null;
        const colorClass = color ?? '';
        return (
          <div
            key={entry.field_id}
            id={`curie-field-review-${entry.field_id}`}
            className={`curie-field-feedback-item ${colorClass}`}
            tabIndex={-1}
          >
            <div className="curie-field-feedback-label">
              <span className="curie-pin-badge" aria-hidden="true">{index + 1}</span>
              {fieldLabel(fields, entry.field_id)}
              {color && (
                <span className={`curie-field-verdict-badge ${color}`}>
                  {FIELD_COLOR_LABEL[color]}
                </span>
              )}
            </div>
            <div className="curie-field-feedback-text">{entry.comment}</div>
          </div>
        );
      })}
    </div>
  );
};
