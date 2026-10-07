/**
 * InstructorPage
 * Mounted at /instructor/grade-submissions/:usageKey
 * Shows submissions list for the block; clicking a row opens submission detail.
 */

import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { getAuthenticatedUser } from '@edx/frontend-platform/auth';
import { useTasStore } from '../store/tasStore';
import { AdminSubmissionsList } from './admin/AdminSubmissionsList';
import { AdminSubmissionDetail } from './admin/AdminSubmissionDetail';
import { courseIdFromUsageKey } from '../utils/studentMfeContext';

type View =
  | { mode: 'list' }
  | { mode: 'detail'; submissionId: string };

export const InstructorPage: React.FC = () => {
  const { usageKey: rawUsageKey } = useParams<{ usageKey: string }>();
  const usageKey = rawUsageKey ? decodeURIComponent(rawUsageKey) : undefined;
  const setMfeContext = useTasStore((s) => s.setMfeContext);
  const mfeContext = useTasStore((s) => s.mfeContext);
  const [view, setView] = useState<View>({ mode: 'list' });

  useEffect(() => {
    if (!usageKey) { return; }

    // eslint-disable-next-line no-underscore-dangle
    const injected = (window as any).__TAS_CONTEXT__;
    const user = getAuthenticatedUser();
    const params = new URLSearchParams(window.location.search);

    setMfeContext({
      usageKey,
      courseId:
        injected?.courseId
        || params.get('course_id')
        || courseIdFromUsageKey(usageKey),
      studentId:
        injected?.studentId
        || params.get('student_id')
        || (user ? String((user as any).username) : 'instructor_demo'),
      isStaff: false,
      isInstructor: true,
    });
  }, [usageKey, setMfeContext]);

  if (!mfeContext || mfeContext.usageKey !== usageKey) { return null; }

  if (view.mode === 'detail') {
    return (
      <AdminSubmissionDetail
        submissionId={view.submissionId}
        onBack={() => setView({ mode: 'list' })}
      />
    );
  }

  return (
    <AdminSubmissionsList
      onView={(id) => setView({ mode: 'detail', submissionId: id })}
    />
  );
};
