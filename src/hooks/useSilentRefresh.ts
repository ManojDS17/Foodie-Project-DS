import { useEffect, useRef, useState, useCallback } from 'react';

export interface SilentRefreshOptions {
  intervalMs?: number;
  enabled?: boolean;
}

export function useSilentRefresh(
  refreshFn: () => Promise<void> | void,
  options: SilentRefreshOptions = {}
) {
  const { intervalMs = 12000, enabled = true } = options;
  const isRefreshingRef = useRef(false);
  const savedCallback = useRef(refreshFn);
  const [lastUpdated, setLastUpdated] = useState<Date>(new Date());
  const [isRefreshing, setIsRefreshing] = useState(false);

  useEffect(() => {
    savedCallback.current = refreshFn;
  }, [refreshFn]);

  const executeRefresh = useCallback(async () => {
    if (document.hidden || !navigator.onLine || isRefreshingRef.current) {
      return;
    }

    try {
      isRefreshingRef.current = true;
      setIsRefreshing(true);
      await savedCallback.current();
      setLastUpdated(new Date());
    } catch (err) {
      console.warn('Silent refresh deferred:', err);
    } finally {
      isRefreshingRef.current = false;
      setIsRefreshing(false);
    }
  }, []);

  useEffect(() => {
    if (!enabled) return;

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
    };
  }, [intervalMs, enabled, executeRefresh]);

  return {
    lastUpdated,
    isRefreshing,
    triggerRefresh: executeRefresh,
  };
}
