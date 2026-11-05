/**
 * AdminSubmissionDetail
 * Shows a single student submission.
 *
 * - If status is "submitted": show form data + rubric scoring form
 * - If status is "rejected": show form data read-only + past feedback
 * - Always shows version history at the bottom
 */

import React, { useState, useEffect, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

import {
  Button, Badge, Spinner, Form, Card, IconButton, OverlayTrigger, Tooltip,
} from '@openedx/paragon';
import { ArrowBack, CheckCircle, InfoOutline } from '@openedx/paragon/icons';
import { adminSubmissionsApi } from '../../services/api';
import { useTasStore } from '../../store/tasStore';
import { usePendingReviewPolling } from '../../hooks/usePendingReviewPolling';
import type {
  BlockRubricsResponse,
  RubricCriterion,
  RubricFeedbackEntry,
  StructuredFeedback,
  WeightedSection,
} from '../../types';
import { htmlToPlainText, plainTextToHtml } from '../../utils/commentHtmlAdapter';
import {
  normalizeFeedbacks,
  parseInstructorCommentSections,
  updateCategorySection,
} from '../../utils/instructorCommentSync';
import { SubmissionHistory } from '../SubmissionHistory';
import { SubmissionPdfViewer } from '../SubmissionPdfViewer';
import {
  formatFeedbackStatusLabel,
  formatSubmissionStatusLabel,
} from '../../utils/statusLabels';
import { InstructorCommentEditor } from './InstructorCommentEditor';
import { InstructorCommentHtml } from './InstructorCommentHtml';
import { InstructorCuriePanel } from './InstructorCuriePanel';
import { StructuredOverrideEditor } from './StructuredOverrideEditor';
import { PredefinedFeedbackMultiSelect } from './PredefinedFeedbackMultiSelect';
import {
  INSTRUCTOR_OVERRIDE_ACTION,
  INSTRUCTOR_OVERRIDE_CONFIRM,
  INSTRUCTOR_PUBLISH_ACTION,
  INSTRUCTOR_PUBLISH_CONFIRM,
  presentInstructorCurie,
} from '../../utils/instructorCurieUi';
import { FieldEvaluationCards } from './FieldEvaluationCards';
import {
  buildFieldRubricPayload,
  draftFromSections,
  fieldRecordsFromRubrics,
  isFieldEvaluationRow,
  orderedTemplateFields,
  resolveFieldEvaluation,
  shouldUseFieldEvaluation,
  validateFieldScoreInputs,
  type EvaluationDimension,
  type FieldFeedbackDraft,
  type FieldScoreDraft,
  type OptionalFieldEvaluation,
} from '../../utils/fieldEvaluation';
import { WeightedRubricGrading } from './WeightedRubricGrading';
import {
  allComponents,
  buildWeightedFeedbackPayload,
  draftFromCurieReview,
  draftFromWeightedFeedback,
  feedbackFromWeightedRows,
  isWeightedFeedbackRow,
  validateWeightedScores,
  type WeightedFeedbackDraft,
  type WeightedScoreDraft,
} from '../../utils/weightedRubric';

interface Props {
  submissionId: string;
  onBack: () => void;
}

const STATUS_BADGE: Record<string, string> = {
  submitted: 'primary',
  approved: 'success',
  rejected: 'danger',
  draft: 'secondary',
};

const FEEDBACK_BADGE: Record<string, string> = {
  pending: 'secondary',
  approved: 'success',
  rejected: 'danger',
};

export const COMMENT_SOFT_WARN_LENGTH = 50_000;

const INSTRUCTOR_COMMENT_FORMATTING_NOTE = (
  'If you modify the predefined feedback selection after applying rich text formatting '
  + '(bold, italics, underline, hyperlinks, alignment, headings, font size, etc.), '
  + 'the Instructor Comment will be regenerated and any manual formatting may be lost. '
  + 'To avoid this, finalize your predefined feedback selections before applying formatting.'
);

const FEEDBACK_BORDER: Record<string, string> = {
  rejected: '#dc3545',
  approved: '#28a745',
  pending: '#6c757d',
};

function curieStatusBadgeVariant(label: string): string {
  if (label === 'Failed') { return 'danger'; }
  if (label === 'Pending') { return 'warning'; }
  return 'info';
}

const criteriaChipStyle: React.CSSProperties = {
  display: 'inline-block',
  padding: '6px 12px',
  fontSize: '0.8125rem',
  fontWeight: 500,
  color: '#374151',
  backgroundColor: '#f8f9fa',
  border: '1px solid #dee2e6',
  borderRadius: '6px',
  lineHeight: 1.4,
};

const categoryDividerStyle: React.CSSProperties = {
  borderTop: '1px solid #e9ecef',
  margin: '1rem 0',
};

const categoryCardStyle: React.CSSProperties = {
  border: '1px solid #ced4da',
  borderRadius: '8px',
  boxShadow: '0 1px 3px rgba(0, 0, 0, 0.06)',
};

const categoryFieldStyle: React.CSSProperties = {
  border: '1px solid #00262b',
  borderRadius: '0.25rem',
  padding: '0 0.5rem',
  boxSizing: 'border-box',
};

const categoryScoreInputWidth = 100;
const categoryControlsGap = 12;

type FeedbackRubricPayload = RubricFeedbackEntry[]
| ReturnType<typeof buildFieldRubricPayload>
| ReturnType<typeof buildWeightedFeedbackPayload>;

function weightedSectionsOf(rubrics: BlockRubricsResponse | undefined): WeightedSection[] {
  return rubrics?.schema_version === 2 ? (rubrics.sections ?? []) : [];
}

/** Categories whose predefined feedback builds the instructor comment (components for weighted rubrics). */
function feedbackCategoriesOf(rubrics: BlockRubricsResponse | undefined): Array<{ name: string; feedbacks: string[] }> {
  const weighted = weightedSectionsOf(rubrics);
  if (weighted.length > 0) {
    return allComponents(weighted).map((c) => ({ name: c.name, feedbacks: normalizeFeedbacks(c.feedbacks) }));
  }
  return (rubrics?.rubrics ?? []).map((r) => ({ name: r.criterion, feedbacks: normalizeFeedbacks(r.feedbacks) }));
}

function isLegacyRubricRow(entry: unknown): boolean {
  return !isFieldEvaluationRow(entry) && !isWeightedFeedbackRow(entry);
}

export const AdminSubmissionDetail: React.FC<Props> = ({ submissionId, onBack }) => {
  const { mfeContext } = useTasStore();
  const usageKey = mfeContext?.usageKey ?? '';
  const queryClient = useQueryClient();

  const [comment, setComment] = useState('');
  // Maps criterion name -> raw input value (empty string means null score)
  const [scoreInputs, setScoreInputs] = useState<Record<string, string>>({});
  const [scoreErrors, setScoreErrors] = useState<Record<string, string>>({});
  const [selectedFeedbacks, setSelectedFeedbacks] = useState<Record<string, string[]>>({});
  const [dimensionScores, setDimensionScores] = useState<FieldScoreDraft>({});
  const [sectionFeedback, setSectionFeedback] = useState<FieldFeedbackDraft>({});
  const [fieldScoreErrors, setFieldScoreErrors] = useState<Record<string, string>>({});
  const [weightedScores, setWeightedScores] = useState<WeightedScoreDraft>({});
  const [weightedFeedback, setWeightedFeedback] = useState<WeightedFeedbackDraft>({});
  const [weightedErrors, setWeightedErrors] = useState<Record<string, string>>({});
  const [feedbackSaved, setFeedbackSaved] = useState(false);
  const [overrideEditing, setOverrideEditing] = useState(false);
  const hydratedSubmissionIdRef = useRef<string | null>(null);

  useEffect(() => {
    setComment('');
    setScoreInputs({});
    setScoreErrors({});
    setSelectedFeedbacks({});
    setDimensionScores({});
    setSectionFeedback({});
    setFieldScoreErrors({});
    setWeightedScores({});
    setWeightedFeedback({});
    setWeightedErrors({});
    setFeedbackSaved(false);
    setOverrideEditing(false);
    hydratedSubmissionIdRef.current = null;
  }, [usageKey, submissionId]);

  const { data: submission, isLoading: loadingSub } = useQuery({
    queryKey: ['admin-submission-detail', submissionId],
    queryFn: () => adminSubmissionsApi.get(submissionId),
  });

  const instructorPending = submission?.curie_review?.status === 'pending_evaluation';
  usePendingReviewPolling({
    enabled: Boolean(submissionId) && instructorPending,
    isPending: Boolean(instructorPending),
    identity: `${submissionId}:${submission?.version_number ?? ''}`,
    fetcher: () => adminSubmissionsApi.get(submissionId),
    onResult: (data) => {
      queryClient.setQueryData(['admin-submission-detail', submissionId], data);
    },
  });

  const { data: rubrics, isLoading: loadingRubrics } = useQuery({
    queryKey: ['block-rubrics', usageKey],
    queryFn: () => adminSubmissionsApi.getRubrics(usageKey),
    enabled: !!usageKey,
    staleTime: 0,
    refetchOnMount: 'always',
    refetchOnWindowFocus: false,
  });

  // Prefill scores/comment/predefined selections when reopening a submitted review
  // (e.g. after withdraw). Runs once per submissionId load; does not wipe in-progress edits.
  useEffect(() => {
    if (!submission) { return; }
    if (submission.status !== 'submitted' && !overrideEditing) { return; }
    if (hydratedSubmissionIdRef.current === submissionId) { return; }

    if (rubrics === undefined) return;

    const feedback = submission.feedback;
    const fieldEvaluation = (submission.field_evaluation ?? null) as OptionalFieldEvaluation | null;
    const ordered = orderedTemplateFields(submission.template_fields);
    const rubricCriteria: RubricCriterion[] = rubrics?.rubrics ?? [];
    const weighted = weightedSectionsOf(rubrics);
    if (
      overrideEditing
      && weighted.length > 0
      && submission.curie_review?.status === 'ready'
    ) {
      const draft = draftFromCurieReview(weighted, submission.curie_review);
      setWeightedScores(draft.scores);
      setWeightedFeedback(draft.feedback);
      setWeightedErrors({});
      hydratedSubmissionIdRef.current = submissionId;
      return;
    }
    if (weighted.length === 0
      && shouldUseFieldEvaluation(rubricCriteria.length, ordered.length, true, submission.template_type_slug)) {
      const resolved = resolveFieldEvaluation({
        templateFields: submission.template_fields,
        feedbackRubrics: feedback?.rubrics,
        feedbackComment: typeof feedback?.comment === 'string' ? feedback.comment : '',
        fieldEvaluation,
      });
      const draft = draftFromSections(resolved.sections);
      setDimensionScores(draft.scores);
      setSectionFeedback(draft.feedback);
      if (resolved.overall) {
        setComment(resolved.overall);
      }
      hydratedSubmissionIdRef.current = submissionId;
      return;
    }

    if (!feedback) return;

    const hasRubrics = Array.isArray(feedback.rubrics) && feedback.rubrics.length > 0;
    const hasComment = typeof feedback.comment === 'string' && feedback.comment.length > 0;
    if (!hasRubrics && !hasComment) { return; }

    if (weighted.length > 0) {
      setWeightedScores(draftFromWeightedFeedback(weighted, feedback.rubrics));
      setWeightedFeedback(feedbackFromWeightedRows(weighted, feedback.rubrics));
    } else {
      const nextScores: Record<string, string> = {};
      (feedback.rubrics ?? []).forEach((entry: RubricFeedbackEntry) => {
        if (!isLegacyRubricRow(entry)) return;
        const value = entry.score ?? entry.marks;
        if (value != null && entry.criterion) {
          nextScores[entry.criterion] = String(value);
        }
      });
      if (Object.keys(nextScores).length > 0) {
        setScoreInputs(nextScores);
      }
    }

    if (hasComment) {
      setComment(feedback.comment);
    }

    const categories = feedbackCategoriesOf(rubrics);
    if (categories.length > 0 && hasComment) {
      const parsed = parseInstructorCommentSections(
        htmlToPlainText(feedback.comment),
        categories.map((c) => c.name),
      );
      const nextSelected: Record<string, string[]> = {};
      categories.forEach((category) => {
        if (category.feedbacks.length === 0) return;
        const body = parsed.sections[category.name] ?? '';
        const lines = body.split('\n').map((line) => line.trim()).filter(Boolean);
        nextSelected[category.name] = category.feedbacks.filter((opt) => lines.includes(opt));
      });
      if (Object.keys(nextSelected).length > 0) {
        setSelectedFeedbacks(nextSelected);
      }
    }

    hydratedSubmissionIdRef.current = submissionId;
  }, [submission, rubrics, submissionId, overrideEditing]);

  const feedbackMut = useMutation({
    mutationFn: (payload: {
      feedbackStatus: 'approved' | 'rejected';
      rubricPayload: FeedbackRubricPayload;
      total: number;
      structuredFeedback?: StructuredFeedback;
    }) => adminSubmissionsApi.submitFeedback(submissionId, {
      comment,
      rubrics: payload.rubricPayload,
      status: payload.feedbackStatus,
      structured_feedback: payload.structuredFeedback,
    }),
    onSuccess: () => {
      setFeedbackSaved(true);
      queryClient.invalidateQueries({ queryKey: ['admin-submission-detail', submissionId] });
      queryClient.invalidateQueries({ queryKey: ['admin-submissions', usageKey] });
    },
  });

  const publishCurieMut = useMutation({
    mutationFn: () => adminSubmissionsApi.publishCurieReview(submissionId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-submission-detail', submissionId] });
      queryClient.invalidateQueries({ queryKey: ['admin-submissions', usageKey] });
    },
  });

  const handlePublishCurie = () => {
    if (window.confirm(INSTRUCTOR_PUBLISH_CONFIRM)) {
      publishCurieMut.mutate();
    }
  };

  const isLoading = loadingSub || loadingRubrics;

  if (isLoading) {
    return (
      <div className="d-flex justify-content-center align-items-center h-100">
        <Spinner animation="border" variant="primary" screenReaderText="Loading" />
      </div>
    );
  }

  if (!submission) {
    return (
      <div className="p-4">
        <Button variant="tertiary" iconBefore={ArrowBack} onClick={onBack}>Back</Button>
        <div className="alert alert-danger mt-3">Submission not found.</div>
      </div>
    );
  }

  const rubricList: RubricCriterion[] = rubrics?.rubrics ?? [];
  const weightedSections = weightedSectionsOf(rubrics);
  const weightedMode = weightedSections.length > 0;
  const orderedFields = orderedTemplateFields(submission.template_fields);
  const fieldMode = !weightedMode && shouldUseFieldEvaluation(
    rubricList.length,
    orderedFields.length,
    rubrics !== undefined,
    submission.template_type_slug,
  );
  const feedbackCategories = feedbackCategoriesOf(rubrics);
  const savedFieldEvaluation = resolveFieldEvaluation({
    templateFields: submission.template_fields,
    feedbackRubrics: submission.feedback?.rubrics,
    feedbackComment: typeof submission.feedback?.comment === 'string' ? submission.feedback.comment : '',
    fieldEvaluation: (submission.field_evaluation ?? null) as OptionalFieldEvaluation | null,
  });
  const categoryOrder = feedbackCategories.map((category) => category.name);
  const parseScoreInput = (rawInput: string): number | null => {
    const trimmed = rawInput.trim();
    if (trimmed === '') {
      return null;
    }
    const parsed = Number(trimmed);
    return Number.isFinite(parsed) ? parsed : Number.NaN;
  };

  const validateScores = () => {
    const nextErrors: Record<string, string> = {};
    const rubricPayload: RubricFeedbackEntry[] = [];
    let total = 0;

    rubricList.forEach((rubric) => {
      const parsed = parseScoreInput(scoreInputs[rubric.criterion] ?? '');
      if (parsed === null) {
        nextErrors[rubric.criterion] = 'Score is required.';
        return;
      }
      if (Number.isNaN(parsed)) {
        nextErrors[rubric.criterion] = 'Enter a valid number.';
        return;
      }
      if (parsed > 10) {
        nextErrors[rubric.criterion] = 'Score cannot be greater than 10.';
        return;
      }
      if (parsed < 0) {
        nextErrors[rubric.criterion] = 'Score cannot be less than 0.';
        return;
      }
      total += parsed;
      rubricPayload.push({
        criterion: rubric.criterion,
        selected_option: `Score: ${parsed}`,
        marks: parsed,
        score: parsed,
      });
    });

    setScoreErrors(nextErrors);
    return {
      hasErrors: Object.keys(nextErrors).length > 0,
      rubricPayload,
      total,
    };
  };

  const totalScore = rubricList.reduce((sum, rubric) => {
    const parsed = parseScoreInput(scoreInputs[rubric.criterion] ?? '');
    if (parsed === null || Number.isNaN(parsed) || parsed > 10 || parsed < 0) {
      return sum;
    }
    return sum + parsed;
  }, 0);

  const hasAllValidScores = rubricList.length > 0 && rubricList.every((rubric) => {
    const parsed = parseScoreInput(scoreInputs[rubric.criterion] ?? '');
    return parsed !== null && !Number.isNaN(parsed) && parsed >= 0 && parsed <= 10;
  });

  const maximumScore = rubricList.length * 10;

  const curiePresentation = presentInstructorCurie({
    submissionStatus: submission.status,
    feedbackSource: submission.feedback?.source,
    curieReview: submission.curie_review,
  });
  const activeStructuredFeedback = (
    !weightedMode
    && submission.feedback?.source === 'human'
    && submission.feedback?.structured_feedback?.field_feedback?.length > 0
      ? submission.feedback.structured_feedback
      : null
  );
  const displayedStructuredReview = activeStructuredFeedback
    ? {
      status: 'ready',
      verdict: activeStructuredFeedback.verdict
        ?? (submission.feedback.status === 'approved' ? 'accepted' : 'rejected'),
      overall_feedback: activeStructuredFeedback.overall_feedback,
      gate_criterion_scores: activeStructuredFeedback.gate_criterion_scores,
      field_feedback: activeStructuredFeedback.field_feedback,
      instructor_form_locked: false,
    }
    : submission.curie_review;
  const displayedCuriePresentation = activeStructuredFeedback
    ? { ...curiePresentation, showReadyOutput: true }
    : curiePresentation;
  const feedbackHistoryVersions = (submission.feedback?.versions ?? []).filter((version: any) => {
    const currentVersion = submission.version_number ?? submission.version;
    if (
      activeStructuredFeedback
      && version.source === 'human'
      && version.submission_version_number === currentVersion
    ) {
      return false;
    }
    if (!curiePresentation.showReadyOutput) {
      return true;
    }
    if (version.source === 'human') {
      return true;
    }
    if (version.source === 'curie') {
      return version.submission_version_number !== currentVersion;
    }
    return (
      version.comment !== submission.curie_review?.overall_feedback
      || version.status !== submission.feedback?.status
    );
  });

  const handleFeedbackSubmit = (feedbackStatus: 'approved' | 'rejected') => {
    if (curiePresentation.formLocked) {
      return;
    }
    if (weightedMode) {
      const nextErrors = validateWeightedScores(weightedSections, weightedScores);
      setWeightedErrors(nextErrors);
      if (Object.keys(nextErrors).length > 0) {
        return;
      }
      if (curiePresentation.requireOverrideConfirm && !window.confirm(INSTRUCTOR_OVERRIDE_CONFIRM)) {
        return;
      }
      feedbackMut.mutate({
        feedbackStatus,
        rubricPayload: buildWeightedFeedbackPayload(
          weightedSections,
          weightedScores,
          weightedFeedback,
        ),
        total: 0,
      });
      return;
    }
    if (fieldMode) {
      const nextErrors = validateFieldScoreInputs(orderedFields, dimensionScores);
      setFieldScoreErrors(nextErrors);
      if (Object.keys(nextErrors).length > 0) {
        return;
      }
      feedbackMut.mutate({
        feedbackStatus,
        rubricPayload: buildFieldRubricPayload(orderedFields, dimensionScores, sectionFeedback),
        total: 0,
      });
      return;
    }
    const { hasErrors, rubricPayload, total } = validateScores();
    if (hasErrors) {
      return;
    }
    if (curiePresentation.requireOverrideConfirm && !window.confirm(INSTRUCTOR_OVERRIDE_CONFIRM)) {
      return;
    }
    feedbackMut.mutate({ feedbackStatus, rubricPayload, total });
  };
  const handleStructuredOverrideSubmit = (
    feedbackStatus: 'approved' | 'rejected',
    structuredFeedback: StructuredFeedback,
  ) => {
    if (!window.confirm(INSTRUCTOR_OVERRIDE_CONFIRM)) {
      return;
    }
    feedbackMut.mutate({
      feedbackStatus,
      rubricPayload: [],
      total: 0,
      structuredFeedback,
    });
  };
  const renderPredefinedFeedback = (categoryName: string, feedbackOptions: string[], controlId: string) => (
    <PredefinedFeedbackMultiSelect
      controlId={controlId}
      options={feedbackOptions}
      selected={selectedFeedbacks[categoryName] ?? []}
      onChange={(nextSelected) => {
        setSelectedFeedbacks((prev) => ({
          ...prev,
          [categoryName]: nextSelected,
        }));
        setComment((prev) => plainTextToHtml(
          updateCategorySection(
            htmlToPlainText(prev),
            categoryName,
            categoryOrder,
            nextSelected,
            feedbackOptions,
          ),
        ));
      }}
      className="flex-grow-1"
    />
  );
  const versionHistory: any[] = submission.version_history ?? [];
  const isSubmitted = submission.status === 'submitted';
  const showStructuredOverride = Boolean(
    overrideEditing
    && curiePresentation.showReadyOutput
    && submission.curie_review
    && !weightedMode,
  );
  const showGradingForm = !showStructuredOverride && (
    (isSubmitted && !curiePresentation.formLocked && !curiePresentation.canOverride)
    || overrideEditing
  );
  const showPreviousProjection = Boolean(
    !isSubmitted
    && submission.feedback
    && !curiePresentation.showReadyOutput
    && !activeStructuredFeedback,
  );
  let feedbackCardTitle = 'Previous Feedback';
  if (curiePresentation.canPublish || curiePresentation.showReadyOutput) {
    feedbackCardTitle = 'CURIE review';
  } else if (activeStructuredFeedback) {
    feedbackCardTitle = 'Instructor review';
  } else if (showGradingForm || isSubmitted) {
    feedbackCardTitle = 'Instructor Feedback';
  }

  return (
    <div className="d-flex flex-column h-100">
      {/* Header */}
      <div className="d-flex align-items-center px-4 py-3 bg-white border-bottom" style={{ gap: '0.75rem' }}>
        <Button variant="tertiary" size="sm" iconBefore={ArrowBack} onClick={onBack}>
          Back
        </Button>
        <div className="flex-grow-1">
          <h2 className="h5 mb-0">{submission.username}{'\'s Submission'}</h2>
          <small className="text-muted">
            {submission.submission_date
              ? new Date(submission.submission_date).toLocaleString()
              : 'Not submitted'}
            {' · '}v{submission.version ?? 1}
          </small>
        </div>
        <Badge variant={STATUS_BADGE[submission.status] ?? 'secondary'}>
          {formatSubmissionStatusLabel(submission.status)}
        </Badge>
        {curiePresentation.reviewStatusLabel && (
          <Badge variant={curieStatusBadgeVariant(curiePresentation.reviewStatusLabel)}>
            CURIE {curiePresentation.reviewStatusLabel}
          </Badge>
        )}
        {curiePresentation.sourceLabel && (
          <Badge variant={curiePresentation.sourceLabel === 'Human' ? 'secondary' : 'light'}>
            Source: {curiePresentation.sourceLabel}
          </Badge>
        )}
      </div>

      {/* Body */}
      <div className="flex-grow-1 overflow-auto p-4">
        <div className="row">
          {/* Left: Submitted PDF */}
          <div className="col-12 col-lg-6 mb-4">
            {submission.pdf && (
              <SubmissionPdfViewer
                pdfUrl={submission.pdf}
                title="Submitted PDF"
                iframeTitle="Student submission PDF"
                downloadFilename={`submission_${submission.id}.pdf`}
              />
            )}
          </div>

          {/* Right: Feedback form (submitted) or past feedback (rejected) */}
          <div className="col-12 col-lg-6 mb-4">
            <Card className="shadow-sm">
              <Card.Header title={feedbackCardTitle} />
              <Card.Section>
                <InstructorCuriePanel
                  presentation={displayedCuriePresentation}
                  review={displayedStructuredReview}
                  templateFields={submission.template_fields ?? {}}
                  overrideEditing={overrideEditing}
                />
                {curiePresentation.formLocked && (
                  <p className="text-muted small mb-0" data-testid="instructor-form-locked">
                    Approve and Reject stay disabled until CURIE finishes or times out.
                  </p>
                )}
                {curiePresentation.canPublish && !overrideEditing && (
                  <Button
                    variant="primary"
                    size="sm"
                    className="mb-3 mr-2"
                    disabled={publishCurieMut.isPending}
                    onClick={handlePublishCurie}
                  >
                    {publishCurieMut.isPending ? 'Publishing…' : INSTRUCTOR_PUBLISH_ACTION}
                  </Button>
                )}
                {curiePresentation.canOverride && !overrideEditing && !feedbackSaved && (
                  <Button
                    variant="tertiary"
                    size="sm"
                    className="mb-3"
                    onClick={() => {
                      if (weightedMode) {
                        hydratedSubmissionIdRef.current = null;
                      }
                      setOverrideEditing(true);
                    }}
                  >
                    {INSTRUCTOR_OVERRIDE_ACTION}
                  </Button>
                )}
                {overrideEditing && (
                  <Button
                    variant="tertiary"
                    size="sm"
                    className="mb-3"
                    onClick={() => setOverrideEditing(false)}
                  >
                    Cancel override
                  </Button>
                )}
                {showStructuredOverride && submission.curie_review && !feedbackSaved && (
                  <StructuredOverrideEditor
                    review={submission.curie_review}
                    templateFields={submission.template_fields ?? {}}
                    isSaving={feedbackMut.isPending}
                    onSubmit={handleStructuredOverrideSubmit}
                  />
                )}
                {/* Past feedback for human-owned / non-CURIE finalized reviews */}
                {showPreviousProjection && fieldMode && (
                  <div>
                    <Badge variant={FEEDBACK_BADGE[submission.feedback.status] ?? 'secondary'} className="mb-3">
                      {formatFeedbackStatusLabel(submission.feedback.status)}
                    </Badge>
                    <FieldEvaluationCards sections={savedFieldEvaluation.sections} readOnly />
                    <Form.Group className="mb-0">
                      <Form.Label className="small font-weight-bold">Overall feedback</Form.Label>
                      {submission.feedback.comment ? (
                        <InstructorCommentHtml comment={submission.feedback.comment} className="small mb-0" />
                      ) : (
                        <p className="text-muted small mb-0">No overall feedback.</p>
                      )}
                    </Form.Group>
                  </div>
                )}

                {showPreviousProjection && !fieldMode && (
                  <div>
                    <Badge variant={FEEDBACK_BADGE[submission.feedback.status] ?? 'secondary'} className="mb-2">
                      {formatFeedbackStatusLabel(submission.feedback.status)}
                    </Badge>
                    {weightedMode && (
                      <div className="mt-2">
                        <WeightedRubricGrading
                          sections={weightedSections}
                          templateFields={submission.template_fields}
                          scores={draftFromWeightedFeedback(weightedSections, submission.feedback.rubrics)}
                          feedback={feedbackFromWeightedRows(weightedSections, submission.feedback.rubrics)}
                          readOnly
                        />
                      </div>
                    )}
                    {!weightedMode && submission.feedback.rubrics?.some(isLegacyRubricRow) && (
                      <div className="mt-2 mb-2">
                        {submission.feedback.rubrics.filter(isLegacyRubricRow).map((r: RubricFeedbackEntry) => (
                          <div key={r.criterion} className="d-flex justify-content-between small py-1" style={{ borderBottom: '1px solid #e9ecef' }}>
                            <span>{r.criterion}</span>
                            <span>
                              <strong>{r.score ?? r.marks ?? '—'}</strong>
                              {(r.score != null || r.marks != null) && (
                                <span className="text-muted ml-1">pts</span>
                              )}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                    {submission.feedback.comment ? (
                      <div className="mt-2">
                        <InstructorCommentHtml
                          comment={submission.feedback.comment}
                          className="small mb-0"
                        />
                      </div>
                    ) : (
                      <p className="text-muted small mb-0">No comment left.</p>
                    )}

                  </div>
                )}

                {!isSubmitted && !submission.feedback && (
                  <p className="text-muted small mb-0">No feedback recorded.</p>
                )}

                {/* Review form — submitted and not pending-locked */}
                {showGradingForm && (
                  feedbackSaved ? (
                    <div className="d-flex align-items-center text-success" style={{ gap: '0.5rem' }}>
                      <CheckCircle />
                      <span>Feedback saved.</span>
                    </div>
                  ) : (
                    <>
                      {weightedMode && (
                        <WeightedRubricGrading
                          sections={weightedSections}
                          templateFields={submission.template_fields}
                          scores={weightedScores}
                          feedback={weightedFeedback}
                          errors={weightedErrors}
                          onScoreChange={(componentId, criterionId, value) => {
                            setWeightedScores((prev) => ({
                              ...prev,
                              [componentId]: { ...prev[componentId], [criterionId]: value },
                            }));
                          }}
                          onFeedbackChange={(componentId, value) => {
                            setWeightedFeedback((prev) => ({ ...prev, [componentId]: value }));
                          }}
                          renderComponentExtras={(component) => {
                            const feedbackOptions = normalizeFeedbacks(component.feedbacks);
                            if (feedbackOptions.length === 0) return null;
                            return renderPredefinedFeedback(
                              component.name,
                              feedbackOptions,
                              `${usageKey}-${component.id}-feedback`,
                            );
                          }}
                        />
                      )}

                      {!fieldMode && !weightedMode && rubricList.length > 0 && (
                        <div className="mb-4">
                          {rubricList.map((rubric, idx) => {
                            const categoryName = rubric.criterion || `Category ${idx + 1}`;
                            const categoryKey = `${usageKey}-${categoryName}`;
                            const feedbackOptions = normalizeFeedbacks(rubric.feedbacks);

                            return (
                              <Card key={categoryKey} className="mb-4" style={categoryCardStyle}>
                                <Card.Section className="p-3 p-md-4">
                                  <h3
                                    className="mb-0 font-weight-bold"
                                    style={{
                                      fontSize: '1.42rem',
                                      lineHeight: 1.3,
                                    }}
                                  >
                                    {categoryName}
                                  </h3>

                                  <div style={categoryDividerStyle} />

                                  <p
                                    className="small font-weight-bold text-muted mb-2 text-uppercase"
                                    style={{ letterSpacing: '0.04em', fontSize: '0.72rem' }}
                                  >
                                    Criteria Preview
                                  </p>
                                  <div className="d-flex flex-wrap mb-0" style={{ gap: '0.5rem' }}>
                                    {(rubric.options ?? []).map((option) => (
                                      <span
                                        key={`${categoryKey}-${option.name}`}
                                        style={criteriaChipStyle}
                                      >
                                        {option.name}
                                        {' '}
                                        [
                                        {option.marks}
                                        ]
                                      </span>
                                    ))}
                                    {(rubric.options ?? []).length === 0 && (
                                      <span className="small text-muted">No criteria defined.</span>
                                    )}
                                  </div>

                                  <div style={categoryDividerStyle} />

                                  <div
                                    className="d-flex align-items-center"
                                    style={{ gap: `${categoryControlsGap}px` }}
                                  >
                                    {feedbackOptions.length > 0 && renderPredefinedFeedback(
                                      categoryName,
                                      feedbackOptions,
                                      `${categoryKey}-feedback`,
                                    )}
                                    <div
                                      style={{
                                        width: categoryScoreInputWidth,
                                        flexShrink: 0,
                                        marginLeft: feedbackOptions.length === 0 ? 'auto' : undefined,
                                      }}
                                    >
                                      <Form.Control
                                        type="number"
                                        min={0}
                                        max={10}
                                        step="any"
                                        value={scoreInputs[categoryName] ?? ''}
                                        placeholder="Score"
                                        onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                                          const nextValue = e.target.value;
                                          setScoreInputs((prev) => ({
                                            ...prev,
                                            [categoryName]: nextValue,
                                          }));
                                        }}
                                        isInvalid={Boolean(scoreErrors[categoryName])}
                                        style={{
                                          ...categoryFieldStyle,
                                          textAlign: 'center',
                                          height: '38px',
                                          width: '100%',
                                        }}
                                      />
                                    </div>
                                  </div>
                                  {scoreErrors[categoryName] && (
                                    <div
                                      className="d-flex"
                                      style={{ gap: `${categoryControlsGap}px`, marginTop: '0.25rem' }}
                                    >
                                      {feedbackOptions.length > 0 && <div className="flex-grow-1" />}
                                      <div
                                        style={{
                                          width: categoryScoreInputWidth,
                                          flexShrink: 0,
                                          marginLeft: feedbackOptions.length === 0 ? 'auto' : undefined,
                                          textAlign: 'right',
                                        }}
                                      >
                                        <div className="small text-danger">{scoreErrors[categoryName]}</div>
                                      </div>
                                    </div>
                                  )}
                                </Card.Section>
                              </Card>
                            );
                          })}
                          <Card className="shadow-sm border-0" style={{ background: '#f8f9fa' }}>
                            <Card.Section className="py-3">
                              <div className="d-flex justify-content-between align-items-center">
                                <span
                                  className="small font-weight-bold text-muted text-uppercase mb-0"
                                  style={{ letterSpacing: '0.04em' }}
                                >
                                  Total Score
                                </span>
                                <span className="h5 mb-0 font-weight-bold">
                                  {hasAllValidScores ? totalScore : '—'}
                                  {' / '}
                                  {maximumScore}
                                </span>
                              </div>
                            </Card.Section>
                          </Card>
                        </div>
                      )}

                      {fieldMode && (
                        <>
                          <FieldEvaluationCards
                            sections={savedFieldEvaluation.sections}
                            scores={dimensionScores}
                            feedback={sectionFeedback}
                            errors={fieldScoreErrors}
                            onScoreChange={(fieldId: string, dimension: EvaluationDimension, value: string) => {
                              setDimensionScores((prev) => ({
                                ...prev,
                                [fieldId]: { ...prev[fieldId], [dimension]: value },
                              }));
                            }}
                            onFeedbackChange={(fieldId: string, value: string) => {
                              setSectionFeedback((prev) => ({ ...prev, [fieldId]: value }));
                            }}
                          />
                          <Form.Group className="mb-3">
                            <Form.Label className="small font-weight-bold">Overall feedback</Form.Label>
                            <Form.Control
                              as="textarea"
                              value={comment}
                              aria-label="Overall feedback"
                              onChange={(event: React.ChangeEvent<HTMLTextAreaElement>) => {
                                setComment(event.target.value);
                              }}
                              style={{ width: '100%', minHeight: '7.5rem', whiteSpace: 'pre-wrap' }}
                            />
                            {comment.length >= COMMENT_SOFT_WARN_LENGTH && (
                              <div className="small text-warning mt-1">
                                This comment is very long (50,000+ characters). It will still be saved.
                              </div>
                            )}
                          </Form.Group>
                        </>
                      )}

                      {!fieldMode && (
                      <Form.Group className="mb-3 mt-1">
                        <div className="d-flex align-items-center mb-2">
                          <Form.Label className="small font-weight-bold mb-0 mr-1">
                            Instructor Comment
                          </Form.Label>
                          <OverlayTrigger
                            placement="top"
                            trigger={['hover', 'focus', 'click']}
                            rootClose
                            overlay={(
                              <Tooltip
                                id="instructor-comment-formatting-note"
                                className="tas-instructor-comment-info-tooltip"
                              >
                                {INSTRUCTOR_COMMENT_FORMATTING_NOTE}
                              </Tooltip>
                            )}
                          >
                            <IconButton
                              src={InfoOutline}
                              alt="About Instructor Comment formatting and predefined feedback"
                              size="inline"
                              variant="secondary"
                            />
                          </OverlayTrigger>
                        </div>
                        <InstructorCommentEditor
                          value={comment}
                          onChange={setComment}
                          placeholder="Leave feedback for the student…"
                        />
                        <div className="small text-muted mt-1">(Editable by the instructor)</div>
                        {comment.length >= COMMENT_SOFT_WARN_LENGTH && (
                          <div className="small text-warning mt-1">
                            This comment is very long (50,000+ characters). It will still be saved.
                          </div>
                        )}
                      </Form.Group>
                      )}

                      {/* Approve / Reject buttons */}
                      <div className="d-flex" style={{ gap: '0.5rem' }}>
                        {(
                          [
                            { status: 'approved', label: 'Approve', variant: 'brand' },
                            { status: 'rejected', label: 'Reject', variant: 'outline-danger' },
                          ] as const
                        ).map(({ status, label, variant }) => (
                          <Button
                            key={status}
                            variant={variant}
                            onClick={() => handleFeedbackSubmit(status)}
                            disabled={feedbackMut.isPending}
                          >
                            {feedbackMut.isPending && feedbackMut.variables?.feedbackStatus === status
                              ? <Spinner animation="border" size="sm" screenReaderText="Saving" />
                              : label}
                          </Button>
                        ))}
                      </div>

                      {feedbackMut.isError && (
                        <div className="alert alert-danger mt-2 small">Failed to save feedback.</div>
                      )}
                    </>
                  )
                )}
              </Card.Section>
            </Card>
          </div>
        </div>

        {/* Preserve prior feedback while suppressing only the current CURIE projection duplicate. */}
        {feedbackHistoryVersions.length > 0 && (
          <Card className="shadow-sm mb-4">
            <Card.Header title="Feedback History" />
            <Card.Section>
              {feedbackHistoryVersions.map((v: any) => (
                <div
                  key={v.version_number}
                  className="mb-3 p-3 rounded"
                  style={{ background: '#f8f9fa', borderLeft: `3px solid ${FEEDBACK_BORDER[v.status] ?? '#6c757d'}` }}
                >
                  <div className="d-flex align-items-center mb-1" style={{ gap: '0.5rem' }}>
                    <Badge variant={FEEDBACK_BADGE[v.status] ?? 'secondary'}>
                      {formatFeedbackStatusLabel(v.status)}
                    </Badge>
                    <small className="text-muted">
                      v{v.version_number}{v.created ? ` · ${new Date(v.created).toLocaleString()}` : ''}
                    </small>
                  </div>
                  {fieldRecordsFromRubrics(v.rubrics).length > 0 && (
                    <FieldEvaluationCards
                      sections={resolveFieldEvaluation({
                        templateFields: submission.template_fields,
                        feedbackRubrics: v.rubrics,
                        feedbackComment: '',
                      }).sections}
                      readOnly
                    />
                  )}
                  {weightedMode && (v.rubrics ?? []).some(isWeightedFeedbackRow) && (
                    <WeightedRubricGrading
                      sections={weightedSections}
                      templateFields={submission.template_fields}
                      scores={draftFromWeightedFeedback(weightedSections, v.rubrics)}
                      feedback={feedbackFromWeightedRows(weightedSections, v.rubrics)}
                      readOnly
                    />
                  )}
                  {(v.rubrics ?? []).some(isLegacyRubricRow) && (
                    <div className="mt-1 mb-2">
                      {(v.rubrics as RubricFeedbackEntry[]).filter(isLegacyRubricRow).map((r) => (
                        <div key={`${v.version_number}-${r.criterion}`} className="d-flex justify-content-between small py-1" style={{ borderBottom: '1px solid #e9ecef' }}>
                          <span>{r.criterion}</span>
                          <span>
                            <strong>{r.score ?? r.marks ?? '—'}</strong>
                            {(r.score != null || r.marks != null) && <span className="text-muted ml-1">pts</span>}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                  {v.comment ? (
                    <InstructorCommentHtml comment={v.comment} className="small mb-0" />
                  ) : (
                    <p className="text-muted small mb-0">No comment.</p>
                  )}
                </div>
              ))}
            </Card.Section>
          </Card>
        )}

        {/* Submission version history */}
        {versionHistory.length > 0 && (
          <SubmissionHistory
            versions={versionHistory}
            showFieldCount
            pdfFilenamePrefix="submission"
          />
        )}
      </div>
    </div>
  );
};
