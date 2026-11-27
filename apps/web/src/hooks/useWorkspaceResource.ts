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
 * Uses monotonic request generations and mount tracking so out-of-order
 * fetches or refreshes never overwrite newer state, and avoids render-time
 * ref writes or synchronous setState inside effects.
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

  const isMountedRef = useRef(true);
  const requestGenerationRef = useRef(0);
  const manualRefreshGenerationRef = useRef(0);
  const onLoadedRef = useRef(onLoaded);
  const onSessionIssueRef = useRef(onSessionIssue);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
      requestGenerationRef.current += 1;
    };
  }, []);

  useEffect(() => {
    onLoadedRef.current = onLoaded;
  }, [onLoaded]);

  useEffect(() => {
    onSessionIssueRef.current = onSessionIssue;
  }, [onSessionIssue]);

  useEffect(() => {
    const generation = ++requestGenerationRef.current;

    if (!enabled) {
      return () => {
        requestGenerationRef.current += 1;
      };
    }

    async function runFetch(): Promise<void> {
      try {
        const result = await fetcher();
        if (!isMountedRef.current || requestGenerationRef.current !== generation) {
          return;
        }
        setState({ key: requestKey, data: result, error: null });
        onLoadedRef.current?.(result);
      } catch (error: unknown) {
        if (!isMountedRef.current || requestGenerationRef.current !== generation) {
          return;
        }
        onSessionIssueRef.current?.(error);
        setState((prev) => ({
          key: requestKey,
          data: prev?.data ?? null,
          error: formatWorkspaceError(error, moduleLabel),
        }));
      }
    }

    void runFetch();
    return () => {
      requestGenerationRef.current += 1;
    };
  }, [enabled, fetcher, moduleLabel, requestKey]);

  const refresh = useCallback(async () => {
    if (!enabled) {
      return;
    }

    const generation = ++requestGenerationRef.current;
    const refreshGeneration = ++manualRefreshGenerationRef.current;
    const targetRequestKey = requestKey;
    const runRefresh = refresher ?? fetcher;

    setIsManualRefreshing(true);
    try {
      const result = await runRefresh();
      if (!isMountedRef.current || requestGenerationRef.current !== generation) {
        return;
      }
      setState({ key: targetRequestKey, data: result, error: null });
      onLoadedRef.current?.(result);
    } catch (error: unknown) {
      if (!isMountedRef.current || requestGenerationRef.current !== generation) {
        return;
      }
      onSessionIssueRef.current?.(error);
      setState((prev) => ({
        key: targetRequestKey,
        data: prev?.data ?? null,
        error: formatWorkspaceError(error, moduleLabel),
      }));
    } finally {
      if (isMountedRef.current && manualRefreshGenerationRef.current === refreshGeneration) {
        setIsManualRefreshing(false);
      }
    }
  }, [enabled, fetcher, moduleLabel, refresher, requestKey]);

  const data = state?.data ?? null;
  const error = state?.key === requestKey ? state.error : null;
  const isPendingKey = enabled && state?.key !== requestKey;
  const isLoading = isPendingKey && data === null;
  const isRefreshing = enabled && (isManualRefreshing || (isPendingKey && data !== null));

  return {
    data,
    error,
    isLoading,
    isRefreshing,
    refresh,
  };
}
