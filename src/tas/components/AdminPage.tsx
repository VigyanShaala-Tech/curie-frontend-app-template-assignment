/**
 * AdminPage
 * Mounted at /admin/templates
 * Full admin panel — template CRUD, template types, all submissions.
 * Requires isStaff=true (enforced via query param or __TAS_CONTEXT__).
 */

import React, { useEffect } from 'react';
import { getAuthenticatedUser } from '@edx/frontend-platform/auth';
import { useTasStore } from '../store/tasStore';
import { AdminApp } from './admin/AdminApp';

export const AdminPage: React.FC = () => {
  const setMfeContext = useTasStore((s) => s.setMfeContext);
  const mfeContext = useTasStore((s) => s.mfeContext);

  useEffect(() => {
    const tasContextKey = '__TAS_CONTEXT__';
    const injected = (window as any)[tasContextKey];
    const user = getAuthenticatedUser();
    const params = new URLSearchParams(window.location.search);

    setMfeContext({
      usageKey: injected?.usageKey || params.get('usage_key') || '',
      courseId: injected?.courseId || params.get('course_id') || '',
      studentId:
        injected?.studentId
        || params.get('student_id')
        || (user ? String((user as any).username) : 'admin_demo'),
      isStaff: true,
      isInstructor: true,
    });
  }, [setMfeContext]);

  if (!mfeContext) { return null; }

  return <AdminApp />;
};
