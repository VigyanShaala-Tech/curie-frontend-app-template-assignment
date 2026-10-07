/**
 * TasApp — top-level view for the TAS MFE
 *
 * Flow:
 *   1. MFE loads → reads context (usageKey, courseId, studentId) from OpenEdX JWT
 *   2. Student sees TemplateSelector (templates assigned to this block)
 *   3. Student picks a template → createOrGetDraft is called
 *   4. TemplateCanvas renders with field overlays; FieldEditorPopup opens on tap
 *   5. Student hits "Submit" to finalise (draft also persists via Save & Go Back)
 */

import React, {
  useEffect, useCallback, useRef, useState,
} from 'react';
import { Button, ModalDialog, ActionRow } from '@openedx/paragon';

import { TemplateSelector } from './TemplateSelector';
import { TemplateCanvas } from './TemplateCanvas';
import { FieldEditorPopup } from './FieldEditorPopup';
import { PdfPoller } from './PdfPoller';
import { StudentFeedbackPanel } from './StudentFeedbackPanel';
import { StudentSubmissionDetail } from './StudentSubmissionDetail';
import { SubmissionHistory } from './SubmissionHistory';
import { CurieReviewScreen } from './CurieReviewScreen';
import { RequiredFieldsModal } from './RequiredFieldsModal';
import { BackNavigationModal } from './BackNavigationModal';
import { OptionalFieldsSubmitModal } from './OptionalFieldsSubmitModal';
import { ConfirmSubmitModal } from './ConfirmSubmitModal';
import { useTasStore } from '../store/tasStore';
import { useBackNavigationGuard } from '../hooks/useBackNavigationGuard';
import { usePendingReviewPolling } from '../hooks/usePendingReviewPolling';
import { submissionsApi, formatApiError } from '../services/api';
import { deriveLifecycle } from '../lifecycle/deriveLifecycle';
import { navigateBackToAssignment } from '../utils/navigateBackToAssignment';
import { getActiveFields, isFieldEmpty } from '../utils/activeFields';
import { resolveFieldLayout, FIELD_TEXT_FONT_FAMILY } from '../utils/fieldLayout';
import { clampFormDataToFields } from '../utils/clampTextToField';
import { capacitySubmitPlan } from '../utils/capacitySubmit';
import type { FormField, LearnerCurieReview, SubmissionVersion } from '../types';

const SUBMIT_GREEN = '#69AB4A';

export const TasApp: React.FC = () => {
  const {
    mfeContext,
    selectedTemplate,
    selectedTemplateBlockId,
    submission,
    setSubmission,
    formData,
    setFormData,
    clearFormData,
    clearSelection,
    isPreviewMode,
    setPreviewMode,
    setIsMobile,
    isMobile,
    getSelectedField,
    isSaving,
    setIsSaving,
  } = useTasStore();

  // Track whether createOrGetDraft has already been called for this selection
  const draftCreating = useRef(false);
  const [versionHistory, setVersionHistory] = useState<SubmissionVersion[]>([]);
  const [versionsLoading, setVersionsLoading] = useState(false);
  const [selectedHistoryVersion, setSelectedHistoryVersion] = useState<SubmissionVersion | null>(null);
  const [clearConfirmOpen, setClearConfirmOpen] = useState(false);
  const [requiredFieldsModalOpen, setRequiredFieldsModalOpen] = useState(false);
  const [missingRequiredFields, setMissingRequiredFields] = useState<string[]>([]);
  const [backConfirmOpen, setBackConfirmOpen] = useState(false);
  const [optionalFieldsModalOpen, setOptionalFieldsModalOpen] = useState(false);
  const [confirmSubmitModalOpen, setConfirmSubmitModalOpen] = useState(false);
  const [learnerReview, setLearnerReview] = useState<LearnerCurieReview | null>(null);
  const pendingSubmitAnswers = useRef<Record<string, string> | null>(null);

  // ── Responsive detection ───────────────────────────────────────────────────
  useEffect(() => {
    const handle = () => setIsMobile(window.innerWidth < 768);
    handle();
    window.addEventListener('resize', handle);
    return () => window.removeEventListener('resize', handle);
  }, [setIsMobile]);

  // ── Create or retrieve draft when template is selected ────────────────────
  useEffect(() => {
    if (!selectedTemplate || !selectedTemplateBlockId || !mfeContext) { return; }
    if (submission) { return; }
    if (draftCreating.current) { return; }

    draftCreating.current = true;

    submissionsApi
      .createOrGetDraft({
        template_block_id: selectedTemplateBlockId,
        usage_key: mfeContext.usageKey,
        course_id: mfeContext.courseId,
        student_id: mfeContext.studentId,
      })
      .then((sub) => {
        setSubmission(sub);
        if (Object.keys(sub.form_data).length > 0) {
          useTasStore.getState().setFormData(sub.form_data);
        }
      })
      .catch((err: any) => {
        draftCreating.current = false;
        const responseData = err?.response?.data;
        let msg = 'Failed to start assignment. Please reload and try again.';
        if (responseData?.detail) { msg = responseData.detail; } else if (responseData?.non_field_errors) {
          msg = Array.isArray(responseData.non_field_errors)
            ? responseData.non_field_errors.join('\n')
            : responseData.non_field_errors;
        } else if (typeof responseData === 'string') {
          msg = responseData;
        } else if (responseData) {
          const fieldErrors = Object.entries(responseData)
            .map(([k, v]) => `${k}: ${Array.isArray(v) ? v.join(', ') : v}`)
            .join('\n');
          if (fieldErrors) { msg = fieldErrors; }
        }
        alert(msg);
        clearSelection();
      });
  }, [selectedTemplate, selectedTemplateBlockId, mfeContext, submission, setSubmission, clearSelection]);

  // Reset draft-creating guard when selection is cleared
  useEffect(() => {
    if (!selectedTemplate) {
      draftCreating.current = false;
    }
  }, [selectedTemplate]);

  // Pending-only refresh. Stops on ready/failed or unmount; refetches on focus.
  const shouldPoll = Boolean(
    submission?.id
    && submission.status !== 'draft'
    && (
      submission.curie_review_status === 'pending_evaluation'
      || (submission.curie_review_status == null && !submission.feedback)
    ),
  );
  const { observedPending } = usePendingReviewPolling({
    enabled: Boolean(submission?.id && submission.status !== 'draft'),
    isPending: shouldPoll,
    identity: submission ? `${submission.id}:${submission.version_number}` : null,
    fetcher: () => submissionsApi.get(submission!.id),
    onResult: setSubmission,
  });

  const lifecycle = deriveLifecycle({
    submissionStatus: submission?.status,
    curieReviewStatus: submission?.curie_review_status ?? null,
    feedbackSource: submission?.feedback?.source,
    atMaxAttempts: submission?.at_max_attempts,
    isSlowPending: submission?.is_slow_pending,
    hasFeedback: Boolean(submission?.feedback),
    observedPendingInSession: observedPending,
  });

  const showCurieReviewScreen = Boolean(
    selectedTemplate
    && (
      lifecycle.displayState === 'pending'
      || lifecycle.displayState === 'live_failed'
      || lifecycle.displayState === 'curie_accepted'
      || lifecycle.displayState === 'curie_rejected'
    ),
  );

  useEffect(() => {
    if (!submission?.id) {
      setLearnerReview(null);
      return undefined;
    }
    if (lifecycle.displayState !== 'curie_accepted' && lifecycle.displayState !== 'curie_rejected') {
      setLearnerReview(null);
      return undefined;
    }

    let cancelled = false;
    submissionsApi.getCurieReview(submission.id)
      .then((payload) => {
        if (!cancelled) { setLearnerReview(payload); }
      })
      .catch(() => {
        if (!cancelled) { setLearnerReview(null); }
      });
    return () => {
      cancelled = true;
    };
  }, [submission?.id, submission?.version_number, lifecycle.displayState]);

  // Load submitted version history for the student Submission History panel
  useEffect(() => {
    if (!submission?.id || submission.status === 'draft') {
      setVersionHistory([]);
      setSelectedHistoryVersion(null);
      return undefined;
    }

    let cancelled = false;
    setVersionsLoading(true);

    const loadVersions = () => {
      submissionsApi.getVersions(submission.id)
        .then((res) => {
          if (!cancelled) { setVersionHistory(res.versions); }
        })
        .catch(() => {
          if (!cancelled) { setVersionHistory([]); }
        })
        .finally(() => {
          if (!cancelled) { setVersionsLoading(false); }
        });
    };

    loadVersions();
    window.addEventListener('focus', loadVersions);
    return () => {
      cancelled = true;
      window.removeEventListener('focus', loadVersions);
    };
  }, [submission?.id, submission?.status, submission?.feedback?.status, submission?.version_number]);

  // ── Print / Save as PDF ───────────────────────────────────────────────────
  const handlePrint = useCallback(() => {
    // Close editor first so toolbar actions work over the popup backdrop.
    // formData (committed values) is unchanged; only dismisses the popup UI.
    useTasStore.getState().closeFieldEditor();

    if (!selectedTemplate) { return; }
    const imageW = selectedTemplate.image_width || 794;
    const imageH = selectedTemplate.image_height || 1123;

    const fieldsHtml = selectedTemplate.fields.map((field) => {
      const pos = selectedTemplate.field_positions[field.id];
      const value = formData[field.id] ?? '';
      if (!pos || !value) { return ''; }
      const layout = resolveFieldLayout(field, pos, imageW, imageH);
      return `
        <div style="
          position:absolute;
          left:${pos.x}%;top:${pos.y}%;
          width:${pos.width}%;height:${pos.height}%;
          font-family:${FIELD_TEXT_FONT_FAMILY};
          font-size:${layout.fontSize}px;
          font-weight:400;color:#111827;
          overflow:hidden;padding:2px;box-sizing:border-box;
          line-height:1.3;white-space:pre-wrap;
          overflow-wrap:anywhere;word-break:break-word;
        ">${value.replace(/</g, '&lt;')}</div>`;
    }).join('');

    const html = `<!DOCTYPE html><html><head>
      <title>${selectedTemplate.name}</title>
      <style>
        * { margin:0; padding:0; box-sizing:border-box; }
        body { width:${imageW}px; }
        @page { size:${imageW}px ${imageH}px; margin:0; }
        @media print { body { width:${imageW}px; } }
      </style>
    </head><body>
      <div style="position:relative;width:${imageW}px;height:${imageH}px;">
        <img src="${selectedTemplate.image_url}" style="position:absolute;inset:0;width:100%;height:100%;object-fit:contain;" />
        ${fieldsHtml}
      </div>
    </body></html>`;

    const triggerPrint = (doc: Document, win: Window) => {
      let printed = false;
      const runPrint = () => {
        if (printed) { return; }
        printed = true;
        try {
          win.focus();
          win.print();
        } catch {
          // Ignore print errors (some mobile browsers block print silently).
        }
      };

      const img = doc.querySelector('img');
      if (img && !img.complete) {
        const onReady = () => {
          img.removeEventListener('load', onReady);
          img.removeEventListener('error', onReady);
          // Allow layout to settle before opening the print sheet.
          window.setTimeout(runPrint, 50);
        };
        img.addEventListener('load', onReady);
        img.addEventListener('error', onReady);
        // Fallback if load events never fire.
        window.setTimeout(onReady, 1500);
      } else {
        window.setTimeout(runPrint, 50);
      }
    };

    const useIframeFallback = isMobile;
    let win: Window | null = null;
    if (!useIframeFallback) {
      win = window.open('', '_blank');
    }

    if (win) {
      win.document.write(html);
      win.document.close();
      triggerPrint(win.document, win);
      return;
    }

    // Mobile / popup-blocked: same-tab hidden iframe (reuse same HTML generation).
    const existing = document.getElementById('tas-print-iframe');
    if (existing) { existing.remove(); }

    const iframe = document.createElement('iframe');
    iframe.id = 'tas-print-iframe';
    iframe.setAttribute('aria-hidden', 'true');
    iframe.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;border:0;visibility:hidden;';
    document.body.appendChild(iframe);

    const iframeWin = iframe.contentWindow;
    const iframeDoc = iframe.contentDocument || iframeWin?.document;
    if (!iframeWin || !iframeDoc) {
      iframe.remove();
      return;
    }

    iframeDoc.open();
    iframeDoc.write(html);
    iframeDoc.close();
    triggerPrint(iframeDoc, iframeWin);

    // Clean up after print dialog interaction window.
    window.setTimeout(() => {
      iframe.remove();
    }, 60_000);
  }, [selectedTemplate, formData, isMobile]);

  // ── Submit handler ─────────────────────────────────────────────────────────
  const clampFormDataForSubmit = useCallback((data: Record<string, string>) => {
    if (!selectedTemplate) {
      return { formData: data, capacityFull: {} as Record<string, boolean> };
    }
    const imageW = selectedTemplate.image_width || 794;
    const imageH = selectedTemplate.image_height || 1123;
    const layoutsByFieldId: Record<string, ReturnType<typeof resolveFieldLayout>> = {};

    getActiveFields(selectedTemplate).forEach((field: FormField) => {
      if (field.type === 'select' || field.type === 'date' || field.type === 'number'
        || field.type === 'checkbox' || field.type === 'radio') {
        return;
      }
      const pos = selectedTemplate.field_positions[field.id];
      if (!pos) { return; }
      layoutsByFieldId[field.id] = resolveFieldLayout(field, pos, imageW, imageH);
    });

    return clampFormDataToFields(data, layoutsByFieldId);
  }, [selectedTemplate]);

  const submitAssignment = useCallback(async (answers?: Record<string, string>) => {
    if (!submission || !(lifecycle.canSubmit || lifecycle.canReattempt)) { return; }
    const sourceData = answers ?? formData;

    try {
      setIsSaving(true);
      // Defensive clamp so stale/legacy values cannot overflow the PDF boxes.
      const { formData: clampedData, capacityFull } = clampFormDataForSubmit(sourceData);
      const capacityPlan = capacitySubmitPlan(answers, clampedData, capacityFull);
      if (capacityPlan.abort) {
        alert('Some answers exceed the field capacity. Shorten them before submitting.');
        return;
      }
      if (capacityPlan.nextFormData) {
        setFormData(capacityPlan.nextFormData);
      }
      if (capacityPlan.nextCapacityFull) {
        useTasStore.getState().setFieldCapacityFullMap({
          ...useTasStore.getState().fieldCapacityFull,
          ...capacityPlan.nextCapacityFull,
        });
      }
      if (submission.status === 'draft') {
        await submissionsApi.patch(submission.id, clampedData);
      }
      const submitted = await submissionsApi.submit(submission.id, clampedData);
      setSubmission(submitted);
    } catch (err: any) {
      const responseData = err?.response?.data;
      let errorMsg = 'Submission failed. Please try again.';
      if (responseData) {
        if (typeof responseData === 'string') {
          errorMsg = responseData;
        } else if (responseData.detail) {
          errorMsg = responseData.detail;
        } else if (responseData.non_field_errors) {
          errorMsg = Array.isArray(responseData.non_field_errors)
            ? responseData.non_field_errors.join('\n')
            : responseData.non_field_errors;
        } else {
          const fieldErrors = Object.entries(responseData)
            .map(([k, v]) => `${k}: ${Array.isArray(v) ? v.join(', ') : v}`)
            .join('\n');
          if (fieldErrors) { errorMsg = fieldErrors; }
        }
      }
      alert(errorMsg);
    } finally {
      setIsSaving(false);
    }
  }, [
    submission,
    formData,
    setIsSaving,
    setSubmission,
    setFormData,
    clampFormDataForSubmit,
    lifecycle.canSubmit,
    lifecycle.canReattempt,
  ]);

  const handleSubmit = useCallback((answers?: Record<string, string>) => {
    // Close editor first so Submit is reachable while the popup is open.
    // formData (committed values) is unchanged; only dismisses the popup UI.
    useTasStore.getState().closeFieldEditor();

    const sourceData = answers ?? formData;
    const canGo = lifecycle.canSubmit || lifecycle.canReattempt;
    if (!submission || !canGo) { return; }

    const activeFields = getActiveFields(selectedTemplate);

    const missing = activeFields
      .filter((f) => f.required && isFieldEmpty(sourceData, f.id))
      .map((f) => f.label);

    if (missing.length > 0) {
      setMissingRequiredFields(missing);
      setRequiredFieldsModalOpen(true);
      return;
    }

    const hasEmptyOptional = activeFields.some(
      (f) => !f.required && isFieldEmpty(sourceData, f.id),
    );
    if (hasEmptyOptional) {
      pendingSubmitAnswers.current = sourceData;
      setOptionalFieldsModalOpen(true);
      return;
    }

    pendingSubmitAnswers.current = sourceData;
    setConfirmSubmitModalOpen(true);
  }, [submission, selectedTemplate, formData, lifecycle.canSubmit, lifecycle.canReattempt]);

  const handleOptionalContinueHere = useCallback(() => {
    setOptionalFieldsModalOpen(false);
  }, []);

  const handleOptionalConfirmSubmit = useCallback(() => {
    setOptionalFieldsModalOpen(false);
    submitAssignment(pendingSubmitAnswers.current ?? undefined);
  }, [submitAssignment]);

  const handleConfirmSubmitCancel = useCallback(() => {
    setConfirmSubmitModalOpen(false);
  }, []);

  const handleConfirmSubmitConfirm = useCallback(() => {
    setConfirmSubmitModalOpen(false);
    submitAssignment(pendingSubmitAnswers.current ?? undefined);
  }, [submitAssignment]);

  // ── Edit Assignment (rejected → draft reopen) ──────────────────────────────
  const handleEditAssignment = useCallback(async () => {
    if (!submission || submission.status !== 'rejected') { return; }
    try {
      setIsSaving(true);
      // Preserve intentional Clear All: if local form is empty, do not reload server answers
      const keepCleared = Object.keys(formData).length === 0;
      const updated = await submissionsApi.reopen(submission.id);
      setSubmission(updated);
      setFormData(keepCleared ? {} : (updated.form_data ?? {}));
    } catch (err: any) {
      alert(formatApiError(err, 'Failed to reopen assignment for editing.'));
    } finally {
      setIsSaving(false);
    }
  }, [submission, formData, setIsSaving, setSubmission, setFormData]);

  const handleConfirmClearAll = useCallback(() => {
    clearFormData();
    setClearConfirmOpen(false);
  }, [clearFormData]);

  const handleRequiredFieldsComplete = useCallback(() => {
    setRequiredFieldsModalOpen(false);
  }, []);

  const handleBackContinueHere = useCallback(() => {
    setBackConfirmOpen(false);
  }, []);

  const openBackConfirm = useCallback(() => {
    // Close editor first; formData (committed values) is preserved.
    useTasStore.getState().closeFieldEditor();
    setBackConfirmOpen(true);
  }, []);

  const isLocked = lifecycle.isCanvasReadOnly;
  const isRejected = lifecycle.useLegacyReopen;
  const backGuardEnabled = Boolean(
    selectedTemplate && submission && submission.status === 'draft',
  );

  const { allowLeave, extraHistoryEntries } = useBackNavigationGuard({
    enabled: backGuardEnabled,
    onBack: openBackConfirm,
  });

  const handleSaveDraftAndGoBack = useCallback(async () => {
    if (!submission || submission.status !== 'draft') { return; }
    try {
      setIsSaving(true);
      const updated = await submissionsApi.patch(submission.id, formData);
      setSubmission(updated);
      setRequiredFieldsModalOpen(false);
      setBackConfirmOpen(false);
      setOptionalFieldsModalOpen(false);
      setConfirmSubmitModalOpen(false);
      allowLeave();
      navigateBackToAssignment(mfeContext, { extraHistoryEntries });
    } catch (err: any) {
      const msg = err?.response?.data?.detail || 'Failed to save draft.';
      alert(msg);
    } finally {
      setIsSaving(false);
    }
  }, [
    submission,
    formData,
    setIsSaving,
    setSubmission,
    mfeContext,
    allowLeave,
    extraHistoryEntries,
  ]);

  // ─── Render: no template selected → selector ──────────────────────────────
  if (!selectedTemplate) {
    return (
      <div className="h-100 overflow-auto">
        <TemplateSelector />
      </div>
    );
  }

  const readyReview = learnerReview ?? (
    submission?.feedback
    && (lifecycle.displayState === 'curie_accepted' || lifecycle.displayState === 'curie_rejected')
      ? {
        status: 'ready' as const,
        verdict: submission.feedback.verdict
          ?? (lifecycle.displayState === 'curie_accepted' ? 'accepted' as const : 'rejected' as const),
        overall_feedback: submission.feedback.comment,
        field_feedback: submission.feedback.field_feedback ?? [],
        star_rating: null,
        is_slow_pending: Boolean(submission.is_slow_pending),
        submission_version_number: submission.version_number,
        error_detail: '',
        requested_at: null,
        completed_at: null,
      }
      : null
  );

  if (showCurieReviewScreen && submission && (
    lifecycle.displayState === 'pending'
    || lifecycle.displayState === 'live_failed'
    || lifecycle.displayState === 'curie_accepted'
    || lifecycle.displayState === 'curie_rejected'
  )) {
    return (
      <>
        <CurieReviewScreen
          template={selectedTemplate}
          displayState={lifecycle.displayState}
          review={readyReview}
          title={selectedTemplate.name}
          submittedAt={submission.submitted_at}
          usageKey={mfeContext?.usageKey ?? submission.usage_key}
          formData={formData}
          atMaxAttempts={lifecycle.atMaxAttempts}
          canReattempt={lifecycle.canReattempt}
          isSlowPending={lifecycle.isSlowPending}
          isSaving={isSaving}
          isMobile={isMobile}
          submission={submission}
          onBack={() => navigateBackToAssignment(mfeContext)}
          onRequestSubmit={handleSubmit}
        />
        <RequiredFieldsModal
          isOpen={requiredFieldsModalOpen}
          missingFields={missingRequiredFields}
          isSaving={isSaving}
          allowSaveDraft={false}
          onClose={handleRequiredFieldsComplete}
          onComplete={handleRequiredFieldsComplete}
          onSaveDraftAndGoBack={handleSaveDraftAndGoBack}
        />
        <OptionalFieldsSubmitModal
          isOpen={optionalFieldsModalOpen}
          isSaving={isSaving}
          onClose={handleOptionalContinueHere}
          onContinueHere={handleOptionalContinueHere}
          onConfirmSubmit={handleOptionalConfirmSubmit}
        />
        <ConfirmSubmitModal
          isOpen={confirmSubmitModalOpen}
          isSaving={isSaving}
          onClose={handleConfirmSubmitCancel}
          onCancel={handleConfirmSubmitCancel}
          onConfirmSubmit={handleConfirmSubmitConfirm}
        />
      </>
    );
  }

  // ─── Render: historical submission detail (PDF + feedback) ────────────────
  if (isLocked && selectedHistoryVersion) {
    return (
      <StudentSubmissionDetail
        version={selectedHistoryVersion}
        onBack={() => setSelectedHistoryVersion(null)}
      />
    );
  }

  // ─── Render: template selected → canvas ───────────────────────────────────
  const selectedField = getSelectedField();

  const btnBase: React.CSSProperties = {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    padding: '6px 14px',
    borderRadius: 8,
    fontSize: 13,
    fontWeight: 600,
    cursor: 'pointer',
    border: 'none',
    transition: 'opacity 0.15s',
    whiteSpace: 'nowrap',
  };

  return (
    <div className="d-flex flex-column h-100 tas-submission-root">
      {/* Toolbar */}
      <div
        className="tas-toolbar"
        style={{
          display: 'flex',
          alignItems: 'center',
          padding: '8px 16px',
          background: '#fff',
          borderBottom: '1px solid #e5e7eb',
          boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
          flexShrink: 0,
          gap: 8,
          minHeight: 52,
          // Above FieldEditorPopup backdrop (40) / sheet (50) so toolbar taps register.
          position: 'relative',
          zIndex: 60,
        }}
      >
        <div
          className="tas-toolbar__primary"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            flex: 1,
            minWidth: 0,
          }}
        >
          {/* Back */}
          {!isLocked && (
            <button
              type="button"
              onClick={() => {
                if (submission?.status === 'draft') {
                  openBackConfirm();
                  return;
                }
                navigateBackToAssignment(mfeContext);
              }}
              style={{ ...btnBase, background: '#f3f4f6', color: '#374151' }}
            >
              ← Back
            </button>
          )}

          {/* Template name */}
          <span
            className="tas-toolbar__title"
            style={{
              flex: 1,
              fontWeight: 700,
              fontSize: 14,
              color: '#111827',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
              margin: '0 4px',
            }}
          >
            {selectedTemplate.name}
          </span>
        </div>

        <div
          className="tas-toolbar__actions"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
          }}
        >
          {/* Preview toggle */}
          {!isLocked && (
            <button
              type="button"
              onClick={() => setPreviewMode(!isPreviewMode)}
              style={{ ...btnBase, background: '#f3f4f6', color: '#374151' }}
            >
              {isPreviewMode ? 'Edit' : 'Preview'}
            </button>
          )}

          {/* Rejected-only: reopen / clear before Save as PDF */}
          {isRejected && (
            <>
              <button
                type="button"
                onClick={handleEditAssignment}
                disabled={isSaving}
                style={{
                  ...btnBase,
                  background: '#f3f4f6',
                  color: '#374151',
                  opacity: isSaving ? 0.5 : 1,
                }}
              >
                Edit Assignment
              </button>
              <button
                type="button"
                onClick={() => setClearConfirmOpen(true)}
                disabled={isSaving}
                style={{
                  ...btnBase,
                  background: '#f3f4f6',
                  color: '#374151',
                  opacity: isSaving ? 0.5 : 1,
                }}
              >
                Clear All
              </button>
            </>
          )}

          {/* Save as PDF */}
          <button
            type="button"
            onClick={handlePrint}
            style={{ ...btnBase, background: '#f3f4f6', color: '#374151' }}
          >
            ↓ Save as PDF
          </button>

          {/* Submit */}
          {!isLocked && (
            <button
              type="button"
              onClick={() => handleSubmit()}
              disabled={isSaving || !submission}
              style={{
                ...btnBase,
                background: SUBMIT_GREEN,
                color: '#fff',
                opacity: (isSaving || !submission) ? 0.5 : 1,
              }}
            >
              Submit
            </button>
          )}

          {isLocked && (
            <span style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              background: '#dcfce7',
              color: '#15803d',
              borderRadius: 8,
              padding: '6px 14px',
              fontWeight: 600,
              fontSize: 13,
            }}
            >
              ✓ Submitted
            </span>
          )}
        </div>
      </div>

      {/* Outer page — scrollable grey background */}
      <div
        className="tas-submission-page"
        style={{
          flex: 1,
          overflow: 'auto',
          background: '#e5e7eb',
          padding: '24px',
        }}
      >
        {/* Inner container — white card that holds the canvas */}
        <div
          className="tas-submission-card"
          style={{
            background: '#fff',
            borderRadius: 12,
            boxShadow: '0 2px 12px rgba(0,0,0,0.1)',
            padding: 16,
            maxWidth: 900,
            margin: '0 auto',
          }}
        >
          <TemplateCanvas template={selectedTemplate} readOnly={isLocked || isPreviewMode} />
        </div>

        {isLocked && submission?.feedback
          && (submission.feedback.status === 'approved' || submission.feedback.status === 'rejected') && (
          <div style={{ maxWidth: 900, margin: '16px auto 0' }}>
            <StudentFeedbackPanel feedback={submission.feedback} />
          </div>
        )}

        {isLocked && (
          <div style={{ maxWidth: 900, margin: '16px auto 0' }}>
            {versionsLoading ? (
              <div
                style={{
                  background: '#fff',
                  borderRadius: 12,
                  boxShadow: '0 2px 12px rgba(0,0,0,0.1)',
                  padding: 16,
                  color: '#6b7280',
                  fontSize: 14,
                }}
              >
                Loading submission history…
              </div>
            ) : (
              <SubmissionHistory
                versions={versionHistory}
                showFeedbackStatus
                showPdfColumn={false}
                showViewFeedback
                onViewFeedback={(v) => setSelectedHistoryVersion(v as SubmissionVersion)}
              />
            )}
          </div>
        )}
      </div>

      {/* Field editor popup */}
      {!isLocked && <FieldEditorPopup field={selectedField} fields={selectedTemplate.fields} />}

      {/* PDF / submission status banner */}
      {isLocked && (
        <div style={{
          flexShrink: 0, padding: '0 16px 16px', background: '#fff', borderTop: '1px solid #e5e7eb',
        }}
        >
          <PdfPoller />
        </div>
      )}

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
            The changes won&apos;t be saved until you save the draft or submit the assignment again.
          </p>
        </ModalDialog.Body>
        <ModalDialog.Footer>
          <ActionRow>
            <ModalDialog.CloseButton variant="tertiary">
              Cancel
            </ModalDialog.CloseButton>
            <Button variant="danger" onClick={handleConfirmClearAll}>
              Clear All
            </Button>
          </ActionRow>
        </ModalDialog.Footer>
      </ModalDialog>

      <RequiredFieldsModal
        isOpen={requiredFieldsModalOpen}
        missingFields={missingRequiredFields}
        isSaving={isSaving}
        onClose={handleRequiredFieldsComplete}
        onComplete={handleRequiredFieldsComplete}
        onSaveDraftAndGoBack={handleSaveDraftAndGoBack}
        allowSaveDraft={submission?.status === 'draft'}
      />

      <BackNavigationModal
        isOpen={backConfirmOpen}
        isSaving={isSaving}
        onClose={handleBackContinueHere}
        onContinueHere={handleBackContinueHere}
        onSaveAndGoBack={handleSaveDraftAndGoBack}
      />

      <OptionalFieldsSubmitModal
        isOpen={optionalFieldsModalOpen}
        isSaving={isSaving}
        onClose={handleOptionalContinueHere}
        onContinueHere={handleOptionalContinueHere}
        onConfirmSubmit={handleOptionalConfirmSubmit}
      />

      <ConfirmSubmitModal
        isOpen={confirmSubmitModalOpen}
        isSaving={isSaving}
        onClose={handleConfirmSubmitCancel}
        onCancel={handleConfirmSubmitCancel}
        onConfirmSubmit={handleConfirmSubmitConfirm}
      />
    </div>
  );
};
