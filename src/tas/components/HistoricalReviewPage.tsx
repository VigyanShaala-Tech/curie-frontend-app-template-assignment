/**
 * Reload-safe historical review for one submitted version.
 */

import React, { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useTasStore } from '../store/tasStore';
import { submissionsApi } from '../services/api';
import { loadAssignedTemplate, loadOwnedSubmission } from '../services/ownedSubmission';
import { StudentFeedbackPanel } from './StudentFeedbackPanel';
import { CurieReviewScreen } from './CurieReviewScreen';
import type { DisplayState } from '../lifecycle/deriveLifecycle';
import type { LearnerCurieReview, Submission, SubmissionFeedback, SubmissionVersion, Template } from '../types';
import { buildStudentMfeContext, decodeUsageKeyParam } from '../utils/studentMfeContext';

function isNotFound(err: any): boolean {
  return err?.response?.status === 404;
}

function humanFeedbackFromVersion(version: SubmissionVersion | undefined): SubmissionFeedback | null {
  if (!version?.feedback_available) {
    return null;
  }
  return {
    status: version.feedback_status ?? 'pending',
    comment: version.instructor_comment ?? '',
    source: version.feedback_source === 'curie' ? 'curie' : 'human',
  };
}

function humanOwnsVersion(version: SubmissionVersion | undefined): boolean {
  return version?.feedback_source === 'human';
}

function historicalDisplayState(review: LearnerCurieReview | null): DisplayState {
  if (!review) return 'legacy';
  if (review.status === 'pending_evaluation') return 'pending';
  if (review.status === 'failed') return 'live_failed';
  if (review.verdict === 'accepted') return 'curie_accepted';
  if (review.verdict === 'rejected') return 'curie_rejected';
  return 'legacy';
}

export const HistoricalReviewPage: React.FC = () => {
  const { usageKey: rawUsageKey, version: rawVersion } = useParams<{
    usageKey: string;
    version: string;
  }>();
  const usageKey = decodeUsageKeyParam(rawUsageKey);
  const versionNumber = rawVersion ? Number(rawVersion) : NaN;
  const navigate = useNavigate();
  const setMfeContext = useTasStore((s) => s.setMfeContext);
  const mfeContext = useTasStore((s) => s.mfeContext);
  const isMobile = useTasStore((s) => s.isMobile);

  const [submission, setSubmission] = useState<Submission | null>(null);
  const [template, setTemplate] = useState<Template | null>(null);
  const [versionSummary, setVersionSummary] = useState<SubmissionVersion | null>(null);
  const [review, setReview] = useState<LearnerCurieReview | null>(null);
  const [humanFeedback, setHumanFeedback] = useState<SubmissionFeedback | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!usageKey) return;
    setMfeContext(buildStudentMfeContext(usageKey));
  }, [usageKey, setMfeContext]);

  useEffect(() => {
    if (!mfeContext || mfeContext.usageKey !== usageKey || Number.isNaN(versionNumber)) {
      return undefined;
    }
    let cancelled = false;
    setLoading(true);
    setError(null);
    setReview(null);
    setHumanFeedback(null);
    Promise.all([loadOwnedSubmission(mfeContext), loadAssignedTemplate(mfeContext)])
      .then(async ([owned, assigned]) => {
        if (cancelled) return;
        setSubmission(owned);
        setTemplate(assigned);
        if (!owned) {
          setError('No submission found for this assignment.');
          return;
        }
        const versionsRes = await submissionsApi.getVersions(owned.id);
        const summary = versionsRes.versions.find((item) => item.version_number === versionNumber);
        setVersionSummary(summary ?? null);
        const human = humanFeedbackFromVersion(summary);

        if (humanOwnsVersion(summary) || !summary?.curie_review_status) {
          if (!cancelled) setHumanFeedback(human);
          return;
        }

        try {
          const payload = await submissionsApi.getCurieReview(owned.id, versionNumber);
          if (!cancelled) setReview(payload);
        } catch (err) {
          if (!isNotFound(err)) {
            throw err;
          }
          if (!cancelled) setHumanFeedback(human);
        }
      })
      .catch(() => {
        if (!cancelled) setError('Unable to load this attempt’s review.');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [mfeContext, usageKey, versionNumber]);

  if (!usageKey) return null;

  const historyHref = `/submission/${encodeURIComponent(usageKey)}/history`;
  const displayState = historicalDisplayState(review);
  const showCurie = Boolean(
    template
    && review
    && (
      displayState === 'pending'
      || displayState === 'live_failed'
      || displayState === 'curie_accepted'
      || displayState === 'curie_rejected'
    ),
  );

  return (
    <div className="curie-history-page">
      {loading && (
        <div style={{ padding: 24 }}>Loading review…</div>
      )}
      {error && (
        <div style={{ padding: 24 }} role="alert">{error}</div>
      )}
      {!loading && !error && showCurie && template && (
        <CurieReviewScreen
          template={template}
          displayState={displayState as 'pending' | 'live_failed' | 'curie_accepted' | 'curie_rejected'}
          review={review}
          title={template.name}
          submittedAt={versionSummary?.submitted_at}
          usageKey={usageKey}
          formData={versionSummary?.form_data ?? {}}
          atMaxAttempts={false}
          canReattempt={false}
          isSlowPending={Boolean(review?.is_slow_pending)}
          isSaving={false}
          isMobile={isMobile}
          historical
          attemptNumber={versionSummary?.attempt_number}
          onBack={() => navigate(historyHref)}
          onRequestSubmit={() => undefined}
        />
      )}
      {!loading && !error && !showCurie && (
        <div style={{ padding: 24, maxWidth: 960, margin: '0 auto' }}>
          <div style={{ marginBottom: 16 }}>
            <Link to={historyHref}>← Back to history</Link>
          </div>
          {humanFeedback && <StudentFeedbackPanel feedback={humanFeedback} />}
          {!review && !humanFeedback && submission && (
            <div>No CURIE review is stored for this attempt. Legacy human feedback remains on the assignment page.</div>
          )}
        </div>
      )}
    </div>
  );
};
