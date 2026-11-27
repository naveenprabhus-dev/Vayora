import { act, cleanup, renderHook, waitFor } from '@testing-library/react';
import { useCallback } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { useWorkspaceResource } from '../../src/hooks/useWorkspaceResource.ts';

afterEach(() => {
  cleanup();
});

function createDeferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

describe('useWorkspaceResource', () => {
  it('1. loads initial successful request and invokes onLoaded', async () => {
    const onLoaded = vi.fn();
    const fetcher = vi.fn(async () => ({ count: 42 }));

    const { result } = renderHook(() =>
      useWorkspaceResource({
        requestKey: 'k1',
        moduleLabel: 'Air Quality Summary',
        fetcher,
        onLoaded,
      }),
    );

    expect(result.current.isLoading).toBe(true);
    expect(result.current.data).toBeNull();
    expect(result.current.error).toBeNull();

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.data).toEqual({ count: 42 });
    expect(result.current.error).toBeNull();
    expect(result.current.isRefreshing).toBe(false);
    expect(onLoaded).toHaveBeenCalledTimes(1);
    expect(onLoaded).toHaveBeenCalledWith({ count: 42 });
  });

  it('2. handles initial failed request and invokes onSessionIssue', async () => {
    const onSessionIssue = vi.fn();
    const errorObj = new Error('Network offline');
    const fetcher = vi.fn(async () => {
      throw errorObj;
    });

    const { result } = renderHook(() =>
      useWorkspaceResource({
        requestKey: 'k1',
        moduleLabel: 'Daily Routines',
        fetcher,
        onSessionIssue,
      }),
    );

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.data).toBeNull();
    expect(result.current.error).toBe('Network offline');
    expect(onSessionIssue).toHaveBeenCalledWith(errorObj);
  });

  it('3. does not execute fetcher when resource is disabled', () => {
    const fetcher = vi.fn(async () => ({ ok: true }));

    const { result } = renderHook(() =>
      useWorkspaceResource({
        requestKey: 'k1',
        enabled: false,
        moduleLabel: 'Disabled Module',
        fetcher,
      }),
    );

    expect(fetcher).not.toHaveBeenCalled();
    expect(result.current.isLoading).toBe(false);
    expect(result.current.isRefreshing).toBe(false);
    expect(result.current.data).toBeNull();
    expect(result.current.error).toBeNull();
  });

  it('4. refetches on requestKey change while preserving stale data during transition', async () => {
    const first = createDeferred<string>();
    const second = createDeferred<string>();
    const fetcherMock = vi.fn((key: string) => (key === 'k1' ? first.promise : second.promise));

    const { result, rerender } = renderHook(
      ({ requestKey }: { requestKey: string }) => {
        const stableFetcher = useCallback(() => fetcherMock(requestKey), [requestKey]);
        return useWorkspaceResource({
          requestKey,
          moduleLabel: 'Advisory',
          fetcher: stableFetcher,
        });
      },
      { initialProps: { requestKey: 'k1' } },
    );

    await act(async () => {
      first.resolve('first-data');
      await first.promise;
    });

    expect(result.current.data).toBe('first-data');

    rerender({ requestKey: 'k2' });

    expect(result.current.isLoading).toBe(false);
    expect(result.current.isRefreshing).toBe(true);
    expect(result.current.data).toBe('first-data');

    await act(async () => {
      second.resolve('second-data');
      await second.promise;
    });

    expect(result.current.isRefreshing).toBe(false);
    expect(result.current.data).toBe('second-data');
    expect(result.current.error).toBeNull();
  });

  it('5. updates data cleanly on explicit refresh success', async () => {
    const onLoaded = vi.fn();
    const fetcher = vi.fn(async () => 'initial');
    const refresher = vi.fn(async () => 'refreshed');

    const { result } = renderHook(() =>
      useWorkspaceResource({
        requestKey: 'k1',
        moduleLabel: 'Indoor Air',
        fetcher,
        refresher,
        onLoaded,
      }),
    );

    await waitFor(() => {
      expect(result.current.data).toBe('initial');
    });

    await act(async () => {
      await result.current.refresh();
    });

    expect(refresher).toHaveBeenCalledTimes(1);
    expect(result.current.data).toBe('refreshed');
    expect(result.current.error).toBeNull();
    expect(result.current.isRefreshing).toBe(false);
    expect(onLoaded).toHaveBeenLastCalledWith('refreshed');
  });

  it('6. captures refresh failure while retaining existing data', async () => {
    const onSessionIssue = vi.fn();
    const refreshError = new Error('Refresh timed out');
    const fetcher = vi.fn(async () => 'initial');
    const refresher = vi.fn(async () => {
      throw refreshError;
    });

    const { result } = renderHook(() =>
      useWorkspaceResource({
        requestKey: 'k1',
        moduleLabel: 'Alternatives',
        fetcher,
        refresher,
        onSessionIssue,
      }),
    );

    await waitFor(() => {
      expect(result.current.data).toBe('initial');
    });

    await act(async () => {
      await result.current.refresh();
    });

    expect(result.current.data).toBe('initial');
    expect(result.current.error).toBe('Refresh timed out');
    expect(result.current.isRefreshing).toBe(false);
    expect(onSessionIssue).toHaveBeenCalledWith(refreshError);
  });

  it('7. ignores stale out-of-order responses across overlapping requests and key changes', async () => {
    const req1 = createDeferred<string>();
    const req2 = createDeferred<string>();
    const refresh1 = createDeferred<string>();
    const refresh2 = createDeferred<string>();

    let activeFetchIndex = 0;
    const fetcher = vi.fn(() => {
      activeFetchIndex += 1;
      return activeFetchIndex === 1 ? req1.promise : req2.promise;
    });

    let activeRefreshIndex = 0;
    const refresher = vi.fn(() => {
      activeRefreshIndex += 1;
      return activeRefreshIndex === 1 ? refresh1.promise : refresh2.promise;
    });

    const { result, rerender } = renderHook(
      ({ requestKey }: { requestKey: string }) =>
        useWorkspaceResource({
          requestKey,
          moduleLabel: 'Advisory',
          fetcher,
          refresher,
        }),
      { initialProps: { requestKey: 'k1' } },
    );

    // Trigger key change before req1 resolves
    rerender({ requestKey: 'k2' });

    await act(async () => {
      req2.resolve('k2-fresh');
      await req2.promise;
    });
    expect(result.current.data).toBe('k2-fresh');

    // Out-of-order late req1 resolution must NOT overwrite k2-fresh
    await act(async () => {
      req1.resolve('k1-stale');
      await req1.promise;
    });
    expect(result.current.data).toBe('k2-fresh');

    // Start two overlapping refreshes that resolve out of order
    let firstPromise!: Promise<void>;
    let secondPromise!: Promise<void>;
    act(() => {
      firstPromise = result.current.refresh();
      secondPromise = result.current.refresh();
    });

    await act(async () => {
      refresh2.resolve('refresh-newest');
      await secondPromise;
    });
    expect(result.current.data).toBe('refresh-newest');
    expect(result.current.isRefreshing).toBe(false);

    // Late resolution of refresh1 (or rejection) must be ignored
    await act(async () => {
      refresh1.resolve('refresh-stale');
      await firstPromise;
    });
    expect(result.current.data).toBe('refresh-newest');

    // In-flight refresh superseded by requestKey change must also be ignored
    const supersededRefresh = createDeferred<string>();
    const key3Fetch = createDeferred<string>();
    refresher.mockImplementationOnce(() => supersededRefresh.promise);
    fetcher.mockImplementationOnce(() => key3Fetch.promise);

    let supersededPromise!: Promise<void>;
    act(() => {
      supersededPromise = result.current.refresh();
    });
    rerender({ requestKey: 'k3' });

    await act(async () => {
      key3Fetch.resolve('k3-fresh');
      await key3Fetch.promise;
    });
    await act(async () => {
      supersededRefresh.resolve('k2-stale-refresh');
      await supersededPromise;
    });
    expect(result.current.data).toBe('k3-fresh');
  });

  it('8. ignores refresh calls when resource is disabled', async () => {
    const fetcher = vi.fn(async () => 'never');
    const refresher = vi.fn(async () => 'never-refresh');

    const { result } = renderHook(() =>
      useWorkspaceResource({
        requestKey: 'k1',
        enabled: false,
        moduleLabel: 'Disabled Refresh',
        fetcher,
        refresher,
      }),
    );

    await act(async () => {
      await result.current.refresh();
    });

    expect(fetcher).not.toHaveBeenCalled();
    expect(refresher).not.toHaveBeenCalled();
    expect(result.current.isRefreshing).toBe(false);
    expect(result.current.data).toBeNull();
    expect(result.current.error).toBeNull();
  });

  it('9. cancels pending updates and callbacks when unmounted during in-flight request', async () => {
    const deferred = createDeferred<string>();
    const onLoaded = vi.fn();
    const onSessionIssue = vi.fn();
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    const { unmount } = renderHook(() =>
      useWorkspaceResource({
        requestKey: 'k1',
        moduleLabel: 'Unmount Check',
        fetcher: () => deferred.promise,
        onLoaded,
        onSessionIssue,
      }),
    );

    unmount();

    await act(async () => {
      deferred.resolve('late-result');
      await deferred.promise;
    });

    expect(onLoaded).not.toHaveBeenCalled();
    expect(onSessionIssue).not.toHaveBeenCalled();
    expect(consoleErrorSpy).not.toHaveBeenCalled();
    consoleErrorSpy.mockRestore();
  });
});
