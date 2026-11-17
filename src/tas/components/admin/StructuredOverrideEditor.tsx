import React, { useMemo, useState } from 'react';
import { Button, Form, Spinner } from '@openedx/paragon';
import type { StructuredFeedback } from '../../types';
import {
  GATE_OVERALL_LABEL,
  type StaffCurieReviewLike,
} from '../../utils/instructorCurieUi';
import {
  COMBINED_REFLECTION_LABEL,
  isCombinedReflectionFeedback,
} from '../../utils/curieReview';

interface Props {
  review: StaffCurieReviewLike;
  templateFields: Record<string, string>;
  isSaving: boolean;
  onSubmit: (status: 'approved' | 'rejected', feedback: StructuredFeedback) => void;
}

type EditableScore = { criterion: string; score: string; max_score: number };
type EditableField = {
  field_id: string;
  weight: number;
  comment: string;
  criterion_scores: EditableScore[];
};

const editableScores = (scores: Array<{ criterion: string; score: number; max_score?: number }> = []) => (
  scores.map((item) => ({
    criterion: item.criterion,
    score: String(item.score),
    max_score: item.max_score ?? 10,
  }))
);

export const StructuredOverrideEditor: React.FC<Props> = ({
  review,
  templateFields,
  isSaving,
  onSubmit,
}) => {
  const [gateScores, setGateScores] = useState<EditableScore[]>(
    editableScores(review.gate_criterion_scores),
  );
  const [fields, setFields] = useState<EditableField[]>(
    (review.field_feedback ?? []).map((entry) => ({
      field_id: entry.field_id,
      weight: entry.weight ?? 1,
      comment: entry.comment ?? '',
      criterion_scores: editableScores(entry.criterion_scores),
    })),
  );
  const [overallFeedback, setOverallFeedback] = useState(review.overall_feedback ?? '');
  const [error, setError] = useState('');

  const combinedReflection = useMemo(
    () => isCombinedReflectionFeedback(Object.keys(templateFields), fields),
    [templateFields, fields],
  );
  const fieldLabel = (fieldId: string) => (
    combinedReflection && fieldId === 'reflection'
      ? COMBINED_REFLECTION_LABEL
      : templateFields[fieldId] ?? fieldId
  );

  const normalizedScores = (scores: EditableScore[]) => scores.map((item) => ({
    criterion: item.criterion,
    score: Number(item.score),
    max_score: item.max_score,
  }));

  const submit = (status: 'approved' | 'rejected') => {
    const allScores = [
      ...gateScores,
      ...fields.flatMap((field) => field.criterion_scores),
    ];
    if (
      gateScores.length === 0
      || fields.length === 0
      || allScores.some((item) => (
        item.score.trim() === ''
        || !Number.isFinite(Number(item.score))
        || Number(item.score) < 0
        || Number(item.score) > 10
      ))
    ) {
      setError('Every score is required and must be between 0 and 10.');
      return;
    }
    if (!overallFeedback.trim() || fields.some((field) => !field.comment.trim())) {
      setError('Overall feedback and every section comment are required.');
      return;
    }
    setError('');
    onSubmit(status, {
      gate_criterion_scores: normalizedScores(gateScores),
      field_feedback: fields.map((field) => ({
        field_id: field.field_id,
        weight: field.weight,
        comment: field.comment.trim(),
        criterion_scores: normalizedScores(field.criterion_scores),
      })),
      overall_feedback: overallFeedback.trim(),
    });
  };

  const scoreInputs = (
    scores: EditableScore[],
    update: (next: EditableScore[]) => void,
  ) => (
    <div className="row">
      {scores.map((item, index) => (
        <div className="col-12 col-md-4 mb-2" key={item.criterion}>
          <Form.Label className="small mb-1">{item.criterion}</Form.Label>
          <Form.Control
            aria-label={item.criterion}
            type="number"
            min={0}
            max={10}
            step="any"
            value={item.score}
            onChange={(event: React.ChangeEvent<HTMLInputElement>) => {
              const next = [...scores];
              next[index] = { ...item, score: event.target.value };
              update(next);
            }}
          />
        </div>
      ))}
    </div>
  );

  return (
    <div data-testid="structured-override-editor">
      <h3 className="h6">{GATE_OVERALL_LABEL}</h3>
      {scoreInputs(gateScores, setGateScores)}

      {fields.map((field, fieldIndex) => (
        <div className="border rounded p-3 mb-3" key={field.field_id}>
          <h3 className="h6 mb-2">{fieldLabel(field.field_id)}</h3>
          {scoreInputs(field.criterion_scores, (criterionScores) => {
            const next = [...fields];
            next[fieldIndex] = { ...field, criterion_scores: criterionScores };
            setFields(next);
          })}
          <Form.Group className="mb-0">
            <Form.Label className="small mb-1">Section feedback</Form.Label>
            <Form.Control
              as="textarea"
              rows={3}
              aria-label={`${fieldLabel(field.field_id)} feedback`}
              value={field.comment}
              onChange={(event: React.ChangeEvent<HTMLTextAreaElement>) => {
                const next = [...fields];
                next[fieldIndex] = { ...field, comment: event.target.value };
                setFields(next);
              }}
            />
          </Form.Group>
        </div>
      ))}

      <Form.Group>
        <Form.Label className="font-weight-bold">Overall feedback</Form.Label>
        <Form.Control
          as="textarea"
          rows={4}
          aria-label="Overall feedback"
          value={overallFeedback}
          onChange={(event: React.ChangeEvent<HTMLTextAreaElement>) => setOverallFeedback(event.target.value)}
        />
      </Form.Group>

      {error && <div className="alert alert-danger small">{error}</div>}
      <div className="d-flex" style={{ gap: '0.5rem' }}>
        <Button variant="brand" disabled={isSaving} onClick={() => submit('approved')}>
          {isSaving ? <Spinner animation="border" size="sm" screenReaderText="Saving" /> : 'Approve'}
        </Button>
        <Button variant="outline-danger" disabled={isSaving} onClick={() => submit('rejected')}>
          Reattempt
        </Button>
      </div>
    </div>
  );
};
