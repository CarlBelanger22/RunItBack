import { useEffect, useMemo, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import type { User } from '@supabase/supabase-js';
import { useAuth } from '../auth/AuthProvider';
import { isAdminEmail } from '../auth/adminAllowlist';
import { SessionBrowseEngine } from './sessionBrowseEngine';
import type { EntityLookup } from './types';
import {
  notifySessionSummary,
  retryPendingSessionSummaries,
} from './notifySessionSummary';

function isProductionClient(): boolean {
  if (!import.meta.env.PROD) return false;
  if (typeof window === 'undefined') return false;
  const host = window.location.hostname;
  if (host === 'localhost' || host === '127.0.0.1' || host.endsWith('.local')) {
    return false;
  }
  return true;
}

export type SessionBrowseTrackerProps = {
  lookup: EntityLookup;
};

/**
 * Tracks signed-in prod browse sessions and Telegram-summarizes on idle/midnight/unmount.
 * Renders nothing.
 */
export function SessionBrowseTracker({ lookup }: SessionBrowseTrackerProps) {
  const { user, isLoading } = useAuth();
  const location = useLocation();
  const engineRef = useRef<SessionBrowseEngine | null>(null);
  const userRef = useRef<User | null>(null);
  userRef.current = user;

  const enabled = useMemo(() => {
    if (isLoading || !user) return false;
    if (!isProductionClient()) return false;
    if (isAdminEmail(user.email)) return false;
    return true;
  }, [isLoading, user]);

  // Keep lookup fresh
  useEffect(() => {
    engineRef.current?.setLookup(lookup);
  }, [lookup]);

  // Create / tear down engine with auth
  useEffect(() => {
    if (!enabled || !user) {
      const eng = engineRef.current;
      const prevUser = userRef.current;
      engineRef.current = null;
      if (eng && prevUser) {
        const flush = eng.forceEnd(Date.now());
        if (flush) void notifySessionSummary(prevUser, flush);
      }
      return;
    }

    const eng = new SessionBrowseEngine(lookup);
    engineRef.current = eng;
    void retryPendingSessionSummaries(user);

    const flushIfAny = () => {
      const u = userRef.current;
      const e = engineRef.current;
      if (!u || !e) return;
      const flush = e.forceEnd(Date.now());
      if (flush) void notifySessionSummary(u, flush);
    };

    const onVis = () => {
      const e = engineRef.current;
      const u = userRef.current;
      if (!e || !u) return;
      const flush = e.noteVisibility(document.visibilityState === 'visible', Date.now());
      if (flush) void notifySessionSummary(u, flush);
    };

    const onPageHide = () => {
      flushIfAny();
    };

    const interval = window.setInterval(() => {
      const e = engineRef.current;
      const u = userRef.current;
      if (!e || !u) return;
      const flush = e.tick(Date.now());
      if (flush) void notifySessionSummary(u, flush);
    }, 60_000);

    document.addEventListener('visibilitychange', onVis);
    window.addEventListener('pagehide', onPageHide);

    // Seed current location
    eng.notePath(location.pathname, location.search, Date.now());

    return () => {
      document.removeEventListener('visibilitychange', onVis);
      window.removeEventListener('pagehide', onPageHide);
      window.clearInterval(interval);
      const e = engineRef.current;
      engineRef.current = null;
      if (e && userRef.current) {
        const flush = e.forceEnd(Date.now());
        if (flush) void notifySessionSummary(userRef.current, flush);
      }
    };
    // Intentionally only re-bind when enablement / user id changes
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, user?.id]);

  // Path changes
  useEffect(() => {
    if (!enabled) return;
    const eng = engineRef.current;
    const u = userRef.current;
    if (!eng || !u) return;
    const flush = eng.notePath(location.pathname, location.search, Date.now());
    if (flush) void notifySessionSummary(u, flush);
  }, [enabled, location.pathname, location.search]);

  return null;
}
