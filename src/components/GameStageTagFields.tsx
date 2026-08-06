import React, { useMemo } from 'react';
import type { Tournament } from '../App';
import {
  normalizeTournamentStructure,
  tournamentHasStructure,
  type TournamentStructure,
} from '../utils/tournamentStructure';
import { Label } from './ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from './ui/select';

const NONE = '__none__';

export interface GameStageTagValues {
  stageId?: string;
  groupId?: string;
}

interface GameStageTagFieldsProps {
  tournament: Tournament | undefined;
  values: GameStageTagValues;
  onChange: (next: GameStageTagValues) => void;
  disabled?: boolean;
}

export function structureForTournament(
  tournament: Tournament | undefined
): TournamentStructure | undefined {
  return normalizeTournamentStructure(tournament?.structure);
}

export function GameStageTagFields({
  tournament,
  values,
  onChange,
  disabled = false,
}: GameStageTagFieldsProps) {
  const structure = structureForTournament(tournament);
  const stages = structure?.stages ?? [];
  const stage = stages.find((s) => s.id === values.stageId);
  const groups = stage?.groups ?? [];
  const needsGroup = stage?.kind === 'round_robin' && groups.length > 0;

  if (!tournamentHasStructure(structure)) return null;

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
      <div className="space-y-2">
        <Label>Stage</Label>
        <Select
          value={values.stageId ?? NONE}
          disabled={disabled}
          onValueChange={(v) => {
            if (v === NONE) {
              onChange({ stageId: undefined, groupId: undefined });
              return;
            }
            const nextStage = stages.find((s) => s.id === v);
            onChange({
              stageId: v,
              groupId:
                nextStage?.kind === 'round_robin' ? values.groupId : undefined,
            });
          }}
        >
          <SelectTrigger>
            <SelectValue placeholder="Select stage" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={NONE}>None</SelectItem>
            {stages.map((s) => (
              <SelectItem key={s.id} value={s.id}>
                {s.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      {needsGroup && (
        <div className="space-y-2">
          <Label>Group</Label>
          <Select
            value={values.groupId ?? NONE}
            disabled={disabled}
            onValueChange={(v) =>
              onChange({
                stageId: values.stageId,
                groupId: v === NONE ? undefined : v,
              })
            }
          >
            <SelectTrigger>
              <SelectValue placeholder="Select group" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={NONE}>None</SelectItem>
              {groups.map((g) => (
                <SelectItem key={g.id} value={g.id}>
                  {g.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}
    </div>
  );
}

export function useStructuredTournament(
  tournaments: Tournament[],
  tournamentId: string | undefined
): Tournament | undefined {
  return useMemo(
    () => tournaments.find((t) => t.id === tournamentId),
    [tournaments, tournamentId]
  );
}
