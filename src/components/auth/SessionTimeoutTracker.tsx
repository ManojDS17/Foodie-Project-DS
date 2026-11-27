import React, { useEffect, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../hooks';

// Production session idle timeout: strictly 15 minutes (900,000 ms)
export const IDLE_TIMEOUT_MS = 15 * 60 * 1000;
const LAST_ACTIVE_KEY = 'foodie_last_active_time';
const THROTTLE_INTERVAL_MS = 3000; // Throttle activity writes to localStorage to every 3 seconds

export const SessionTimeoutTracker: React.FC = () => {
  const { isAuthenticated, user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const lastWriteRef = useRef<number>(0);
  const locationRef = useRef(location);
  const userEmailRef = useRef<string>(user?.email || '');

  useEffect(() => {
    locationRef.current = location;
  }, [location]);

  useEffect(() => {
    userEmailRef.current = user?.email || '';
  }, [user?.email]);

  useEffect(() => {
    // Only track idle session timeout when the user is logged in
    if (!isAuthenticated) {
      lastWriteRef.current = 0;
      return;
    }

    const now = Date.now();
    const existingRaw = localStorage.getItem(LAST_ACTIVE_KEY);
    const existingParsed = existingRaw ? Number(existingRaw) : NaN;
    if (!Number.isFinite(existingParsed) || existingParsed <= 0) {
      localStorage.setItem(LAST_ACTIVE_KEY, now.toString());
      lastWriteRef.current = now;
    } else {
      lastWriteRef.current = existingParsed;
    }

    const getEffectiveTimeout = (): number => {
      const devOverride = (window as any).__FOODIE_SESSION_TIMEOUT_MS__;
      return typeof devOverride === 'number' && devOverride > 0 ? devOverride : IDLE_TIMEOUT_MS;
    };

    const handleExpire = () => {
      const currentLoc = locationRef.current;
      const userEmail = userEmailRef.current;
      if (currentLoc.pathname && currentLoc.pathname !== '/login') {
        sessionStorage.setItem('foodie_redirect_after_login', currentLoc.pathname + currentLoc.search);
      }
      sessionStorage.setItem('foodie_session_expired', 'true');
      sessionStorage.removeItem('foodie_signed_out');
      if (userEmail) {
        sessionStorage.setItem('foodie_expired_email', userEmail);
      }
      localStorage.removeItem(LAST_ACTIVE_KEY);
      logout('session_expired');
      navigate(`/login?view=expired${userEmail ? `&email=${encodeURIComponent(userEmail)}` : ''}`, {
        replace: true,
      });
    };

    const checkInactivity = () => {
      const storedTimeStr = localStorage.getItem(LAST_ACTIVE_KEY);
      const lastActive = storedTimeStr ? Number(storedTimeStr) : Date.now();
      const elapsed = Date.now() - lastActive;
      if (elapsed >= getEffectiveTimeout()) {
        handleExpire();
      }
    };

    const recordUserActivity = () => {
      const ts = Date.now();
      if (ts - lastWriteRef.current > THROTTLE_INTERVAL_MS) {
        lastWriteRef.current = ts;
        localStorage.setItem(LAST_ACTIVE_KEY, ts.toString());
      }
    };

    const activityEvents = ['mousedown', 'mousemove', 'keydown', 'scroll', 'touchstart', 'click'];
    activityEvents.forEach((event) => {
      window.addEventListener(event, recordUserActivity, { passive: true });
    });

    const intervalId = window.setInterval(checkInactivity, 5000);

    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === LAST_ACTIVE_KEY && e.newValue) {
        lastWriteRef.current = Number(e.newValue);
      }
    };
    window.addEventListener('storage', handleStorageChange);

    const handleVisibilityOrFocus = () => {
      if (document.visibilityState === 'visible') {
        checkInactivity();
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityOrFocus);
    window.addEventListener('focus', handleVisibilityOrFocus);

    return () => {
      activityEvents.forEach((event) => {
        window.removeEventListener(event, recordUserActivity);
      });
      window.clearInterval(intervalId);
      window.removeEventListener('storage', handleStorageChange);
      document.removeEventListener('visibilitychange', handleVisibilityOrFocus);
      window.removeEventListener('focus', handleVisibilityOrFocus);
    };
  }, [isAuthenticated, logout, navigate]);

  return null;
};
