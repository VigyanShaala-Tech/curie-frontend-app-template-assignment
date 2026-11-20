import React from 'react';
import { Card, Form } from '@openedx/paragon';
import {
  EVALUATION_DIMENSIONS,
  scoreErrorKey,
  type EvaluationDimension,
  type FieldEvaluationSection,
  type FieldFeedbackDraft,
  type FieldScoreDraft,
} from '../../utils/fieldEvaluation';

interface Props {
  sections: FieldEvaluationSection[];
  scores?: FieldScoreDraft;
  feedback?: FieldFeedbackDraft;
  errors?: Record<string, string>;
  readOnly?: boolean;
  onScoreChange?: (fieldId: string, dimension: EvaluationDimension, value: string) => void;
  onFeedbackChange?: (fieldId: string, value: string) => void;
}

const cardStyle: React.CSSProperties = {
  border: '1px solid #ced4da',
  borderRadius: '8px',
  boxShadow: '0 1px 3px rgba(0, 0, 0, 0.06)',
};

const scoreGridStyle: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
  gap: '0.75rem',
};

const inputStyle: React.CSSProperties = {
  border: '1px solid #00262b',
  borderRadius: '0.25rem',
  textAlign: 'center',
  height: '38px',
  width: '100%',
};

const feedbackStyle: React.CSSProperties = {
  width: '100%',
  minHeight: '7.5rem',
  whiteSpace: 'pre-wrap',
};

export const FieldEvaluationCards: React.FC<Props> = ({
  sections,
  scores = {},
  feedback = {},
  errors = {},
  readOnly = false,
  onScoreChange,
  onFeedbackChange,
}) => (
  <div data-testid="field-evaluation-cards">
    {sections.map((section) => (
      <Card key={section.fieldId} className="mb-4" style={cardStyle}>
        <Card.Section className="p-3 p-md-4">
          <h3 className="mb-3 font-weight-bold" style={{ fontSize: '1.15rem', lineHeight: 1.3 }}>
            {section.label}
          </h3>
          <div style={scoreGridStyle}>
            {EVALUATION_DIMENSIONS.map((dimension) => {
              const errorKey = scoreErrorKey(section.fieldId, dimension);
              const value = scores[section.fieldId]?.[dimension] ?? section.scores[dimension] ?? '';
              return (
                <Form.Group key={errorKey} className="mb-0">
                  <Form.Label className="small font-weight-bold">{dimension}</Form.Label>
                  {readOnly ? (
                    <div className="small">{value === '' ? '—' : value}</div>
                  ) : (
                    <Form.Control
                      type="number"
                      min={0}
                      max={10}
                      step="any"
                      value={value}
                      aria-label={`${section.label} ${dimension}`}
                      isInvalid={Boolean(errors[errorKey])}
                      onChange={(event: React.ChangeEvent<HTMLInputElement>) => {
                        onScoreChange?.(section.fieldId, dimension, event.target.value);
                      }}
                      style={inputStyle}
                    />
                  )}
                  {errors[errorKey] && (
                    <div className="small text-danger mt-1">{errors[errorKey]}</div>
                  )}
                </Form.Group>
              );
            })}
          </div>
          <Form.Group className="mb-0 mt-3">
            <Form.Label className="small font-weight-bold">Section feedback</Form.Label>
            {readOnly ? (
              <p className="small mb-0" style={{ whiteSpace: 'pre-wrap' }}>
                {(feedback[section.fieldId] ?? section.feedback) || '—'}
              </p>
            ) : (
              <Form.Control
                as="textarea"
                value={feedback[section.fieldId] ?? section.feedback}
                aria-label={`${section.label} section feedback`}
                onChange={(event: React.ChangeEvent<HTMLTextAreaElement>) => {
                  onFeedbackChange?.(section.fieldId, event.target.value);
                }}
                style={feedbackStyle}
              />
            )}
          </Form.Group>
        </Card.Section>
      </Card>
    ))}
  </div>
);
