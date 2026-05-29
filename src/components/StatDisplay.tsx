import React from 'react';
import { Badge } from './ui/badge';
import { TableCell, TableHead } from './ui/table';
import { Tooltip, TooltipContent, TooltipTrigger } from './ui/tooltip';
import { cn } from './ui/utils';

export const NO_STAT_RECORDED_MESSAGE = 'No stat recorded';

export function NoStatRecorded({ className }: { className?: string }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span className={cn('text-muted-foreground cursor-default', className)}>-</span>
      </TooltipTrigger>
      <TooltipContent>{NO_STAT_RECORDED_MESSAGE}</TooltipContent>
    </Tooltip>
  );
}

export function StatTooltipHead({
  label,
  tooltip,
  className,
}: {
  label: string;
  tooltip: string;
  className?: string;
}) {
  return (
    <TableHead className={className}>
      <Tooltip>
        <TooltipTrigger asChild>
          <span className="cursor-default">{label}</span>
        </TooltipTrigger>
        <TooltipContent>{tooltip}</TooltipContent>
      </Tooltip>
    </TableHead>
  );
}

export function OptionalStatTableCell({
  value,
  className,
}: {
  value: number | null;
  className?: string;
}) {
  return (
    <TableCell className={cn('text-center font-mono', className)}>
      {value !== null ? value : <NoStatRecorded />}
    </TableCell>
  );
}

export function OptionalStatBadge({ value }: { value: number | null }) {
  if (value !== null) {
    return <Badge variant="outline">{value}</Badge>;
  }
  return (
    <Badge variant="outline" className="font-normal text-muted-foreground">
      <NoStatRecorded />
    </Badge>
  );
}

export function OptionalStatText({
  value,
  suffix = '',
  decimals,
  className,
}: {
  value: number | null;
  suffix?: string;
  decimals?: number;
  className?: string;
}) {
  if (value === null) {
    return <NoStatRecorded className={className} />;
  }
  const formatted =
    decimals !== undefined ? value.toFixed(decimals) : String(value);
  return <span className={className}>{`${formatted}${suffix}`}</span>;
}
