import React from 'react';
import { Button } from './ui/button';
import { cn } from './ui/utils';

interface StatActionButtonProps {
  label: string;
  onClick: () => void;
  icon?: React.ReactNode;
  shortcut?: string;
  disabled?: boolean;
  active?: boolean;
  className?: string;
  variant?: 'default' | 'destructive' | 'outline' | 'secondary' | 'ghost' | 'link';
  size?: 'default' | 'sm' | 'lg' | 'icon';
}

export function StatActionButton({
  label,
  onClick,
  icon,
  shortcut,
  disabled = false,
  active = false,
  className,
  variant = 'outline',
  size = 'sm',
}: StatActionButtonProps) {
  return (
    <Button
      variant={variant}
      size={size}
      onClick={onClick}
      disabled={disabled}
      title={shortcut ? `Keyboard shortcut: ${shortcut}` : undefined}
      className={cn(
        'relative transition-all duration-200',
        active && 'ring-2 ring-primary bg-primary/10',
        className
      )}
    >
      <div className="flex items-center gap-2">
        {icon && <span className="w-4 h-4">{icon}</span>}
        <span>{label}</span>
      </div>
      {shortcut && (
        <span className="absolute -top-2 -right-1 bg-muted text-[10px] px-1 rounded border shadow-sm pointer-events-none text-muted-foreground opacity-70">
          {shortcut}
        </span>
      )}
    </Button>
  );
}

