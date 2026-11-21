/**
 * Instructor release step for a ready_for_approval CURIE review:
 * approve unchanged, or edit scores/comments and approve as Human.
 * Both paths go through a confirmation dialog before anything is published.
 */

import React, { useMemo, useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import {
  ActionRow, Button, Form, ModalDialog, Spinner,
} from '@openedx/paragon';
import {
  adminSubmissionsApi,
  formatApiError,
  type CurieApprovalRequest,
  type CurieCriterionScore,
} from '../../services/api';
import {
  APPROVE_ACTION,
  APPROVE_CONFIRM_COPY,
  EDIT_AND_APPROVE_ACTION,
  EDIT_APPROVE_CONFIRM_COPY,
  GATE_OVERALL_LABEL,
  type StaffCurieReviewLike,
} from '../../utils/instructorCurieUi';

interface Props {
  submissionId: string;
  review: StaffCurieReviewLike;
  versionNumber: number;
  templateFields?: Record<string, string>;
  onApproved: () => void;
}

type ScoreInputs = Record<string, string>;

interface FieldDraft {
  comment: string;
  scores: ScoreInputs;
}

const MAX_SCORE = 10;

function toInputs(scores: Array<{ criterion: string; score: number }> | undefined): ScoreInputs {
  const result: ScoreInputs = {};
  (scores ?? []).forEach((row) => { result[row.criterion] = String(row.score); });
  return result;
}

function scoreError(raw: string | undefined): string | null {
  const trimmed = (raw ?? '').trim();
  if (trimmed === '') { return 'Required'; }
  const value = Number(trimmed);
  if (!Number.isFinite(value)) { return 'Enter a number'; }
  if (value < 0 || value > MAX_SCORE) { return `0–${MAX_SCORE}`; }
  return null;
}

function toScores(criteria: string[], inputs: ScoreInputs): CurieCriterionScore[] {
  return criteria.map((criterion) => ({
    criterion,
    score: Number(inputs[criterion]),
    max_score: MAX_SCORE,
  }));
}

export const CurieApprovalActions: React.FC<Props> = ({
  submissionId,
  review,
  versionNumber,
  templateFields = {},
  onApproved,
}) => {
  const criteria = useMemo(
    () => (review.gate_criterion_scores ?? []).map((row) => row.criterion),
    [review.gate_criterion_scores],
  );
  const fields = review.field_feedback ?? [];

  const [editing, setEditing] = useState(false);
  const [confirming, setConfirming] = useState<'approve' | 'override' | null>(null);
  const [showErrors, setShowErrors] = useState(false);
  const [overall, setOverall] = useState(review.overall_feedback ?? '');
  const [gateInputs, setGateInputs] = useState<ScoreInputs>(() => toInputs(review.gate_criterion_scores));
  const [fieldDrafts, setFieldDrafts] = useState<Record<string, FieldDraft>>(() => {
    const drafts: Record<string, FieldDraft> = {};
    fields.forEach((entry) => {
      drafts[entry.field_id] = {
        comment: entry.comment ?? '',
        scores: toInputs(entry.criterion_scores),
      };
    });
    return drafts;
  });

  const approveMut = useMutation({
    mutationFn: (payload: CurieApprovalRequest) => adminSubmissionsApi.approveCurieReview(submissionId, payload),
    onSuccess: () => {
      setConfirming(null);
      setEditing(false);
      onApproved();
    },
    onError: () => setConfirming(null),
  });

  const editErrors = useMemo(() => {
    const errors: string[] = [];
    if (!overall.trim()) { errors.push('Overall feedback is required.'); }
    criteria.forEach((criterion) => {
      if (scoreError(gateInputs[criterion])) { errors.push(`${GATE_OVERALL_LABEL}: ${criterion}`); }
    });
    fields.forEach((entry) => {
      const draft = fieldDrafts[entry.field_id];
      const label = templateFields[entry.field_id] ?? entry.field_id;
      if (!draft?.comment.trim()) { errors.push(`${label}: comment is required.`); }
      criteria.forEach((criterion) => {
        if (scoreError(draft?.scores[criterion])) { errors.push(`${label}: ${criterion}`); }
      });
    });
    return errors;
  }, [overall, gateInputs, fieldDrafts, criteria, fields, templateFields]);

  const buildPayload = (action: 'approve' | 'override'): CurieApprovalRequest => {
    const base: CurieApprovalRequest = {
      action,
      submission_version_number: versionNumber,
      trigger_id: review.trigger_id,
    };
    if (action === 'approve') { return base; }
    return {
      ...base,
      overall_feedback: overall,
      gate_criterion_scores: toScores(criteria, gateInputs),
      field_feedback: fields.map((entry) => ({
        field_id: entry.field_id,
        comment: fieldDrafts[entry.field_id]?.comment ?? '',
        criterion_scores: toScores(criteria, fieldDrafts[entry.field_id]?.scores ?? {}),
      })),
    };
  };

  const requestOverride = () => {
    setShowErrors(true);
    if (editErrors.length === 0) { setConfirming('override'); }
  };

  const busy = approveMut.isPending;

  const scoreInput = (
    id: string,
    label: string,
    value: string | undefined,
    onChange: (next: string) => void,
  ) => (
    <Form.Group className="mb-2" controlId={id} key={id}>
      <Form.Label className="small mb-1">{label}</Form.Label>
      <Form.Control
        type="number"
        min={0}
        max={MAX_SCORE}
        step="any"
        value={value ?? ''}
        isInvalid={showErrors && Boolean(scoreError(value))}
        onChange={(e: React.ChangeEvent<HTMLInputElement>) => onChange(e.target.value)}
        style={{ maxWidth: 120 }}
      />
    </Form.Group>
  );

  return (
    <div className="mt-3" data-testid="curie-approval-actions">
      {!editing && (
        <div className="d-flex flex-wrap" style={{ gap: '0.5rem' }}>
          <Button variant="brand" onClick={() => setConfirming('approve')} disabled={busy}>
            {APPROVE_ACTION}
          </Button>
          <Button variant="outline-primary" onClick={() => setEditing(true)} disabled={busy}>
            {EDIT_AND_APPROVE_ACTION}
          </Button>
        </div>
      )}

      {editing && (
        <div data-testid="curie-approval-editor">
          <Form.Group className="mb-3" controlId="curie-edit-overall">
            <Form.Label className="small font-weight-bold">Overall feedback</Form.Label>
            <Form.Control
              as="textarea"
              rows={4}
              value={overall}
              isInvalid={showErrors && !overall.trim()}
              onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setOverall(e.target.value)}
            />
          </Form.Group>

          <p className="small font-weight-bold text-muted text-uppercase mb-1">{GATE_OVERALL_LABEL}</p>
          <div className="d-flex flex-wrap mb-3" style={{ gap: '1rem' }}>
            {criteria.map((criterion) => scoreInput(
              `curie-edit-gate-${criterion}`,
              criterion,
              gateInputs[criterion],
              (next) => setGateInputs((prev) => ({ ...prev, [criterion]: next })),
            ))}
          </div>

          {fields.map((entry) => {
            const label = templateFields[entry.field_id] ?? entry.field_id;
            const draft = fieldDrafts[entry.field_id];
            return (
              <div key={entry.field_id} className="border rounded p-3 mb-3">
                <p className="font-weight-bold mb-2">{label}</p>
                <Form.Group className="mb-2" controlId={`curie-edit-comment-${entry.field_id}`}>
                  <Form.Label className="small">Comment</Form.Label>
                  <Form.Control
                    as="textarea"
                    rows={3}
                    value={draft?.comment ?? ''}
                    isInvalid={showErrors && !draft?.comment.trim()}
                    onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => {
                      const next = e.target.value;
                      setFieldDrafts((prev) => ({
                        ...prev,
                        [entry.field_id]: { ...prev[entry.field_id], comment: next },
                      }));
                    }}
                  />
                </Form.Group>
                <div className="d-flex flex-wrap" style={{ gap: '1rem' }}>
                  {criteria.map((criterion) => scoreInput(
                    `curie-edit-${entry.field_id}-${criterion}`,
                    criterion,
                    draft?.scores[criterion],
                    (next) => setFieldDrafts((prev) => ({
                      ...prev,
                      [entry.field_id]: {
                        ...prev[entry.field_id],
                        scores: { ...prev[entry.field_id].scores, [criterion]: next },
                      },
                    })),
                  ))}
                </div>
              </div>
            );
          })}

          {showErrors && editErrors.length > 0 && (
            <div className="alert alert-danger small" role="alert">
              Fix the highlighted fields before approving.
            </div>
          )}

          <div className="d-flex" style={{ gap: '0.5rem' }}>
            <Button variant="brand" onClick={requestOverride} disabled={busy}>
              Approve edited feedback
            </Button>
            <Button variant="tertiary" onClick={() => setEditing(false)} disabled={busy}>
              Cancel
            </Button>
          </div>
        </div>
      )}

      {approveMut.isError && (
        <div className="alert alert-danger mt-2 small" role="alert">
          {formatApiError(approveMut.error, 'Failed to approve CURIE feedback.')}
        </div>
      )}

      <ModalDialog
        title="Publish feedback to student"
        isOpen={confirming !== null}
        onClose={() => { if (!busy) { setConfirming(null); } }}
        size="md"
        hasCloseButton
        isOverflowVisible={false}
      >
        <ModalDialog.Header>
          <ModalDialog.Title>Publish feedback to student?</ModalDialog.Title>
        </ModalDialog.Header>
        <ModalDialog.Body>
          <p className="mb-0">
            {confirming === 'override' ? EDIT_APPROVE_CONFIRM_COPY : APPROVE_CONFIRM_COPY}
          </p>
        </ModalDialog.Body>
        <ModalDialog.Footer>
          <ActionRow>
            <ModalDialog.CloseButton variant="tertiary" disabled={busy}>
              Cancel
            </ModalDialog.CloseButton>
            <Button
              variant="brand"
              disabled={busy}
              onClick={() => { if (confirming) { approveMut.mutate(buildPayload(confirming)); } }}
            >
              {busy ? <Spinner animation="border" size="sm" screenReaderText="Publishing" /> : 'Publish'}
            </Button>
          </ActionRow>
        </ModalDialog.Footer>
      </ModalDialog>
    </div>
  );
};
