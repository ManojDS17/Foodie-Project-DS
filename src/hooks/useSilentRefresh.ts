import { useEffect, useRef, useState, useCallback } from 'react';

export interface SilentRefreshOptions {
  intervalMs?: number;
  enabled?: boolean;
}

export function useSilentRefresh(
  refreshFn: (signal: AbortSignal) => Promise<void> | void,
  options: SilentRefreshOptions = {}
) {
  const { intervalMs = 12000, enabled = true } = options;
  const isRefreshingRef = useRef(false);
  const activeControllerRef = useRef<AbortController | null>(null);
  const savedCallback = useRef(refreshFn);
  const [lastUpdated, setLastUpdated] = useState<Date>(() => new Date());
  const [isRefreshing, setIsRefreshing] = useState(false);

  useEffect(() => {
    savedCallback.current = refreshFn;
  }, [refreshFn]);

  const executeRefresh = useCallback(async () => {
    if (document.hidden || !navigator.onLine || isRefreshingRef.current) {
      return;
    }

    const controller = new AbortController();
    activeControllerRef.current = controller;

    try {
      isRefreshingRef.current = true;
      setIsRefreshing(true);
      await savedCallback.current(controller.signal);
      if (!controller.signal.aborted) {
        setLastUpdated(new Date());
      }
    } catch (err: any) {
      if (err?.name !== 'AbortError') {
        console.warn('Silent refresh deferred:', err);
      }
    } finally {
      isRefreshingRef.current = false;
      setIsRefreshing(false);
      if (activeControllerRef.current === controller) {
        activeControllerRef.current = null;
      }
    }
  }, []);

  useEffect(() => {
    if (!enabled) {
      activeControllerRef.current?.abort();
      activeControllerRef.current = null;
      return;
    }

    const intervalId = window.setInterval(executeRefresh, intervalMs);

    const handleVisibilityChange = () => {
      if (!document.hidden) {
        executeRefresh();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      window.clearInterval(intervalId);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      activeControllerRef.current?.abort();
      activeControllerRef.current = null;
    };
  }, [intervalMs, enabled, executeRefresh]);

  return {
    lastUpdated,
    isRefreshing,
    triggerRefresh: executeRefresh,
  };
}
