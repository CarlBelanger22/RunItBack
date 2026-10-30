import { useEffect, useMemo, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import type { User } from '@supabase/supabase-js';
import { useAuth } from '../auth/AuthProvider';
import { SessionBrowseEngine } from './sessionBrowseEngine';
import type { EntityLookup } from './types';
import {
  flushLocalSessionSummaryDrafts,
  notifySessionSummary,
  notifySessionSummaryKeepalive,
  persistSessionFlushDraft,
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
 * Tab close: sync local draft, then fetch keepalive (draft recovers full Chrome quit).
 * Renders nothing.
 */
export function SessionBrowseTracker({ lookup }: SessionBrowseTrackerProps) {
  const { user, session, isLoading, isAdmin, role } = useAuth();
  const location = useLocation();
  const engineRef = useRef<SessionBrowseEngine | null>(null);
  const userRef = useRef<User | null>(null);
  const accessTokenRef = useRef<string | null>(null);
  userRef.current = user;
  accessTokenRef.current = session?.access_token ?? null;

  const enabled = useMemo(() => {
    if (isLoading || !user) return false;
    // Wait for league_members sync so we never track admins by email string.
    if (role == null) return false;
    if (isAdmin) return false;
    if (!isProductionClient()) return false;
    return true;
  }, [isLoading, user, role, isAdmin]);

  // Keep lookup fresh
  useEffect(() => {
    engineRef.current?.setLookup(lookup);
  }, [lookup]);

  // Keep token fresh if session object identity changes
  useEffect(() => {
    accessTokenRef.current = session?.access_token ?? null;
  }, [session]);

  // Create / tear down engine with auth
  useEffect(() => {
    if (!enabled || !user) {
      const eng = engineRef.current;
      const prevUser = userRef.current;
      engineRef.current = null;
      if (eng && prevUser) {
        const flush = eng.forceEnd(Date.now());
        if (flush) {
          // Auth teardown while tab alive — normal invoke OK
          void notifySessionSummary(prevUser, flush);
        }
      }
      return;
    }

    const eng = new SessionBrowseEngine(lookup);
    engineRef.current = eng;
    // Local drafts first (full-quit recovery), then DB pending Telegram retries
    void flushLocalSessionSummaryDrafts(user).then(() =>
      retryPendingSessionSummaries(user)
    );

    const maybeSnapshotDraft = () => {
      const u = userRef.current;
      const e = engineRef.current;
      if (!u || !e) return;
      const snap = e.snapshotFlush(Date.now());
      if (snap) persistSessionFlushDraft(u, snap);
    };

    const flushUnload = () => {
      const u = userRef.current;
      const e = engineRef.current;
      const token = accessTokenRef.current;
      if (!u || !e) return;
      // End session once; draft then keepalive so close-tab / full-quit can recover
      const flush = e.forceEnd(Date.now());
      engineRef.current = null;
      if (flush) notifySessionSummaryKeepalive(u, flush, token);
    };

    const onVis = () => {
      const e = engineRef.current;
      const u = userRef.current;
      if (!e || !u) return;
      const flush = e.noteVisibility(
        document.visibilityState === 'visible',
        Date.now()
      );
      if (flush) void notifySessionSummary(u, flush);
      else maybeSnapshotDraft();
    };

    const interval = window.setInterval(() => {
      const e = engineRef.current;
      const u = userRef.current;
      if (!e || !u) return;
      const flush = e.tick(Date.now());
      if (flush) void notifySessionSummary(u, flush);
      else maybeSnapshotDraft();
    }, 60_000);

    document.addEventListener('visibilitychange', onVis);
    window.addEventListener('pagehide', flushUnload);

    // Seed current location
    eng.notePath(location.pathname, location.search, Date.now());

    return () => {
      document.removeEventListener('visibilitychange', onVis);
      window.removeEventListener('pagehide', flushUnload);
      window.clearInterval(interval);
      // React Strict Mode / route remount while still on page — use alive path
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
    if (flush) {
      void notifySessionSummary(u, flush);
      return;
    }
    const snap = eng.snapshotFlush(Date.now());
    if (snap) persistSessionFlushDraft(u, snap);
  }, [enabled, location.pathname, location.search]);

  return null;
}
