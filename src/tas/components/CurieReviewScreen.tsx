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
import { AssignmentForm } from './AssignmentForm';
import { PdfPoller } from './PdfPoller';
import {
  CAP_REACHED_MESSAGE,
  HISTORICAL_FAILED_COPY,
  learnerVerdictLabel,
  orderFieldFeedback,
} from '../utils/curieReview';
import type { DisplayState } from '../lifecycle/deriveLifecycle';
import type {
  LearnerCurieReview,
  Submission,
  Template,
} from '../types';

interface Props {
  template: Template;
  displayState: Extract<
  DisplayState,
  'pending' | 'live_failed' | 'curie_accepted' | 'curie_rejected'
  >;
  review: LearnerCurieReview | null;
  title: string;
  submittedAt?: string | null;
  usageKey: string;
  formData: Record<string, string>;
  atMaxAttempts: boolean;
  canReattempt: boolean;
  isSlowPending: boolean;
  awaitingInstructorApproval?: boolean;
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
  awaitingInstructorApproval = false,
  isSaving,
  isMobile,
  historical = false,
  attemptNumber,
  submission,
  onBack,
  onRequestSubmit,
}) => {
  const [mobileTab, setMobileTab] = useState<'worksheet' | 'review'>(
    'worksheet',
  );
  const [editing, setEditing] = useState(false);
  const [previewingDraft, setPreviewingDraft] = useState(false);
  const [clearConfirmOpen, setClearConfirmOpen] = useState(false);
  const [draft, setDraft] = useState<Record<string, string>>(formData);
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
  }, [
    pending,
    canReattempt,
    atMaxAttempts,
    historical,
    displayState,
    review?.submission_version_number,
  ]);

  useLayoutEffect(() => {
    if (!pendingPinScroll) {
      return;
    }
    if (isMobile && mobileTab !== 'review') {
      return;
    }
    document
      .getElementById(`curie-field-review-${pendingPinScroll}`)
      ?.scrollIntoView({
        block: 'nearest',
      });
    setPendingPinScroll(null);
  }, [pendingPinScroll, mobileTab, isMobile]);

  const orderedFeedback = useMemo(
    () => orderFieldFeedback(template.fields, review?.field_feedback),
    [template.fields, review?.field_feedback],
  );
  const showPins = !pending && !liveFailed && !editing && orderedFeedback.length > 0;
  const showStars = Boolean(
    review?.star_rating != null && orderedFeedback.length > 0,
  );
  const allowReattempt = !historical && canReattempt && !atMaxAttempts;
  const showCap = !historical && (rejected || liveFailed) && atMaxAttempts;
  const historyHref = `/submission/${encodeURIComponent(usageKey)}/history`;

  let verdictLabel = learnerVerdictLabel(
    review?.status,
    review?.verdict ?? (accepted ? 'accepted' : 'rejected'),
  );
  if (pending) {
    verdictLabel = awaitingInstructorApproval
      ? 'Awaiting Instructor Review'
      : 'Pending Evaluation';
  } else if (liveFailed) {
    verdictLabel = 'Review Unavailable';
  }
  let verdictClass = '';
  if (!pending && !liveFailed) {
    verdictClass = accepted || review?.verdict === 'accepted' ? 'accepted' : 'rejected';
  }

  const openEdit = () => {
    setDraft({ ...formData });
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
    setClearConfirmOpen(false);
  };

  const confirmOpenEdit = () => {
    if (
      window.confirm(
        'Editing will let you revise your answers and resubmit for a new review. Continue?',
      )
    ) {
      openEdit();
    }
  };

  let reviewBody: React.ReactNode;
  if (pending) {
    let pendingVariant: 'pending' | 'slow' | 'awaiting_approval' = 'pending';
    if (awaitingInstructorApproval) {
      pendingVariant = 'awaiting_approval';
    } else if (isSlowPending) {
      pendingVariant = 'slow';
    }
    reviewBody = (
      <CurieReviewPending variant={pendingVariant} />
    );
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
        <div className="curie-overall-feedback">
          {review?.overall_feedback || 'No overall feedback.'}
        </div>
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
        <button
          type="button"
          className="curie-resubmit-btn curie-bottom-btn"
          disabled
        >
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
            {submittedAt
              ? `Submitted ${new Date(submittedAt).toLocaleString()}`
              : 'Submitted'}
          </small>
        </h2>
        <div className="curie-status-row">
          <span className={`curie-verdict-badge ${verdictClass}`}>
            {verdictLabel}
          </span>
          {allowReattempt
            && !editing
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
            <Link className="curie-history-link" to={historyHref}>
              View Submission History
            </Link>
          )}
        </div>
      </header>

      <div
        className="curie-mobile-tabs"
        role="tablist"
        aria-label="Review panels"
      >
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
        <div
          className={`curie-half-left ${mobileTab === 'worksheet' ? 'mobile-active' : ''}`}
        >
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
                  <AssignmentForm
                    template={template}
                    values={draft}
                    onChange={(fieldId, value) => setDraft((current) => ({ ...current, [fieldId]: value }))}
                    isMobile={isMobile}
                  />
                </form>
              ) : (
                <TemplateCanvas
                  template={template}
                  readOnly
                  fitToPane
                  formDataOverride={editing ? draft : formData}
                  overlay={
                    showPins ? (
                      <CuriePinOverlay
                        fields={template.fields}
                        positions={template.field_positions}
                        feedback={orderedFeedback}
                        isMobile={isMobile}
                        onActivate={(fieldId) => {
                          setPendingPinScroll(fieldId);
                          if (isMobile) {
                            setMobileTab('review');
                          }
                        }}
                      />
                    ) : null
                  }
                />
              )}
            </div>
            {(allowReattempt || showCap) && (
              <div className="curie-left-actions">{leftActions}</div>
            )}
            {!historical && submission && (
              <PdfPoller submissionOverride={submission} />
            )}
          </div>
        </div>

        <div
          className={`curie-half-right ${mobileTab === 'review' ? 'mobile-active' : ''}`}
        >
          <div className="curie-panel curie-review-card">
            <div className="curie-review-card-content">{reviewBody}</div>
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
              This will remove all responses currently shown in the assignment
              form. The previous submitted attempt will not be changed.
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
