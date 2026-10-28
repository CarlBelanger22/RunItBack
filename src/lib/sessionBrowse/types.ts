/** One dwell segment: a page (and optional nested tab dwells). */
export type SessionTabDwell = {
  tabKey: string;
  label: string;
  durationMs: number;
};

export type SessionPageBlock = {
  /** Stable key for merging consecutive identical locations */
  key: string;
  /** Primary line title, e.g. "REKT League S3" or "Main (Tournaments)" */
  title: string;
  durationMs: number;
  tabs: SessionTabDwell[];
  /** Optional filter footnote under the page (player/team stats scopes) */
  filterNote?: string;
};

export type SessionSummaryInput = {
  displayName: string;
  email: string;
  /** Session wall-clock start (Date or ISO); formatted as SGT in formatter */
  startedAt: Date;
  /** Sum of visible/active time only */
  activeDurationMs: number;
  blocks: SessionPageBlock[];
};

export type ClassifiedLocation = {
  key: string;
  title: string;
  tabKey?: string;
  tabLabel?: string;
  filterNote?: string;
};

export type EntityLookup = {
  tournamentName?: (id: string) => string | undefined;
  teamName?: (id: string) => string | undefined;
  playerName?: (id: string) => string | undefined;
  gameMatchup?: (id: string) => string | undefined;
};
