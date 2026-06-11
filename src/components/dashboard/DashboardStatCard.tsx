import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { ChevronRight } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

interface DashboardStatCardProps {
  icon: LucideIcon;
  title: string;
  count: number;
  countLabel: string;
  subLabel?: string;
  onClick: () => void;
  children?: React.ReactNode;
}

export function DashboardStatCard({
  icon: Icon,
  title,
  count,
  countLabel,
  subLabel,
  onClick,
  children,
}: DashboardStatCardProps) {
  return (
    <Card
      className="shadow-md rounded-2xl cursor-pointer hover:shadow-lg transition-shadow h-full"
      onClick={onClick}
    >
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-base font-semibold">
            <Icon className="h-5 w-5 text-primary" />
            {title}
          </CardTitle>
          <ChevronRight className="h-4 w-4 text-muted-foreground" />
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <div className="text-3xl font-bold text-primary">{count}</div>
          <p className="text-sm text-muted-foreground">{countLabel}</p>
          {subLabel ? (
            <p className="text-xs text-muted-foreground/80 pt-0.5">{subLabel}</p>
          ) : null}
        </div>
        {children ? <div className="min-h-[8.25rem]">{children}</div> : null}
      </CardContent>
    </Card>
  );
}
