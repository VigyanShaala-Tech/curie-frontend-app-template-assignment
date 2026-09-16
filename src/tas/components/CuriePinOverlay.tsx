import React from 'react';
import type { CurieFieldFeedback, FormField, FieldPosition } from '../types';
import { fieldLabel } from '../utils/curieReview';

interface Props {
  fields: FormField[];
  positions: Record<string, FieldPosition>;
  feedback: CurieFieldFeedback[];
  isMobile?: boolean;
  onActivate?: (fieldId: string) => void;
}

export const CuriePinOverlay: React.FC<Props> = ({
  fields,
  positions,
  feedback,
  isMobile = false,
  onActivate,
}) => {
  if (!feedback.length) return null;

  return (
    <div className="curie-pin-overlay" aria-hidden={false}>
      {feedback.map((entry, index) => {
        const position = positions[entry.field_id];
        if (!position) return null;
        const n = index + 1;
        const label = fieldLabel(fields, entry.field_id);
        return (
          <button
            key={entry.field_id}
            id={`curie-pin-${entry.field_id}`}
            type="button"
            className="curie-field-pin"
            style={{
              top: `${position.y + position.height / 2}%`,
              left: `${position.x + position.width / 2}%`,
              width: isMobile ? 44 : 22,
              height: isMobile ? 44 : 22,
              fontSize: isMobile ? 14 : 12,
            }}
            aria-label={`Field ${n}: ${label}`}
            onClick={() => onActivate?.(entry.field_id)}
          >
            {n}
          </button>
        );
      })}
    </div>
  );
};
