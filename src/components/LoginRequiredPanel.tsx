import { Link } from 'react-router-dom';
import { LogIn } from 'lucide-react';
import { Button } from './ui/button';
import { Card, CardContent } from './ui/card';
import { paths } from '../routing/paths';
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
  return (
    <Card className={cn(className)}>
      <CardContent className="flex h-full flex-col items-center justify-center py-12 px-6 text-center space-y-4">
        <h3 className="text-lg font-medium">{title}</h3>
        <p className="text-sm text-muted-foreground max-w-md mx-auto">
          {description}
        </p>
        <Button asChild>
          <Link to={paths.account}>
            <LogIn className="w-4 h-4 mr-2" />
            Sign in with Google
          </Link>
        </Button>
      </CardContent>
    </Card>
  );
}
