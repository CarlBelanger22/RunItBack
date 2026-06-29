import React, { useEffect, useState } from 'react';
import { Monitor } from 'lucide-react';

const MIN_WIDTH = 1280;

interface DesktopOnlyGuardProps {
  children: React.ReactNode;
}

export function DesktopOnlyGuard({ children }: DesktopOnlyGuardProps) {
  const [wideEnough, setWideEnough] = useState(
    typeof window !== 'undefined' ? window.innerWidth >= MIN_WIDTH : true
  );

  useEffect(() => {
    const onResize = () => setWideEnough(window.innerWidth >= MIN_WIDTH);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  if (!wideEnough) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4 p-8 text-center bg-background">
        <Monitor className="w-12 h-12 text-muted-foreground" />
        <h1 className="text-xl font-semibold">Desktop required</h1>
        <p className="text-muted-foreground max-w-md">
          Live stats entry needs a screen at least {MIN_WIDTH}px wide. Widen your
          browser window or use a desktop device.
        </p>
      </div>
    );
  }

  return <>{children}</>;
}
