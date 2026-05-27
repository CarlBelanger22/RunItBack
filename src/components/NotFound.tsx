import { Link } from 'react-router-dom';
import { Button } from './ui/button';
import { paths } from '../routing/paths';

export function NotFound() {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center space-y-4">
      <h2 className="text-xl font-semibold">Page not found</h2>
      <p className="text-muted-foreground max-w-md">
        This link may be outdated or the item was removed. Head back to the dashboard to continue.
      </p>
      <Button asChild>
        <Link to={paths.home}>Go to dashboard</Link>
      </Button>
    </div>
  );
}
