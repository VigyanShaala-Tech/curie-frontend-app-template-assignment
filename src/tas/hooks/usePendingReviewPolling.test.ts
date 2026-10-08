import { renderHook, act } from '@testing-library/react';
import { usePendingReviewPolling } from './usePendingReviewPolling';

describe('usePendingReviewPolling', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('refreshes once but does not poll on a cold terminal load', async () => {
    const fetcher = jest.fn().mockResolvedValue({ status: 'failed' });
    const onResult = jest.fn();
    renderHook(() => usePendingReviewPolling({
      enabled: true,
      isPending: false,
      fetcher,
      onResult,
    }));
    await act(async () => {
      await Promise.resolve();
      jest.advanceTimersByTime(15_000);
      await Promise.resolve();
    });
    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(onResult).toHaveBeenCalledWith({ status: 'failed' });
  });

  it('refetches a terminal submission on window focus', async () => {
    const fetcher = jest.fn().mockResolvedValue({ status: 'approved' });
    const onResult = jest.fn();
    renderHook(() => usePendingReviewPolling({
      enabled: true,
      isPending: false,
      fetcher,
      onResult,
    }));
    await act(async () => {
      await Promise.resolve();
    });
    expect(fetcher).toHaveBeenCalledTimes(1);
    await act(async () => {
      window.dispatchEvent(new Event('focus'));
      await Promise.resolve();
    });
    expect(fetcher).toHaveBeenCalledTimes(2);
  });

  it('polls while pending, then stops after pending-to-ready', async () => {
    const fetcher = jest.fn()
      .mockResolvedValueOnce({ status: 'pending_evaluation' })
      .mockResolvedValue({ status: 'ready' });
    const onResult = jest.fn();
    const { rerender } = renderHook(
      ({ isPending }) => usePendingReviewPolling({
        enabled: true,
        isPending,
        fetcher,
        onResult,
      }),
      { initialProps: { isPending: true } },
    );

    await act(async () => {
      await Promise.resolve();
    });
    expect(fetcher).toHaveBeenCalledTimes(1);

    await act(async () => {
      jest.advanceTimersByTime(5_000);
      await Promise.resolve();
    });
    expect(fetcher).toHaveBeenCalledTimes(2);

    rerender({ isPending: false });
    await act(async () => {
      jest.advanceTimersByTime(15_000);
      await Promise.resolve();
    });
    expect(fetcher).toHaveBeenCalledTimes(3);
  });

  it('records live failure after pending-to-failed', async () => {
    const fetcher = jest.fn().mockResolvedValue({ status: 'failed' });
    const onResult = jest.fn();
    const { result, rerender } = renderHook(
      ({ isPending }) => usePendingReviewPolling({
        enabled: true,
        isPending,
        fetcher,
        onResult,
      }),
      { initialProps: { isPending: true } },
    );

    await act(async () => {
      await Promise.resolve();
    });
    expect(result.current.observedPending).toBe(true);

    rerender({ isPending: false });
    expect(result.current.observedPending).toBe(true);
  });

  it('refetches on window focus while pending', async () => {
    const fetcher = jest.fn().mockResolvedValue({ status: 'pending_evaluation' });
    renderHook(() => usePendingReviewPolling({
      enabled: true,
      isPending: true,
      fetcher,
      onResult: jest.fn(),
    }));
    await act(async () => {
      await Promise.resolve();
    });
    expect(fetcher).toHaveBeenCalledTimes(1);
    await act(async () => {
      window.dispatchEvent(new Event('focus'));
      await Promise.resolve();
    });
    expect(fetcher).toHaveBeenCalledTimes(2);
  });

  it('does not apply a stale pending response after a newer ready result', async () => {
    let resolveStale: ((value: { status: string }) => void) | undefined;
    const fetcher = jest.fn()
      .mockImplementationOnce(() => new Promise((resolve) => {
        resolveStale = resolve;
      }))
      .mockResolvedValueOnce({ status: 'ready' });
    const onResult = jest.fn();

    renderHook(() => usePendingReviewPolling({
      enabled: true,
      isPending: true,
      fetcher,
      onResult,
    }));

    await act(async () => {
      await Promise.resolve();
    });
    expect(fetcher).toHaveBeenCalledTimes(1);

    await act(async () => {
      jest.advanceTimersByTime(5_000);
      await Promise.resolve();
    });
    expect(fetcher).toHaveBeenCalledTimes(2);
    expect(onResult).toHaveBeenCalledWith({ status: 'ready' });

    await act(async () => {
      resolveStale?.({ status: 'pending_evaluation' });
      await Promise.resolve();
    });
    expect(onResult).toHaveBeenCalledTimes(1);
    expect(onResult).not.toHaveBeenCalledWith({ status: 'pending_evaluation' });
  });

  it('resets live-failure memory when the submission or attempt identity changes', async () => {
    const fetcher = jest.fn().mockResolvedValue({ status: 'pending_evaluation' });
    const { result, rerender } = renderHook(
      ({ identity, isPending }) => usePendingReviewPolling({
        enabled: isPending,
        isPending,
        identity,
        fetcher,
        onResult: jest.fn(),
      }),
      { initialProps: { identity: '9:1', isPending: true } },
    );

    await act(async () => {
      await Promise.resolve();
    });
    expect(result.current.observedPending).toBe(true);

    rerender({ identity: '9:2', isPending: false });
    expect(result.current.observedPending).toBe(false);
  });

  it('clears the timer on unmount', async () => {
    const fetcher = jest.fn().mockResolvedValue({ status: 'pending_evaluation' });
    const { unmount } = renderHook(() => usePendingReviewPolling({
      enabled: true,
      isPending: true,
      fetcher,
      onResult: jest.fn(),
    }));
    await act(async () => {
      await Promise.resolve();
    });
    unmount();
    await act(async () => {
      jest.advanceTimersByTime(20_000);
      await Promise.resolve();
    });
    expect(fetcher).toHaveBeenCalledTimes(1);
  });
});
