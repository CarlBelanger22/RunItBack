/** `null` = all tournaments; empty `Set` = none selected; non-empty `Set` = explicit subset. */

import {
  DEFAULT_GAME_FORMAT_SCOPE,
  type GameFormat,
  type GameFormatScope,
} from './gameFormat';

export type TournamentIdSet = Set<string> | null;

export const TOURNAMENT_SELECTION_NONE = '_none';

export function parseTournamentSelection(raw: string | null | undefined): TournamentIdSet {
  if (raw == null || raw === '') return null;
  if (raw === TOURNAMENT_SELECTION_NONE) return new Set();
  return new Set(
    raw
      .split(',')
      .map((part) => part.trim())
      .filter(Boolean)
  );
}

export function serializeTournamentSelection(selection: TournamentIdSet): string | undefined {
  if (selection === null) return undefined;
  if (selection.size === 0) return TOURNAMENT_SELECTION_NONE;
  return [...selection].sort().join(',');
}

export function isAllTournamentsSelected(
  selection: TournamentIdSet,
  availableIds: readonly string[]
): boolean {
  if (selection === null) return true;
  if (availableIds.length === 0) return true;
  return availableIds.every((id) => selection.has(id));
}

export function isNoTournamentsSelected(selection: TournamentIdSet): boolean {
  return selection !== null && selection.size === 0;
}

export function tournamentMatchesSelection(
  tournamentId: string | undefined,
  selection: TournamentIdSet
): boolean {
  if (selection === null) return true;
  if (selection.size === 0) return false;
  if (!tournamentId) return false;
  return selection.has(tournamentId);
}

export function pruneTournamentSelection(
  selection: TournamentIdSet,
  availableIds: readonly string[]
): TournamentIdSet {
  if (selection === null) return selection;
  if (selection.size === 0) return selection;
  const available = new Set(availableIds);
  const pruned = new Set([...selection].filter((id) => available.has(id)));
  if (pruned.size === 0) return new Set();
  if (isAllTournamentsSelected(pruned, availableIds)) return null;
  return pruned;
}

export function tournamentSetsEqual(a: TournamentIdSet, b: TournamentIdSet): boolean {
  if (a === null && b === null) return true;
  if (a === null || b === null) return false;
  if (a.size !== b.size) return false;
  for (const id of a) {
    if (!b.has(id)) return false;
  }
  return true;
}

export interface TournamentSelectOption {
  id: string;
  label: string;
  gameFormat: GameFormat;
}

export function idsForGameFormat(
  options: readonly TournamentSelectOption[],
  format: GameFormat
): string[] {
  return options.filter((option) => option.gameFormat === format).map((option) => option.id);
}

export function explicitSelectionForScope(
  gameFormatScope: GameFormatScope,
  selection: TournamentIdSet,
  options: readonly TournamentSelectOption[]
): Set<string> {
  if (isNoTournamentsSelected(selection)) return new Set();
  if (selection !== null) return new Set(selection);

  if (gameFormatScope === '5v5') return new Set(idsForGameFormat(options, '5v5'));
  if (gameFormatScope === '3x3') return new Set(idsForGameFormat(options, '3x3'));
  return new Set(options.map((option) => option.id));
}

export function inferGameFormatScopeFromSelection(
  selection: Set<string>,
  options: readonly TournamentSelectOption[]
): GameFormatScope {
  if (selection.size === 0) return DEFAULT_GAME_FORMAT_SCOPE;

  let has5v5 = false;
  let has3x3 = false;
  for (const id of selection) {
    const option = options.find((entry) => entry.id === id);
    if (!option) continue;
    if (option.gameFormat === '3x3') has3x3 = true;
    else has5v5 = true;
  }
  if (has5v5 && has3x3) return 'combined';
  if (has3x3) return '3x3';
  return '5v5';
}

export function collapseSelectionForFormatScope(
  format: GameFormatScope,
  selection: Set<string>,
  options: readonly TournamentSelectOption[]
): TournamentIdSet {
  if (selection.size === 0) return new Set();

  const ids5v5 = idsForGameFormat(options, '5v5');
  const ids3x3 = idsForGameFormat(options, '3x3');

  if (format === '5v5') {
    const all5v5Selected =
      ids5v5.length > 0 && ids5v5.every((id) => selection.has(id));
    return all5v5Selected ? null : selection;
  }
  if (format === '3x3') {
    const all3x3Selected =
      ids3x3.length > 0 && ids3x3.every((id) => selection.has(id));
    return all3x3Selected ? null : selection;
  }
  const allSelected =
    options.length > 0 && options.every((option) => selection.has(option.id));
  return allSelected ? null : selection;
}

export function isTournamentCheckedInScope(
  tournamentId: string,
  optionFormat: GameFormat,
  gameFormatScope: GameFormatScope,
  selection: TournamentIdSet,
  options: readonly TournamentSelectOption[]
): boolean {
  if (isNoTournamentsSelected(selection)) return false;

  if (gameFormatScope === '5v5') {
    if (optionFormat !== '5v5') return false;
    if (selection === null) return true;
    return selection.has(tournamentId);
  }

  if (gameFormatScope === '3x3') {
    if (optionFormat !== '3x3') return false;
    if (selection === null) return true;
    return selection.has(tournamentId);
  }

  if (selection === null) return true;
  return selection.has(tournamentId);
}

export function applyTournamentToggle(
  tournamentId: string,
  checked: boolean,
  gameFormatScope: GameFormatScope,
  selection: TournamentIdSet,
  options: readonly TournamentSelectOption[]
): { format: GameFormatScope; selection: TournamentIdSet } {
  if (checked) {
    const explicit = explicitSelectionForScope(gameFormatScope, selection, options);
    explicit.add(tournamentId);
    const format = inferGameFormatScopeFromSelection(explicit, options);
    return {
      format,
      selection: collapseSelectionForFormatScope(format, explicit, options),
    };
  }

  const explicit = explicitSelectionForScope(gameFormatScope, selection, options);
  explicit.delete(tournamentId);

  if (explicit.size === 0) {
    return { format: gameFormatScope, selection: new Set() };
  }

  const format = inferGameFormatScopeFromSelection(explicit, options);
  return {
    format,
    selection: collapseSelectionForFormatScope(format, explicit, options),
  };
}

export function applySelectAllTournaments(): {
  format: GameFormatScope;
  selection: TournamentIdSet;
} {
  return { format: 'combined', selection: null };
}

export function applyClearTournamentSelection(
  gameFormatScope: GameFormatScope
): { format: GameFormatScope; selection: TournamentIdSet } {
  return { format: gameFormatScope, selection: new Set() };
}

export function tournamentSelectionTriggerLabel(
  selection: TournamentIdSet,
  options: TournamentSelectOption[],
  gameFormatScope?: GameFormatScope
): string {
  if (isNoTournamentsSelected(selection)) {
    return 'No tournaments';
  }
  if (gameFormatScope === '5v5' && selection === null) {
    return 'All 5v5 tournaments';
  }
  if (gameFormatScope === '3x3' && selection === null) {
    return 'All 3×3 tournaments';
  }
  if (isAllTournamentsSelected(selection, options.map((o) => o.id))) {
    return 'All tournaments';
  }
  if (selection !== null && selection.size === 1) {
    const id = [...selection][0];
    return options.find((o) => o.id === id)?.label ?? id;
  }
  if (selection !== null) {
    return `${selection.size} tournaments`;
  }
  return 'All tournaments';
}

export function toggleTournamentInSelection(
  selection: TournamentIdSet,
  tournamentId: string,
  checked: boolean,
  availableIds: readonly string[]
): TournamentIdSet {
  if (selection === null) {
    if (!checked) {
      return new Set(availableIds.filter((id) => id !== tournamentId));
    }
    return null;
  }

  const next = new Set(selection);

  if (checked) {
    next.add(tournamentId);
    if (isAllTournamentsSelected(next, availableIds)) {
      return null;
    }
    return next;
  }

  next.delete(tournamentId);
  return next;
}

export function selectAllTournaments(): TournamentIdSet {
  return null;
}

export function clearTournamentSelection(): TournamentIdSet {
  return new Set();
}
