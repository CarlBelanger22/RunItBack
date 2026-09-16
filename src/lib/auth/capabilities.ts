import type { AppAuthRole } from './authTypes';

export interface AuthCapabilities {
  /** Signed in (User or Admin). */
  canViewDetailedStats: boolean;
  /** Admin only — mutate league data, stats entry, live. */
  canEditLeague: boolean;
  /** Admin only — PDF / file exports. */
  canExport: boolean;
  /** Anonymous Game Log capped; signed-in users see full. */
  publicGameLogLimit: number | null;
}

export function resolveAuthCapabilities(input: {
  isAuthenticated: boolean;
  isAdmin: boolean;
  role?: AppAuthRole;
}): AuthCapabilities {
  const { isAuthenticated, isAdmin } = input;
  return {
    canViewDetailedStats: isAuthenticated,
    canEditLeague: isAdmin,
    canExport: isAdmin,
    publicGameLogLimit: isAuthenticated ? null : 5,
  };
}
