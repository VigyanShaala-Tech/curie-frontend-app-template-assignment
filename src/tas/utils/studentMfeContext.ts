import { getAuthenticatedUser } from '@edx/frontend-platform/auth';
import type { MfeContext } from '../types';

export function decodeUsageKeyParam(rawUsageKey: string | undefined): string | undefined {
  return rawUsageKey ? decodeURIComponent(rawUsageKey) : undefined;
}

/** `block-v1:ORG+COURSE+RUN+type@…` → `course-v1:ORG+COURSE+RUN` (no trailing +). */
export function courseIdFromUsageKey(usageKey: string): string {
  const match = usageKey.match(/^(?:block-v1:|course-v1:)([^+]+\+[^+]+\+[^+]+)/);
  if (match) {
    return `course-v1:${match[1]}`;
  }
  return usageKey
    .replace(/^block-v1:/, 'course-v1:')
    .replace(/\+type@.*$/i, '')
    .replace(/\+$/, '');
}

export function buildStudentMfeContext(usageKey: string): MfeContext {
  // eslint-disable-next-line no-underscore-dangle
  const injected = (window as any).__TAS_CONTEXT__;
  const user = getAuthenticatedUser();
  const params = new URLSearchParams(window.location.search);

  return {
    usageKey,
    courseId:
      injected?.courseId
      || params.get('course_id')
      || courseIdFromUsageKey(usageKey),
    studentId:
      injected?.studentId
      || params.get('student_id')
      || (user ? String((user as any).username) : 'student_demo'),
    isStaff: false,
    isInstructor: false,
  };
}
