import { Link } from 'react-router-dom';
import { ArrowLeft, LogIn, LogOut, UserRound } from 'lucide-react';
import { Button } from './ui/button';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Badge } from './ui/badge';
import { getUserDisplayName, useAuth } from '../lib/auth/AuthProvider';
import { isSupabaseConfigured } from '../lib/supabase';
import { paths } from '../routing/paths';
import { useState } from 'react';

function roleLabel(role: string | null): string {
  if (role === 'admin') return 'Admin';
  if (role === 'user') return 'User';
  return 'Signed out';
}

/** Simple account page — Google name, email, role, sign out. */
export function AccountPage() {
  const { isLoading, isAuthenticated, user, role, signInWithGoogle, signOut } =
    useAuth();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const displayName = getUserDisplayName(user);
  const email = user?.email ?? '';
  const avatarUrl =
    typeof user?.user_metadata?.avatar_url === 'string'
      ? user.user_metadata.avatar_url
      : typeof user?.user_metadata?.picture === 'string'
        ? user.user_metadata.picture
        : null;

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
    <div className="container mx-auto px-6 py-8 max-w-lg space-y-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="sm" asChild>
          <Link to={paths.home}>
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back
          </Link>
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-xl">Account</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {!isSupabaseConfigured ? (
            <p className="text-sm text-muted-foreground">
              Cloud auth is not configured for this build.
            </p>
          ) : isLoading ? (
            <p className="text-sm text-muted-foreground">Loading account…</p>
          ) : isAuthenticated ? (
            <>
              <div className="flex items-start gap-4">
                {avatarUrl ? (
                  <img
                    src={avatarUrl}
                    alt={
                      displayName
                        ? `${displayName} profile photo`
                        : 'Profile photo'
                    }
                    className="w-14 h-14 rounded-full object-cover border"
                    referrerPolicy="no-referrer"
                  />
                ) : (
                  <div className="w-14 h-14 rounded-full bg-muted flex items-center justify-center">
                    <UserRound className="w-7 h-7 text-muted-foreground" />
                  </div>
                )}
                <div className="min-w-0 space-y-1">
                  <div className="font-medium text-lg truncate">
                    {displayName || 'Signed in'}
                  </div>
                  {email ? (
                    <div className="text-sm text-muted-foreground truncate">
                      {email}
                    </div>
                  ) : null}
                  <Badge variant={role === 'admin' ? 'default' : 'secondary'}>
                    {roleLabel(role)}
                  </Badge>
                </div>
              </div>

              <p className="text-sm text-muted-foreground">
                Signed in with Google. Password changes are managed in your Google
                account.
              </p>

              <Button
                variant="outline"
                disabled={busy}
                onClick={() => void handleSignOut()}
              >
                <LogOut className="w-4 h-4 mr-2" />
                Sign out
              </Button>
            </>
          ) : (
            <>
              <p className="text-sm text-muted-foreground">
                Sign in with Google to view detailed stats. New accounts are Users;
                editing and stats entry require Admin.
              </p>
              <Button disabled={busy} onClick={() => void handleSignIn()}>
                <LogIn className="w-4 h-4 mr-2" />
                Sign in with Google
              </Button>
            </>
          )}

          {error ? (
            <p className="text-sm text-destructive">{error}</p>
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}
