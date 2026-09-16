import { useEffect, useRef, useState } from 'react';
import { PENDING_POLL_INTERVAL_MS } from '../lifecycle/constants';

interface Options<T> {
  enabled: boolean;
  isPending: boolean;
  fetcher: () => Promise<T>;
  onResult: (value: T) => void;
  intervalMs?: number;
  /** Submission plus attempt/version identity. Changing it resets live-failure memory. */
  identity?: string | number | null;
}

/**
 * One timer while a CURIE (or legacy unreviewed) review is pending.
 * Stops on terminal status or unmount, refetches on window focus, and
 * remembers that this session observed pending (live-failure vs cold-failure).
 */
export function usePendingReviewPolling<T>({
  enabled,
  isPending,
  fetcher,
  onResult,
  intervalMs = PENDING_POLL_INTERVAL_MS,
  identity = null,
}: Options<T>): { observedPending: boolean } {
  const [observedPending, setObservedPending] = useState(false);
  const fetcherRef = useRef(fetcher);
  const onResultRef = useRef(onResult);
  fetcherRef.current = fetcher;
  onResultRef.current = onResult;

  useEffect(() => {
    setObservedPending(false);
  }, [identity]);

  useEffect(() => {
    if (isPending) {
      setObservedPending(true);
    }
  }, [isPending, identity]);

  useEffect(() => {
    if (!enabled || !isPending) {
      return undefined;
    }

    let cancelled = false;
    let requestId = 0;
    let intervalId: ReturnType<typeof setInterval> | undefined;

    const refresh = () => {
      const id = requestId + 1;
      requestId = id;
      fetcherRef.current()
        .then((value) => {
          if (!cancelled && id === requestId) {
            onResultRef.current(value);
          }
        })
        .catch(() => {});
    };

    refresh();
    intervalId = setInterval(refresh, intervalMs);
    const onFocus = () => refresh();
    window.addEventListener('focus', onFocus);

    return () => {
      cancelled = true;
      if (intervalId) {
        clearInterval(intervalId);
      }
      window.removeEventListener('focus', onFocus);
    };
  }, [enabled, isPending, intervalMs, identity]);

  return { observedPending };
}
