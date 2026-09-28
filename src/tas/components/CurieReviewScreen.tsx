/**
 * Learner CURIE review (screens 4/5/6): worksheet + pins, review panel,
 * inline reattempt, pending/live-fail, cap, and two-tab mobile layout.
 * Chat is out of scope.
 */

import React, { useEffect, useLayoutEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { TemplateCanvas } from './TemplateCanvas';
import { CuriePinOverlay } from './CuriePinOverlay';
import { CurieReviewList } from './CurieReviewList';
import { CurieReviewPending } from './CurieReviewPending';
import { CurieStarRating } from './CurieStarRating';
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
import type { FormField, LearnerCurieReview, Template } from '../types';

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
  onBack,
  onRequestSubmit,
}) => {
  const [mobileTab, setMobileTab] = useState<'worksheet' | 'review'>('worksheet');
  const [editing, setEditing] = useState(false);
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
    }
  }, [pending, canReattempt, atMaxAttempts, historical, displayState, review?.submission_version_number]);

  useLayoutEffect(() => {
    if (!pendingPinScroll) return;
    if (isMobile && mobileTab !== 'review') return;
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

  const verdictLabel = pending
    ? 'Pending Evaluation'
    : liveFailed
      ? 'Review Unavailable'
      : learnerVerdictLabel(review?.status, review?.verdict ?? (accepted ? 'accepted' : 'rejected'));
  const verdictClass = pending || liveFailed ? '' : (accepted || review?.verdict === 'accepted' ? 'accepted' : 'rejected');

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
      if (!pos) return;
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
    setMobileTab('worksheet');
  };

  const confirmOpenEdit = () => {
    if (window.confirm('Editing will let you revise your answers and resubmit for a new review. Continue?')) {
      openEdit();
    }
  };

  const reviewBody = pending ? (
    <CurieReviewPending variant={isSlowPending ? 'slow' : 'pending'} />
  ) : liveFailed ? (
    historical ? (
      <div>
        <h3 className="curie-review-heading">Curie Review</h3>
        <p className="curie-pending-note">{HISTORICAL_FAILED_COPY}</p>
      </div>
    ) : (
      <CurieReviewPending variant="live_failed" />
    )
  ) : (
    <div>
      <h3 className="curie-review-heading">Curie Review</h3>
      {showStars && <CurieStarRating rating={review?.star_rating} />}
      <div className="curie-section-title">Overall Feedback</div>
      <div className="curie-overall-feedback">{review?.overall_feedback || 'No overall feedback.'}</div>
      <CurieReviewList fields={template.fields} feedback={orderedFeedback} />
    </div>
  );

  const reattemptButton = (className: string) => (
    <button
      type="button"
      className={className}
      onClick={confirmOpenEdit}
      disabled={isSaving}
    >
      Reattempt
    </button>
  );

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
          {allowReattempt && !editing && reattemptButton('curie-resubmit-btn curie-header-btn')}
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
              {editing ? (
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
                  formDataOverride={formData}
                  overlay={showPins ? (
                    <CuriePinOverlay
                      fields={template.fields}
                      positions={template.field_positions}
                      feedback={orderedFeedback}
                      isMobile={isMobile}
                      onActivate={(fieldId) => {
                        setPendingPinScroll(fieldId);
                        if (isMobile) setMobileTab('review');
                      }}
                    />
                  ) : null}
                />
              )}
            </div>
            {(allowReattempt || showCap) && (
              <div className="curie-left-actions">
                {editing ? (
                  <div className="curie-edit-form-buttons">
                    <button
                      type="button"
                      className="curie-edit-cancel"
                      onClick={() => setEditing(false)}
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
                ) : allowReattempt ? (
                  reattemptButton('curie-resubmit-btn curie-bottom-btn')
                ) : showCap ? (
                  <>
                    <button type="button" className="curie-resubmit-btn curie-bottom-btn" disabled>
                      Reattempt
                    </button>
                    <p className="curie-capped-message">{CAP_REACHED_MESSAGE}</p>
                  </>
                ) : null}
              </div>
            )}
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
    </div>
  );
};
