/** localStorage drafts so full Chrome quit can still deliver on next open. */

export const SESSION_SUMMARY_DRAFT_KEY = 'rib.sessionSummaryDrafts.v1';
export const SESSION_SUMMARY_DRAFT_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;

export type SessionSummaryDraft = {
  clientSessionId: string;
  summaryText: string;
  sessionStartedAt: string;
  activeDurationMs: number;
  savedAt: number;
};

type DraftRoot = Record<string, Record<string, SessionSummaryDraft>>;

export type DraftStoreOptions = {
  storage?: Storage;
  now?: number;
  maxAgeMs?: number;
};

function getStorage(opts?: DraftStoreOptions): Storage | null {
  if (opts?.storage) return opts.storage;
  if (typeof localStorage === 'undefined') return null;
  return localStorage;
}

function readRoot(storage: Storage): DraftRoot {
  try {
    const raw = storage.getItem(SESSION_SUMMARY_DRAFT_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== 'object') return {};
    return parsed as DraftRoot;
  } catch {
    return {};
  }
}

function writeRoot(storage: Storage, root: DraftRoot): void {
  storage.setItem(SESSION_SUMMARY_DRAFT_KEY, JSON.stringify(root));
}

function pruneUserMap(
  map: Record<string, SessionSummaryDraft>,
  now: number,
  maxAgeMs: number
): Record<string, SessionSummaryDraft> {
  const next: Record<string, SessionSummaryDraft> = {};
  for (const [id, draft] of Object.entries(map)) {
    if (!draft || typeof draft.savedAt !== 'number') continue;
    if (now - draft.savedAt > maxAgeMs) continue;
    next[id] = draft;
  }
  return next;
}

/** Upsert a draft for this user + clientSessionId. Prunes stale drafts for that user. */
export function saveSessionSummaryDraft(
  userId: string,
  draft: Omit<SessionSummaryDraft, 'savedAt'> & { savedAt?: number },
  opts?: DraftStoreOptions
): void {
  const storage = getStorage(opts);
  if (!storage || !userId || !draft.clientSessionId) return;

  const now = opts?.now ?? Date.now();
  const maxAgeMs = opts?.maxAgeMs ?? SESSION_SUMMARY_DRAFT_MAX_AGE_MS;
  const root = readRoot(storage);
  const userMap = pruneUserMap(root[userId] ?? {}, now, maxAgeMs);

  userMap[draft.clientSessionId] = {
    clientSessionId: draft.clientSessionId,
    summaryText: draft.summaryText,
    sessionStartedAt: draft.sessionStartedAt,
    activeDurationMs: draft.activeDurationMs,
    savedAt: draft.savedAt ?? now,
  };

  root[userId] = userMap;
  writeRoot(storage, root);
}

/** List non-stale drafts for a user (oldest savedAt first). */
export function listSessionSummaryDrafts(
  userId: string,
  opts?: DraftStoreOptions
): SessionSummaryDraft[] {
  const storage = getStorage(opts);
  if (!storage || !userId) return [];

  const now = opts?.now ?? Date.now();
  const maxAgeMs = opts?.maxAgeMs ?? SESSION_SUMMARY_DRAFT_MAX_AGE_MS;
  const root = readRoot(storage);
  const pruned = pruneUserMap(root[userId] ?? {}, now, maxAgeMs);

  if (Object.keys(root[userId] ?? {}).length !== Object.keys(pruned).length) {
    if (Object.keys(pruned).length === 0) {
      delete root[userId];
    } else {
      root[userId] = pruned;
    }
    writeRoot(storage, root);
  }

  return Object.values(pruned).sort((a, b) => a.savedAt - b.savedAt);
}

export function removeSessionSummaryDraft(
  userId: string,
  clientSessionId: string,
  opts?: DraftStoreOptions
): void {
  const storage = getStorage(opts);
  if (!storage || !userId || !clientSessionId) return;

  const root = readRoot(storage);
  const userMap = { ...(root[userId] ?? {}) };
  if (!(clientSessionId in userMap)) return;
  delete userMap[clientSessionId];
  if (Object.keys(userMap).length === 0) {
    delete root[userId];
  } else {
    root[userId] = userMap;
  }
  writeRoot(storage, root);
}

/** Drop drafts older than max age for one user (or all if userId omitted). */
export function pruneSessionSummaryDrafts(
  userId: string | null,
  opts?: DraftStoreOptions
): number {
  const storage = getStorage(opts);
  if (!storage) return 0;

  const now = opts?.now ?? Date.now();
  const maxAgeMs = opts?.maxAgeMs ?? SESSION_SUMMARY_DRAFT_MAX_AGE_MS;
  const root = readRoot(storage);
  let removed = 0;

  const userIds = userId ? [userId] : Object.keys(root);
  for (const uid of userIds) {
    const before = Object.keys(root[uid] ?? {}).length;
    const pruned = pruneUserMap(root[uid] ?? {}, now, maxAgeMs);
    removed += before - Object.keys(pruned).length;
    if (Object.keys(pruned).length === 0) {
      delete root[uid];
    } else {
      root[uid] = pruned;
    }
  }

  writeRoot(storage, root);
  return removed;
}
