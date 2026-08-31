import React, { useMemo, useState } from 'react';
import { Check, ChevronsUpDown } from 'lucide-react';
import { Button } from '../ui/button';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '../ui/command';
import { Popover, PopoverContent, PopoverTrigger } from '../ui/popover';
import { cn } from '../ui/utils';

/** ~5 team rows visible; list scrolls if search returns more. */
const VISIBLE_TEAM_ROWS = 5;
const LIST_MAX_HEIGHT = 'max-h-[10.5rem]';

export interface TeamSelectOption {
  id: string;
  label: string;
  /** Extra text matched by search (e.g. abbreviation). */
  searchTerms?: string;
}

interface SearchableTeamSelectProps {
  value: string;
  onValueChange: (value: string) => void;
  options: TeamSelectOption[];
  placeholder?: string;
  searchPlaceholder?: string;
  emptyMessage?: string;
  createNewValue?: string;
  createNewLabel?: string;
  id?: string;
  disabled?: boolean;
  /** Teams shown before the user types a search query. */
  previewCount?: number;
}

function matchesQuery(option: TeamSelectOption, query: string): boolean {
  const haystack = `${option.label} ${option.searchTerms ?? ''}`.toLowerCase();
  return haystack.includes(query);
}

export function SearchableTeamSelect({
  value,
  onValueChange,
  options,
  placeholder = 'Select a team',
  searchPlaceholder = 'Search teams…',
  emptyMessage = 'No teams found.',
  createNewValue,
  createNewLabel = 'Create new team',
  id,
  disabled = false,
  previewCount = VISIBLE_TEAM_ROWS,
}: SearchableTeamSelectProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');

  const selectedLabel = useMemo(() => {
    if (createNewValue && value === createNewValue) {
      return createNewLabel;
    }
    return options.find((option) => option.id === value)?.label ?? '';
  }, [createNewLabel, createNewValue, options, value]);

  const normalizedQuery = query.trim().toLowerCase();
  const isSearching = normalizedQuery.length > 0;

  const visibleOptions = useMemo(() => {
    if (isSearching) {
      return options.filter((option) => matchesQuery(option, normalizedQuery));
    }
    return options.slice(0, previewCount);
  }, [isSearching, normalizedQuery, options, previewCount]);

  const hiddenTeamCount = !isSearching
    ? Math.max(0, options.length - previewCount)
    : 0;

  const handleOpenChange = (next: boolean) => {
    setOpen(next);
    if (!next) {
      setQuery('');
    }
  };

  return (
    <Popover open={open} onOpenChange={handleOpenChange}>
      <PopoverTrigger asChild>
        <Button
          id={id}
          type="button"
          variant="outline"
          role="combobox"
          aria-expanded={open}
          disabled={disabled}
          className="w-full justify-between font-normal"
        >
          <span className={cn('truncate', !selectedLabel && 'text-muted-foreground')}>
            {selectedLabel || placeholder}
          </span>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent
        className="w-[var(--radix-popover-trigger-width)] p-0"
        align="start"
        side="bottom"
        sideOffset={4}
        avoidCollisions={false}
      >
        <Command shouldFilter={false}>
          <CommandInput
            placeholder={searchPlaceholder}
            value={query}
            onValueChange={setQuery}
          />
          <CommandList className={LIST_MAX_HEIGHT}>
            {visibleOptions.length === 0 ? (
              <CommandEmpty>{emptyMessage}</CommandEmpty>
            ) : (
              <CommandGroup>
                {visibleOptions.map((option) => (
                  <CommandItem
                    key={option.id}
                    value={option.id}
                    onSelect={() => {
                      onValueChange(option.id);
                      setOpen(false);
                      setQuery('');
                    }}
                  >
                    <Check
                      className={cn(
                        'mr-2 h-4 w-4 shrink-0',
                        value === option.id ? 'opacity-100' : 'opacity-0'
                      )}
                    />
                    <span className="truncate">{option.label}</span>
                  </CommandItem>
                ))}
              </CommandGroup>
            )}
          </CommandList>
          {createNewValue ? (
            <div className="border-t">
              <CommandGroup>
                <CommandItem
                  value={createNewValue}
                  onSelect={() => {
                    onValueChange(createNewValue);
                    setOpen(false);
                    setQuery('');
                  }}
                >
                  <Check
                    className={cn(
                      'mr-2 h-4 w-4 shrink-0',
                      value === createNewValue ? 'opacity-100' : 'opacity-0'
                    )}
                  />
                  {createNewLabel}
                </CommandItem>
              </CommandGroup>
            </div>
          ) : null}
          {hiddenTeamCount > 0 ? (
            <p className="border-t px-3 py-2 text-xs text-muted-foreground">
              Showing {previewCount} of {options.length} teams — search to find more
            </p>
          ) : null}
        </Command>
      </PopoverContent>
    </Popover>
  );
}
