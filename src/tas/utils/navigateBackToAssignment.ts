import { getConfig } from '@edx/frontend-platform';
import type { MfeContext } from '../types';

/** Open edX deep link to the assignment block in courseware. */
export function buildAssignmentJumpToUrl(courseId: string, usageKey: string): string {
  const lmsBaseUrl = (getConfig().LMS_BASE_URL as string).replace(/\/$/, '');
  return `${lmsBaseUrl}/courses/${encodeURIComponent(courseId)}/jump_to/${encodeURIComponent(usageKey)}`;
}

/** True when browser history can reliably return to a prior page. */
export function canUseBrowserHistoryBack(): boolean {
  if (window.history.length <= 1) return false;

  const navEntry = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming | undefined;
  if (navEntry?.type === 'reload') return false;

  return true;
}

function hasJumpToContext(mfeContext: MfeContext | null): mfeContext is MfeContext {
  return Boolean(mfeContext?.courseId?.trim() && mfeContext?.usageKey?.trim());
}

export interface NavigateBackOptions {
  /**
   * Extra history entries to skip (e.g. a back-navigation guard sentinel).
   * When using history navigation, goes `-(1 + extraHistoryEntries)` steps.
   * Ignored when falling back to jump_to (full page navigation).
   */
  extraHistoryEntries?: number;
}

/**
 * Leave the MFE for the LMS courseware assignment unit.
 * Prefer jump_to over history.back() so Back never re-enters Submission History
 * after assignment ↔ history in-app navigation (avoids a back-stack loop).
 */
export function navigateBackToAssignment(
  mfeContext: MfeContext | null,
  options?: NavigateBackOptions,
): void {
  const steps = 1 + (options?.extraHistoryEntries ?? 0);

  if (hasJumpToContext(mfeContext)) {
    window.location.assign(
      buildAssignmentJumpToUrl(mfeContext.courseId.trim(), mfeContext.usageKey.trim()),
    );
    return;
  }

  if (canUseBrowserHistoryBack()) {
    window.history.go(-steps);
    return;
  }

  // Graceful last resort — avoid constructing an invalid jump_to URL
  if (window.history.length > 1) {
    window.history.go(-steps);
  }
  // Otherwise remain on the submission page (no navigation, no invalid URL)
}
