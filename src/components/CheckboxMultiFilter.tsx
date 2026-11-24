import React, { useMemo } from 'react';
import { ChevronsUpDown } from 'lucide-react';
import { Button } from './ui/button';
import { Checkbox } from './ui/checkbox';
import { Label } from './ui/label';
import { Popover, PopoverContent, PopoverTrigger } from './ui/popover';
import { cn } from './ui/utils';
import { toggleIdInSet } from '../utils/filterPlayerSeasonRows';

export type CheckboxMultiFilterOption = {
  id: string;
  label: string;
};

interface CheckboxMultiFilterProps {
  options: CheckboxMultiFilterOption[];
  value: ReadonlySet<string>;
  onChange: (next: Set<string>) => void;
  allLabel: string;
  emptyLabel?: string;
  id?: string;
  className?: string;
}

function triggerLabel(
  value: ReadonlySet<string>,
  options: CheckboxMultiFilterOption[],
  allLabel: string
): string {
  if (value.size === 0) return allLabel;
  if (value.size === 1) {
    const id = [...value][0];
    return options.find((o) => o.id === id)?.label ?? id;
  }
  if (value.size === options.length && options.length > 0) return allLabel;
  return `${value.size} selected`;
}

export function CheckboxMultiFilter({
  options,
  value,
  onChange,
  allLabel,
  emptyLabel = 'No options',
  id = 'checkbox-multi-filter',
  className,
}: CheckboxMultiFilterProps) {
  const label = useMemo(
    () => triggerLabel(value, options, allLabel),
    [value, options, allLabel]
  );

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          id={id}
          type="button"
          variant="outline"
          role="combobox"
          className={cn(
            'h-9 w-full min-w-[10rem] max-w-full justify-between bg-background font-normal shadow-sm',
            className
          )}
        >
          <span className="truncate">{label}</span>
          <ChevronsUpDown className="ml-2 size-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[min(100vw-2rem,18rem)] p-0" align="end">
        <div className="flex items-center justify-between border-b px-3 py-2">
          <button
            type="button"
            className="text-xs font-medium text-primary hover:underline"
            onClick={() => onChange(new Set(options.map((o) => o.id)))}
          >
            Select all
          </button>
          <button
            type="button"
            className="text-xs font-medium text-muted-foreground hover:underline"
            onClick={() => onChange(new Set())}
          >
            Clear
          </button>
        </div>
        <div className="max-h-64 overflow-y-auto p-2">
          {options.length === 0 ? (
            <p className="px-2 py-3 text-sm text-muted-foreground">{emptyLabel}</p>
          ) : (
            options.map((option) => {
              const itemId = `${id}-${option.id}`;
              const checked = value.has(option.id);
              return (
                <div
                  key={option.id}
                  className="flex items-center gap-2 rounded-md px-2 py-1.5 hover:bg-muted/50"
                >
                  <Checkbox
                    id={itemId}
                    checked={checked}
                    onCheckedChange={(next) =>
                      onChange(toggleIdInSet(value, option.id, next === true))
                    }
                  />
                  <Label
                    htmlFor={itemId}
                    className="cursor-pointer text-sm font-normal"
                  >
                    {option.label}
                  </Label>
                </div>
              );
            })
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
