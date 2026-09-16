import { useAuthCapabilities } from '../lib/auth/useAuthCapabilities';
import { LoginRequiredPanel } from './LoginRequiredPanel';

/** Admin-only route shell (Stats Entry / Live). */
export function RequireAdmin({ children }: { children: React.ReactNode }) {
  const { canEditLeague, isLoading, isAuthenticated } = useAuthCapabilities();

  if (isLoading) {
    return (
      <div className="py-12 text-center text-sm text-muted-foreground">
        Checking account…
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <LoginRequiredPanel
        title="Admin sign-in required"
        description="Stats entry and live tracking are Admin-only. Sign in with your Admin Google account."
      />
    );
  }

  if (!canEditLeague) {
    return (
      <LoginRequiredPanel
        title="Admin only"
        description="Your account is a User. Stats entry and live tracking are limited to Admins."
      />
    );
  }

  return <>{children}</>;
}
