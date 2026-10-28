import {
  classifyLocation,
  pageGroupKey,
} from './classifyLocation';
import { isDifferentSgtDay } from './formatSessionSummary';
import type {
  ClassifiedLocation,
  EntityLookup,
  SessionPageBlock,
  SessionTabDwell,
} from './types';

export const MIN_SEGMENT_MS = 10_000;
export const MIN_SESSION_ACTIVE_MS = 60_000;
export const IDLE_END_MS = 30 * 60 * 1000;

export type SessionFlush = {
  clientSessionId: string;
  startedAt: Date;
  activeDurationMs: number;
  blocks: SessionPageBlock[];
};

type OpenTab = {
  tabKey: string;
  label: string;
  startedAt: number;
  accruedMs: number;
};

type OpenPage = {
  groupKey: string;
  title: string;
  filterNote?: string;
  startedAt: number;
  accruedMs: number;
  tabs: SessionTabDwell[];
  openTab: OpenTab | null;
};

function newSessionId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID();
  }
  return `sess-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

/**
 * Pure session browse engine (no React / DOM). Drive with noteLocation / noteVisibility / tick.
 */
export class SessionBrowseEngine {
  private clientSessionId = newSessionId();
  private sessionStartedAt: number | null = null;
  private activeDurationMs = 0;
  private visible = true;
  private lastTickAt: number | null = null;
  private hiddenSince: number | null = null;
  private closedBlocks: SessionPageBlock[] = [];
  private openPage: OpenPage | null = null;
  private lookup: EntityLookup;

  constructor(lookup: EntityLookup = {}) {
    this.lookup = lookup;
  }

  setLookup(lookup: EntityLookup): void {
    this.lookup = lookup;
  }

  getSessionId(): string {
    return this.clientSessionId;
  }

  notePath(
    pathname: string,
    search: string,
    now: number
  ): SessionFlush | null {
    const idleFlush = this.checkIdleOrMidnight(now);
    if (idleFlush) {
      // After flush, start fresh on this location
      this.applyLocation(pathname, search, now);
      return idleFlush;
    }
    this.applyLocation(pathname, search, now);
    return null;
  }

  noteVisibility(visible: boolean, now: number): SessionFlush | null {
    this.accrueActive(now);
    if (visible) {
      this.visible = true;
      this.hiddenSince = null;
      this.lastTickAt = now;
      return null;
    }
    this.visible = false;
    this.hiddenSince = now;
    this.lastTickAt = now;
    return this.checkIdleOrMidnight(now);
  }

  /** Periodic timer — idle / midnight checks. */
  tick(now: number): SessionFlush | null {
    return this.checkIdleOrMidnight(now);
  }

  /** Sign-out or unmount. */
  forceEnd(now: number): SessionFlush | null {
    return this.endSession(now);
  }

  private applyLocation(pathname: string, search: string, now: number): void {
    const loc = classifyLocation(pathname, search, this.lookup);
    if (!loc) return;
    this.accrueActive(now);
    if (this.sessionStartedAt == null) {
      this.sessionStartedAt = now;
      this.lastTickAt = now;
    }
    this.transitionTo(loc, now);
  }

  private transitionTo(loc: ClassifiedLocation, now: number): void {
    const group = pageGroupKey(loc.key);

    if (!this.openPage) {
      this.openPage = this.startPage(loc, group, now);
      return;
    }

    if (this.openPage.groupKey === group) {
      // Same page entity — maybe tab change
      if (loc.tabKey && loc.tabLabel) {
        this.switchTab(loc.tabKey, loc.tabLabel, now);
      }
      if (loc.filterNote) {
        this.openPage.filterNote = loc.filterNote;
      }
      if (loc.title) {
        this.openPage.title = loc.title;
      }
      return;
    }

    this.closeOpenPage(now);
    this.openPage = this.startPage(loc, group, now);
  }

  private startPage(
    loc: ClassifiedLocation,
    group: string,
    now: number
  ): OpenPage {
    const page: OpenPage = {
      groupKey: group,
      title: loc.title,
      filterNote: loc.filterNote,
      startedAt: now,
      accruedMs: 0,
      tabs: [],
      openTab: null,
    };
    if (loc.tabKey && loc.tabLabel) {
      page.openTab = {
        tabKey: loc.tabKey,
        label: loc.tabLabel,
        startedAt: now,
        accruedMs: 0,
      };
    }
    return page;
  }

  private switchTab(tabKey: string, label: string, now: number): void {
    if (!this.openPage) return;
    if (this.openPage.openTab?.tabKey === tabKey) return;
    this.closeOpenTab(now);
    this.openPage.openTab = {
      tabKey,
      label,
      startedAt: now,
      accruedMs: 0,
    };
  }

  private closeOpenTab(now: number): void {
    const page = this.openPage;
    if (!page?.openTab) return;
    this.accrueOpenTab(now);
    const tab = page.openTab;
    const durationMs = tab.accruedMs;
    page.openTab = null;
    if (durationMs < MIN_SEGMENT_MS) return;
    page.tabs.push({
      tabKey: tab.tabKey,
      label: tab.label,
      durationMs,
    });
  }

  private closeOpenPage(now: number): void {
    if (!this.openPage) return;
    this.accrueOpenPage(now);
    this.closeOpenTab(now);
    const page = this.openPage;
    this.openPage = null;
    if (page.accruedMs < MIN_SEGMENT_MS && page.tabs.length === 0) return;
    // If page itself was short but has qualifying tabs, keep with tab sum
    const durationMs = Math.max(
      page.accruedMs,
      page.tabs.reduce((n, t) => n + t.durationMs, 0)
    );
    if (durationMs < MIN_SEGMENT_MS && page.tabs.length === 0) return;
    this.closedBlocks.push({
      key: page.groupKey,
      title: page.title,
      durationMs,
      tabs: page.tabs,
      filterNote: page.filterNote,
    });
  }

  private accrueActive(now: number): void {
    if (this.lastTickAt == null) {
      this.lastTickAt = now;
      return;
    }
    if (this.visible && this.sessionStartedAt != null) {
      const delta = Math.max(0, now - this.lastTickAt);
      this.activeDurationMs += delta;
      if (this.openPage) {
        this.openPage.accruedMs += delta;
        if (this.openPage.openTab) {
          this.openPage.openTab.accruedMs += delta;
        }
      }
    }
    this.lastTickAt = now;
  }

  private accrueOpenPage(now: number): void {
    this.accrueActive(now);
  }

  private accrueOpenTab(now: number): void {
    this.accrueActive(now);
  }

  private checkIdleOrMidnight(now: number): SessionFlush | null {
    this.accrueActive(now);
    if (this.sessionStartedAt == null) return null;

    if (
      this.hiddenSince != null &&
      now - this.hiddenSince >= IDLE_END_MS
    ) {
      return this.endSession(now);
    }

    if (
      this.sessionStartedAt != null &&
      isDifferentSgtDay(new Date(this.sessionStartedAt), new Date(now))
    ) {
      return this.endSession(now);
    }

    return null;
  }

  private endSession(now: number): SessionFlush | null {
    if (this.sessionStartedAt == null) return null;
    this.closeOpenPage(now);
    const blocks = this.closedBlocks;
    const startedAt = new Date(this.sessionStartedAt);
    const activeDurationMs = this.activeDurationMs;
    const clientSessionId = this.clientSessionId;

    // Reset for next session (3b — new session after idle end)
    this.clientSessionId = newSessionId();
    this.sessionStartedAt = null;
    this.activeDurationMs = 0;
    this.closedBlocks = [];
    this.openPage = null;
    this.hiddenSince = null;
    this.lastTickAt = now;

    if (activeDurationMs < MIN_SESSION_ACTIVE_MS || blocks.length === 0) {
      return null;
    }

    return {
      clientSessionId,
      startedAt,
      activeDurationMs,
      blocks,
    };
  }
}
