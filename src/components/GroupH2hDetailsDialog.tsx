/**
 * LE-106 — Head-to-head details for a tied standings block.
 */
import React from 'react';
import type { Game, Team } from '../App';
import { buildH2hTieExplanation } from '../utils/standingsTiebreak';
import { TeamBadge } from './TeamBadge';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from './ui/dialog';

interface GroupH2hDetailsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  teamIds: string[];
  teams: Team[];
  games: Game[];
  onNavigateToGame?: (gameId: string) => void;
}

export function GroupH2hDetailsDialog({
  open,
  onOpenChange,
  teamIds,
  teams,
  games,
  onNavigateToGame,
}: GroupH2hDetailsDialogProps) {
  const teamsById = new Map(teams.map((t) => [t.id, t]));
  const explanation = buildH2hTieExplanation(teamIds, teamsById, games);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="h2h-dialog">
        <DialogHeader>
          <DialogTitle>Head to head</DialogTitle>
          <DialogDescription>
            These teams share the same win–loss record. Ranking among them uses
            results only in games they played against each other: head-to-head
            wins, then point difference, then points scored.
          </DialogDescription>
        </DialogHeader>

        <div className="h2h-dialog-body">
          <div className="h2h-rank-list" role="table" aria-label="Head to head ranking">
            <div className="h2h-rank-header" role="row">
              <span className="h2h-rank-col-rank">#</span>
              <span className="h2h-rank-col-team">Team</span>
              <span className="h2h-rank-col-stat">W</span>
              <span className="h2h-rank-col-stat">L</span>
              <span className="h2h-rank-col-stat">DIFF</span>
              <span className="h2h-rank-col-stat">PF</span>
              <span className="h2h-rank-col-stat">PA</span>
            </div>
            {explanation.rows.map((row) => (
              <div key={row.teamId} className="h2h-rank-row" role="row">
                <span className="h2h-rank-col-rank">{row.rankAmongTied}</span>
                <span className="h2h-rank-col-team">
                  <TeamBadge team={row.team} teamId={row.team.id} size="xs" />
                  <span className="h2h-rank-name" title={row.team.name}>
                    {row.team.abbreviation}
                  </span>
                </span>
                <span className="h2h-rank-col-stat">{row.wins}</span>
                <span className="h2h-rank-col-stat">{row.losses}</span>
                <span
                  className={
                    row.pointsDiff >= 0
                      ? 'h2h-rank-col-stat text-green-400'
                      : 'h2h-rank-col-stat text-red-400'
                  }
                >
                  {row.pointsDiff >= 0 ? '+' : ''}
                  {row.pointsDiff}
                </span>
                <span className="h2h-rank-col-stat">{row.pointsFor}</span>
                <span className="h2h-rank-col-stat">{row.pointsAgainst}</span>
              </div>
            ))}
          </div>

          <div>
            <p className="text-sm font-medium mb-2">Games among these teams</p>
            {explanation.games.length === 0 ? (
              <p className="text-sm text-muted-foreground">No completed games yet.</p>
            ) : (
              <ul className="h2h-match-list">
                {explanation.games.map((game) => {
                  const home = teamsById.get(game.homeTeamId);
                  const away = teamsById.get(game.awayTeamId);
                  const score = game.finalScore;
                  const dateLabel = new Date(game.date).toLocaleDateString('en-US', {
                    month: 'short',
                    day: 'numeric',
                  });
                  return (
                    <li key={game.id}>
                      <button
                        type="button"
                        className="h2h-match-row"
                        onClick={() => onNavigateToGame?.(game.id)}
                      >
                        <span className="h2h-match-date">{dateLabel}</span>
                        <span className="h2h-match-teams">
                          <span className="h2h-match-side">
                            {home ? (
                              <TeamBadge team={home} teamId={home.id} size="xs" />
                            ) : null}
                            <span className="h2h-match-abbr">
                              {home?.abbreviation ?? '?'}
                            </span>
                            <span className="h2h-match-score">
                              {score?.home ?? '—'}
                            </span>
                          </span>
                          <span className="h2h-match-sep">–</span>
                          <span className="h2h-match-side">
                            <span className="h2h-match-score">
                              {score?.away ?? '—'}
                            </span>
                            <span className="h2h-match-abbr">
                              {away?.abbreviation ?? '?'}
                            </span>
                            {away ? (
                              <TeamBadge team={away} teamId={away.id} size="xs" />
                            ) : null}
                          </span>
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
