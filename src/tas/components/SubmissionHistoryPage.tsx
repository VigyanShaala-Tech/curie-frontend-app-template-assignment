/**
 * Reload-safe standalone history for one assignment.
 * Attempt N, status, rating, and View Detailed Feedback.
 */

import React, { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useTasStore } from '../store/tasStore';
import { submissionsApi } from '../services/api';
import { loadOwnedSubmission } from '../services/ownedSubmission';
import { LearnerAttemptHistory } from './LearnerAttemptHistory';
import { navigateBackToAssignment } from '../utils/navigateBackToAssignment';
import type { SubmissionVersion } from '../types';
import { buildStudentMfeContext, decodeUsageKeyParam } from '../utils/studentMfeContext';

export const SubmissionHistoryPage: React.FC = () => {
  const { usageKey: rawUsageKey } = useParams<{ usageKey: string }>();
  const usageKey = decodeUsageKeyParam(rawUsageKey);
  const navigate = useNavigate();
  const setMfeContext = useTasStore((s) => s.setMfeContext);
  const mfeContext = useTasStore((s) => s.mfeContext);

  const [versions, setVersions] = useState<SubmissionVersion[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!usageKey) { return; }
    setMfeContext(buildStudentMfeContext(usageKey));
  }, [usageKey, setMfeContext]);

  useEffect(() => {
    if (!mfeContext || mfeContext.usageKey !== usageKey) { return undefined; }
    let cancelled = false;
    setLoading(true);
    loadOwnedSubmission(mfeContext)
      .then(async (owned) => {
        if (cancelled) { return; }
        if (!owned) {
          setVersions([]);
          return;
        }
        const res = await submissionsApi.getVersions(owned.id);
        if (!cancelled) { setVersions(res.versions); }
      })
      .catch(() => {
        if (!cancelled) { setError('Unable to load submission history.'); }
      })
      .finally(() => {
        if (!cancelled) { setLoading(false); }
      });
    return () => {
      cancelled = true;
    };
  }, [mfeContext, usageKey]);

  if (!usageKey) { return null; }

  return (
    <div className="curie-history-page">
      <header className="curie-review-header">
        <button
          type="button"
          className="curie-mfe-back"
          onClick={() => navigateBackToAssignment(mfeContext)}
        >
          ← Back to course
        </button>
        <h2>Submission History</h2>
        <Link className="curie-history-link" to={`/submission/${encodeURIComponent(usageKey)}`}>
          Back to assignment
        </Link>
      </header>
      <div className="curie-history-page-body">
        {loading && <div>Loading history…</div>}
        {error && <div role="alert">{error}</div>}
        {!loading && !error && (
          <div className="curie-panel curie-history-panel">
            <LearnerAttemptHistory
              versions={versions}
              onViewFeedback={(version) => {
                navigate(
                  `/submission/${encodeURIComponent(usageKey)}/history/${version.version_number}`,
                );
              }}
            />
          </div>
        )}
      </div>
    </div>
  );
};
