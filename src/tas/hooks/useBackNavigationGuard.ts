/**
 * Intercept browser / device Back while editing a draft assignment so the
 * same BackNavigationModal is shown as the toolbar Back button.
 */

import { useCallback, useEffect, useRef } from 'react';

const GUARD_STATE = { tasBackGuard: true as const };

interface Options {
  /** When true, push a history sentinel and listen for popstate. */
  enabled: boolean;
  /** Called when Back is intercepted (after re-pushing the sentinel). */
  onBack: () => void;
}

interface BackNavigationGuard {
  /** Call before intentional leave so the next popstate is not re-trapped. */
  allowLeave: () => void;
  /** History entries added by this guard (for navigateBackToAssignment). */
  extraHistoryEntries: number;
}

export function useBackNavigationGuard({ enabled, onBack }: Options): BackNavigationGuard {
  const leavingRef = useRef(false);
  const onBackRef = useRef(onBack);
  onBackRef.current = onBack;

  useEffect(() => {
    if (!enabled) {
      leavingRef.current = false;
      return undefined;
    }

    leavingRef.current = false;
    window.history.pushState(GUARD_STATE, '');

    const handlePopState = () => {
      if (leavingRef.current) { return; }
      window.history.pushState(GUARD_STATE, '');
      onBackRef.current();
    };

    window.addEventListener('popstate', handlePopState);
    return () => {
      window.removeEventListener('popstate', handlePopState);
    };
  }, [enabled]);

  const allowLeave = useCallback(() => {
    leavingRef.current = true;
  }, []);

  return {
    allowLeave,
    extraHistoryEntries: enabled ? 1 : 0,
  };
}
