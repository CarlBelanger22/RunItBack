import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { LogIn, LogOut, Flag, FileText, Settings, Shield, UserRound } from 'lucide-react';
import { Button } from './ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from './ui/dropdown-menu';
import { getUserDisplayName, useAuth } from '../lib/auth/AuthProvider';
import { isSupabaseConfigured } from '../lib/supabase';
import { paths } from '../routing/paths';

/** Header Settings gear — Account, Sign in with Google, Sign out. */
export function AccountMenu() {
  const navigate = useNavigate();
  const { isLoading, isAuthenticated, user, role, signInWithGoogle, signOut } =
    useAuth();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const displayName = getUserDisplayName(user);
  const email = user?.email ?? '';

  const handleSignIn = async () => {
    setError(null);
    setBusy(true);
    try {
      await signInWithGoogle();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Sign-in failed.');
      setBusy(false);
    }
  };

  const handleSignOut = async () => {
    setError(null);
    setBusy(true);
    try {
      await signOut();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Sign-out failed.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className="rounded-full w-9 h-9 p-0"
          aria-label="Account menu"
          disabled={isLoading}
        >
          <Settings className="w-4 h-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-64">
        {!isSupabaseConfigured ? (
          <DropdownMenuLabel className="text-xs font-normal text-muted-foreground">
            Cloud auth is not configured.
          </DropdownMenuLabel>
        ) : isAuthenticated ? (
          <>
            <DropdownMenuLabel className="space-y-1 font-normal">
              <div className="flex items-center gap-2 text-sm font-medium">
                <UserRound className="w-4 h-4 shrink-0" />
                <span className="truncate">{displayName || 'Signed in'}</span>
              </div>
              {email ? (
                <div className="truncate text-xs text-muted-foreground pl-6">
                  {email}
                </div>
              ) : null}
              <div className="pl-6 text-xs text-muted-foreground capitalize">
                Role: {role ?? 'user'}
              </div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onSelect={() => {
                navigate(paths.account);
              }}
            >
              <UserRound className="w-4 h-4 mr-2" />
              Account
            </DropdownMenuItem>
            <DropdownMenuItem
              onSelect={() => {
                navigate(paths.contentRemoval);
              }}
            >
              <Flag className="w-4 h-4 mr-2" />
              Report content
            </DropdownMenuItem>
            <DropdownMenuItem
              onSelect={() => {
                navigate(paths.privacy);
              }}
            >
              <Shield className="w-4 h-4 mr-2" />
              Privacy Policy
            </DropdownMenuItem>
            <DropdownMenuItem
              onSelect={() => {
                navigate(paths.terms);
              }}
            >
              <FileText className="w-4 h-4 mr-2" />
              Terms of Use
            </DropdownMenuItem>
            <DropdownMenuItem
              disabled={busy}
              onSelect={(e) => {
                e.preventDefault();
                void handleSignOut();
              }}
            >
              <LogOut className="w-4 h-4 mr-2" />
              Sign out
            </DropdownMenuItem>
          </>
        ) : (
          <>
            <DropdownMenuLabel className="text-xs font-normal text-muted-foreground">
              Sign in to view detailed stats.
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onSelect={() => {
                navigate(paths.account);
              }}
            >
              <UserRound className="w-4 h-4 mr-2" />
              Account
            </DropdownMenuItem>
            <DropdownMenuItem
              onSelect={() => {
                navigate(paths.contentRemoval);
              }}
            >
              <Flag className="w-4 h-4 mr-2" />
              Report content
            </DropdownMenuItem>
            <DropdownMenuItem
              onSelect={() => {
                navigate(paths.privacy);
              }}
            >
              <Shield className="w-4 h-4 mr-2" />
              Privacy Policy
            </DropdownMenuItem>
            <DropdownMenuItem
              onSelect={() => {
                navigate(paths.terms);
              }}
            >
              <FileText className="w-4 h-4 mr-2" />
              Terms of Use
            </DropdownMenuItem>
            <DropdownMenuItem
              disabled={busy}
              onSelect={(e) => {
                e.preventDefault();
                void handleSignIn();
              }}
            >
              <LogIn className="w-4 h-4 mr-2" />
              Sign in with Google
            </DropdownMenuItem>
          </>
        )}
        {error ? (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuLabel className="text-xs font-normal text-destructive whitespace-normal">
              {error}
            </DropdownMenuLabel>
          </>
        ) : null}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
