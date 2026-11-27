import { useCallback, useEffect, useRef, useState } from 'react';
import { formatWorkspaceError } from '../lib/errorMessages.ts';

export interface UseWorkspaceResourceOptions<T> {
  readonly requestKey: string;
  readonly enabled?: boolean;
  readonly moduleLabel: string;
  readonly fetcher: () => Promise<T>;
  readonly refresher?: () => Promise<T>;
  readonly onLoaded?: (data: T) => void;
  readonly onSessionIssue?: ((error: unknown) => void) | undefined;
}

interface ResourceState<T> {
  readonly key: string;
  readonly data: T | null;
  readonly error: string | null;
}

/**
 * Standardized request-keyed async resource hook for workspace modules.
 * Avoids synchronous setState inside effects while preserving stale-data visibility
 * during filter/scenario updates and explicit forced refreshes.
 */
export function useWorkspaceResource<T>({
  requestKey,
  enabled = true,
  moduleLabel,
  fetcher,
  refresher,
  onLoaded,
  onSessionIssue,
}: UseWorkspaceResourceOptions<T>) {
  const [state, setState] = useState<ResourceState<T> | null>(null);
  const [isManualRefreshing, setIsManualRefreshing] = useState(false);

  const onLoadedRef = useRef(onLoaded);
  onLoadedRef.current = onLoaded;

  useEffect(() => {
    if (!enabled) {
      return;
    }

    let cancelled = false;

    async function runFetch(): Promise<void> {
      try {
        const result = await fetcher();
        if (!cancelled) {
          setState({ key: requestKey, data: result, error: null });
          onLoadedRef.current?.(result);
        }
      } catch (error: unknown) {
        if (!cancelled) {
          onSessionIssue?.(error);
          setState((prev) => ({
            key: requestKey,
            data: prev?.data ?? null,
            error: formatWorkspaceError(error, moduleLabel),
          }));
        }
      }
    }

    void runFetch();
    return () => {
      cancelled = true;
    };
  }, [enabled, fetcher, moduleLabel, onSessionIssue, requestKey]);

  const refresh = useCallback(async () => {
    const runRefresh = refresher ?? fetcher;
    setIsManualRefreshing(true);
    try {
      const result = await runRefresh();
      setState({ key: requestKey, data: result, error: null });
      onLoadedRef.current?.(result);
    } catch (error: unknown) {
      onSessionIssue?.(error);
      setState((prev) => ({
        key: requestKey,
        data: prev?.data ?? null,
        error: formatWorkspaceError(error, moduleLabel),
      }));
    } finally {
      setIsManualRefreshing(false);
    }
  }, [fetcher, moduleLabel, onSessionIssue, refresher, requestKey]);

  const data = state?.data ?? null;
  const error = state?.key === requestKey ? state.error : null;
  const isPendingKey = enabled && state?.key !== requestKey;
  const isLoading = isPendingKey && data === null;
  const isRefreshing = isManualRefreshing || (isPendingKey && data !== null);

  return {
    data,
    error,
    isLoading,
    isRefreshing,
    refresh,
  };
}
