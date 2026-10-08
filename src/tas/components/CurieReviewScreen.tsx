/**
 * Learner CURIE review (screens 4/5/6): worksheet + pins, review panel,
 * inline reattempt, pending/live-fail, cap, and two-tab mobile layout.
 * Chat is out of scope.
 */

import React, {
  useEffect, useLayoutEffect, useMemo, useState,
} from 'react';
import { ActionRow, Button, ModalDialog } from '@openedx/paragon';
import { Link } from 'react-router-dom';
import { TemplateCanvas } from './TemplateCanvas';
import { CuriePinOverlay } from './CuriePinOverlay';
import { CurieReviewList } from './CurieReviewList';
import { CurieReviewPending } from './CurieReviewPending';
import { CurieStarRating } from './CurieStarRating';
import { PdfPoller } from './PdfPoller';
import { getActiveFields } from '../utils/activeFields';
import { applyTextCandidate } from '../utils/clampTextToField';
import { resolveFieldLayout } from '../utils/fieldLayout';
import {
  CAP_REACHED_MESSAGE,
  HISTORICAL_FAILED_COPY,
  learnerVerdictLabel,
  orderFieldFeedback,
} from '../utils/curieReview';
import type { DisplayState } from '../lifecycle/deriveLifecycle';
import type {
  FormField, LearnerCurieReview, Submission, Template,
} from '../types';

interface Props {
  template: Template;
  displayState: Extract<DisplayState, 'pending' | 'live_failed' | 'curie_accepted' | 'curie_rejected'>;
  review: LearnerCurieReview | null;
  title: string;
  submittedAt?: string | null;
  usageKey: string;
  formData: Record<string, string>;
  atMaxAttempts: boolean;
  canReattempt: boolean;
  isSlowPending: boolean;
  isSaving: boolean;
  isMobile: boolean;
  historical?: boolean;
  attemptNumber?: number | null;
  submission?: Submission | null;
  onBack: () => void;
  onRequestSubmit: (formData: Record<string, string>) => void;
}

export const CurieReviewScreen: React.FC<Props> = ({
  template,
  displayState,
  review,
  title,
  submittedAt,
  usageKey,
  formData,
  atMaxAttempts,
  canReattempt,
  isSlowPending,
  isSaving,
  isMobile,
  historical = false,
  attemptNumber,
  submission,
  onBack,
  onRequestSubmit,
}) => {
  const [mobileTab, setMobileTab] = useState<'worksheet' | 'review'>('worksheet');
  const [editing, setEditing] = useState(false);
  const [previewingDraft, setPreviewingDraft] = useState(false);
  const [clearConfirmOpen, setClearConfirmOpen] = useState(false);
  const [draft, setDraft] = useState<Record<string, string>>(formData);
  const [capacityFull, setCapacityFull] = useState<Record<string, boolean>>({});
  const [pendingPinScroll, setPendingPinScroll] = useState<string | null>(null);

  const pending = displayState === 'pending';
  const liveFailed = displayState === 'live_failed';
  const accepted = displayState === 'curie_accepted';
  const rejected = displayState === 'curie_rejected';

  useEffect(() => {
    if (pending || !canReattempt || atMaxAttempts || historical) {
      setEditing(false);
      setPreviewingDraft(false);
      setClearConfirmOpen(false);
    }
  }, [pending, canReattempt, atMaxAttempts, historical, displayState, review?.submission_version_number]);

  useLayoutEffect(() => {
    if (!pendingPinScroll) { return; }
    if (isMobile && mobileTab !== 'review') { return; }
    document.getElementById(`curie-field-review-${pendingPinScroll}`)?.scrollIntoView({
      block: 'nearest',
    });
    setPendingPinScroll(null);
  }, [pendingPinScroll, mobileTab, isMobile]);

  const orderedFeedback = useMemo(
    () => orderFieldFeedback(template.fields, review?.field_feedback),
    [template.fields, review?.field_feedback],
  );
  const showPins = !pending && !liveFailed && !editing && orderedFeedback.length > 0;
  const showStars = Boolean(review?.star_rating != null && orderedFeedback.length > 0);
  const allowReattempt = !historical && canReattempt && !atMaxAttempts;
  const showCap = !historical && (rejected || liveFailed) && atMaxAttempts;
  const historyHref = `/submission/${encodeURIComponent(usageKey)}/history`;

  let verdictLabel = learnerVerdictLabel(
    review?.status,
    review?.verdict ?? (accepted ? 'accepted' : 'rejected'),
  );
  if (pending) {
    verdictLabel = 'Pending Evaluation';
  } else if (liveFailed) {
    verdictLabel = 'Review Unavailable';
  }
  let verdictClass = '';
  if (!pending && !liveFailed) {
    verdictClass = accepted || review?.verdict === 'accepted' ? 'accepted' : 'rejected';
  }

  const activeFields = getActiveFields(template);
  const fieldLayouts = useMemo(() => {
    const imageW = template.image_width || 794;
    const imageH = template.image_height || 1123;
    const layouts: Record<string, ReturnType<typeof resolveFieldLayout>> = {};
    activeFields.forEach((field: FormField) => {
      if (field.type === 'select' || field.type === 'date' || field.type === 'number'
        || field.type === 'checkbox' || field.type === 'radio') {
        return;
      }
      const pos = template.field_positions[field.id];
      if (!pos) { return; }
      layouts[field.id] = resolveFieldLayout(field, pos, imageW, imageH);
    });
    return layouts;
  }, [activeFields, template.field_positions, template.image_height, template.image_width]);

  const updateDraftField = (fieldId: string, candidate: string) => {
    setDraft((prev) => {
      const layout = fieldLayouts[fieldId];
      if (!layout) {
        return { ...prev, [fieldId]: candidate };
      }
      const result = applyTextCandidate(prev[fieldId] ?? '', candidate, layout);
      setCapacityFull((map) => ({ ...map, [fieldId]: result.capacityFull }));
      return { ...prev, [fieldId]: result.value };
    });
  };

  const openEdit = () => {
    setDraft({ ...formData });
    setCapacityFull({});
    setEditing(true);
    setPreviewingDraft(false);
    setMobileTab('worksheet');
  };

  const cancelEdit = () => {
    setEditing(false);
    setPreviewingDraft(false);
    setClearConfirmOpen(false);
  };

  const clearDraft = () => {
    setDraft({});
    setCapacityFull({});
    setClearConfirmOpen(false);
  };

  const confirmOpenEdit = () => {
    if (window.confirm('Editing will let you revise your answers and resubmit for a new review. Continue?')) {
      openEdit();
    }
  };

  let reviewBody: React.ReactNode;
  if (pending) {
    reviewBody = <CurieReviewPending variant={isSlowPending ? 'slow' : 'pending'} />;
  } else if (liveFailed && historical) {
    reviewBody = (
      <div>
        <h3 className="curie-review-heading">Curie Review</h3>
        <p className="curie-pending-note">{HISTORICAL_FAILED_COPY}</p>
      </div>
    );
  } else if (liveFailed) {
    reviewBody = <CurieReviewPending variant="live_failed" />;
  } else {
    reviewBody = (
      <div>
        <h3 className="curie-review-heading">Curie Review</h3>
        {showStars && <CurieStarRating rating={review?.star_rating} />}
        <div className="curie-section-title">Overall Feedback</div>
        <div className="curie-overall-feedback">{review?.overall_feedback || 'No overall feedback.'}</div>
        <CurieReviewList fields={template.fields} feedback={orderedFeedback} />
      </div>
    );
  }

  const editAssignmentButton = (className: string) => (
    <button
      type="button"
      className={className}
      onClick={confirmOpenEdit}
      disabled={isSaving}
    >
      Edit Assignment
    </button>
  );

  let leftActions: React.ReactNode = null;
  if (editing) {
    leftActions = (
      <div className="curie-edit-form-buttons">
        <button
          type="button"
          className="curie-edit-cancel"
          onClick={cancelEdit}
          disabled={isSaving}
        >
          Cancel
        </button>
        <button
          type="button"
          className="curie-edit-submit"
          onClick={() => onRequestSubmit(draft)}
          disabled={isSaving}
        >
          {isSaving ? 'Submitting…' : 'Submit'}
        </button>
      </div>
    );
  } else if (showCap) {
    leftActions = (
      <>
        <button type="button" className="curie-resubmit-btn curie-bottom-btn" disabled>
          Edit Assignment
        </button>
        <p className="curie-capped-message">{CAP_REACHED_MESSAGE}</p>
      </>
    );
  }

  return (
    <div className="curie-review-root">
      <header className="curie-review-header">
        <button type="button" className="curie-mfe-back" onClick={onBack}>
          {historical ? '← Back to history' : '← Back to course'}
        </button>
        <h2>
          {title}
          <small>
            {attemptNumber ? `Attempt ${attemptNumber}` : null}
            {attemptNumber && submittedAt ? ' · ' : null}
            {submittedAt ? `Submitted ${new Date(submittedAt).toLocaleString()}` : 'Submitted'}
          </small>
        </h2>
        <div className="curie-status-row">
          <span className={`curie-verdict-badge ${verdictClass}`}>{verdictLabel}</span>
          {allowReattempt && !editing
            && editAssignmentButton('curie-resubmit-btn curie-header-btn')}
          {editing && (
            <div className="curie-edit-header-actions">
              <button
                type="button"
                className="curie-edit-mode-btn"
                onClick={() => setPreviewingDraft((current) => !current)}
                disabled={isSaving}
              >
                {previewingDraft ? 'Edit' : 'Preview'}
              </button>
              {!previewingDraft && (
                <button
                  type="button"
                  className="curie-edit-mode-btn"
                  onClick={() => setClearConfirmOpen(true)}
                  disabled={isSaving}
                >
                  Clear All
                </button>
              )}
            </div>
          )}
          {!historical && (
            <Link className="curie-history-link" to={historyHref}>View Submission History</Link>
          )}
        </div>
      </header>

      <div className="curie-mobile-tabs" role="tablist" aria-label="Review panels">
        <button
          type="button"
          role="tab"
          aria-selected={mobileTab === 'worksheet'}
          className={mobileTab === 'worksheet' ? 'active' : ''}
          onClick={() => setMobileTab('worksheet')}
        >
          Worksheet
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={mobileTab === 'review'}
          className={mobileTab === 'review' ? 'active' : ''}
          onClick={() => setMobileTab('review')}
        >
          Review
        </button>
      </div>

      <div className="curie-review-body">
        <div className={`curie-half-left ${mobileTab === 'worksheet' ? 'mobile-active' : ''}`}>
          <div className="curie-panel">
            <div className="curie-left-scroll">
              {editing && !previewingDraft ? (
                <form
                  className="curie-edit-form"
                  onSubmit={(event) => {
                    event.preventDefault();
                    onRequestSubmit(draft);
                  }}
                >
                  {activeFields.map((field) => (
                    <div key={field.id} className="curie-edit-form-field">
                      <label htmlFor={`curie-reattempt-${field.id}`}>{field.label}</label>
                      <textarea
                        id={`curie-reattempt-${field.id}`}
                        value={draft[field.id] ?? ''}
                        onChange={(event) => updateDraftField(field.id, event.target.value)}
                      />
                      {capacityFull[field.id] && (
                        <p className="curie-capacity-warning" role="status">
                          This field has reached its maximum capacity.
                        </p>
                      )}
                    </div>
                  ))}
                </form>
              ) : (
                <TemplateCanvas
                  template={template}
                  readOnly
                  fitToPane
                  formDataOverride={editing ? draft : formData}
                  overlay={showPins ? (
                    <CuriePinOverlay
                      fields={template.fields}
                      positions={template.field_positions}
                      feedback={orderedFeedback}
                      isMobile={isMobile}
                      onActivate={(fieldId) => {
                        setPendingPinScroll(fieldId);
                        if (isMobile) { setMobileTab('review'); }
                      }}
                    />
                  ) : null}
                />
              )}
            </div>
            {(allowReattempt || showCap) && (
              <div className="curie-left-actions">
                {leftActions}
              </div>
            )}
            {!historical && submission && <PdfPoller submissionOverride={submission} />}
          </div>
        </div>

        <div className={`curie-half-right ${mobileTab === 'review' ? 'mobile-active' : ''}`}>
          <div className="curie-panel curie-review-card">
            <div className="curie-review-card-content">
              {reviewBody}
            </div>
          </div>
        </div>
      </div>

      {editing && (
        <ModalDialog
          title="Clear Assignment?"
          isOpen={clearConfirmOpen}
          onClose={() => setClearConfirmOpen(false)}
          size="md"
          hasCloseButton
          isOverflowVisible={false}
        >
          <ModalDialog.Header>
            <ModalDialog.Title>Clear Assignment?</ModalDialog.Title>
          </ModalDialog.Header>
          <ModalDialog.Body>
            <p className="mb-0">
              This will remove all responses currently shown in the assignment form.
              The previous submitted attempt will not be changed.
            </p>
          </ModalDialog.Body>
          <ModalDialog.Footer>
            <ActionRow>
              <ModalDialog.CloseButton variant="tertiary">
                Cancel
              </ModalDialog.CloseButton>
              <Button variant="danger" onClick={clearDraft}>
                Clear All
              </Button>
            </ActionRow>
          </ModalDialog.Footer>
        </ModalDialog>
      )}
    </div>
  );
};
