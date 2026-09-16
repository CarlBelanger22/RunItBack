import { useMemo } from 'react';
import {
  resolveAuthCapabilities,
  type AuthCapabilities,
} from './capabilities';
import { useAuth } from './AuthProvider';

export function useAuthCapabilities(): AuthCapabilities & {
  isAuthenticated: boolean;
  isAdmin: boolean;
  isLoading: boolean;
} {
  const { isAuthenticated, isAdmin, isLoading, role } = useAuth();
  const caps = useMemo(
    () => resolveAuthCapabilities({ isAuthenticated, isAdmin, role }),
    [isAuthenticated, isAdmin, role]
  );
  return { ...caps, isAuthenticated, isAdmin, isLoading };
}
