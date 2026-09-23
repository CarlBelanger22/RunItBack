import { useState } from 'react';
import { LogIn } from 'lucide-react';
import { Button } from './ui/button';
import { Card, CardContent } from './ui/card';
import { useAuth } from '../lib/auth/AuthProvider';
import { isSupabaseConfigured } from '../lib/supabase';
import { SIGN_IN_AGE_NOTICE } from '../lib/legal/signInAgeNotice';
import { cn } from './ui/utils';

interface LoginRequiredPanelProps {
  title?: string;
  description?: string;
  className?: string;
}

/** Shown when anonymous users hit a gated stats tab/section. */
export function LoginRequiredPanel({
  title = 'Sign in to view',
  description = 'Create a free account with Google to unlock detailed stats.',
  className,
}: LoginRequiredPanelProps) {
  const { signInWithGoogle, isLoading } = useAuth();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSignIn = async () => {
    setError(null);
    setBusy(true);
    try {
      await signInWithGoogle();
      // OAuth navigates away; if it returns without redirect, clear busy.
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Sign-in failed.');
      setBusy(false);
    }
  };

  return (
    <Card className={cn(className)}>
      <CardContent className="flex h-full flex-col items-center justify-center py-12 px-6 text-center space-y-4">
        <h3 className="text-lg font-medium">{title}</h3>
        <p className="text-sm text-muted-foreground max-w-md mx-auto">
          {description}
        </p>
        {!isSupabaseConfigured ? (
          <p className="text-xs text-muted-foreground">
            Cloud auth is not configured.
          </p>
        ) : (
          <>
            <Button
              type="button"
              disabled={busy || isLoading}
              onClick={() => {
                void handleSignIn();
              }}
            >
              <LogIn className="w-4 h-4 mr-2" />
              {busy ? 'Signing in…' : 'Sign in with Google'}
            </Button>
            <p className="text-xs text-muted-foreground max-w-md mx-auto">
              {SIGN_IN_AGE_NOTICE}
            </p>
          </>
        )}
        {error ? (
          <p className="text-xs text-destructive max-w-md mx-auto whitespace-normal">
            {error}
          </p>
        ) : null}
      </CardContent>
    </Card>
  );
}
