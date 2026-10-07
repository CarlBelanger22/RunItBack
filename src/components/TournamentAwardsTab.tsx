/**
 * Admin-only tournament Awards tab: individual awards + All-Teams.
 */
import { HelpCircle } from 'lucide-react';
import type { Game, Team } from '../App';
import type { TournamentRosterEntry } from '../utils/tournamentRosters';
import type { TournamentStructure } from '../utils/tournamentStructure';
import {
  buildTournamentAwardsForGames,
  type AwardContender,
  type TournamentAwardSection,
} from '../utils/tournamentAwards';
import {
  allTeamTierTitle,
  buildAllTournamentTeamsForGames,
  type AllTeamMember,
  type AllTeamTier,
  type AllTournamentTeamsResult,
} from '../utils/tournamentAllTeams';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from './ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';
import { Tooltip, TooltipContent, TooltipTrigger } from './ui/tooltip';

interface TournamentAwardsTabProps {
  tournamentId: string;
  tournamentName: string;
  games: Game[];
  teams: Team[];
  tournamentRosters: TournamentRosterEntry[];
  structure?: TournamentStructure | null;
  onNavigateToPlayer: (playerId: string, teamId?: string) => void;
}

function formatPct(made: number, attempted: number): string {
  if (attempted <= 0) return '—';
  return `${((made / attempted) * 100).toFixed(1)}%`;
}

function formatAvg(total: number, gp: number, digits = 1): string {
  if (gp <= 0) return '—';
  return (total / gp).toFixed(digits);
}

function formatAwardScore(sortValue: number): string {
  if (!Number.isFinite(sortValue)) return '—';
  return sortValue.toFixed(1);
}

function ContenderTable({
  contenders,
  onNavigateToPlayer,
  showAllTeamScore = false,
}: {
  contenders: AwardContender[] | AllTeamMember[];
  onNavigateToPlayer: (playerId: string, teamId?: string) => void;
  showAllTeamScore?: boolean;
}) {
  if (contenders.length === 0) {
    return (
      <p className="text-sm text-muted-foreground px-1 py-2">
        No eligible contenders yet.
      </p>
    );
  }

  return (
    <div className="overflow-x-auto rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-8 text-center">#</TableHead>
            <TableHead>Player</TableHead>
            <TableHead>Team</TableHead>
            <TableHead>Pos</TableHead>
            {showAllTeamScore && (
              <TableHead className="text-center">Seat</TableHead>
            )}
            <TableHead className="text-center">GP</TableHead>
            <TableHead className="text-center">MPG</TableHead>
            <TableHead className="text-center">PPG</TableHead>
            <TableHead className="text-center">RPG</TableHead>
            <TableHead className="text-center">APG</TableHead>
            <TableHead className="text-center">SPG</TableHead>
            <TableHead className="text-center">BPG</TableHead>
            <TableHead className="text-center">FG%</TableHead>
            <TableHead className="text-center">3P%</TableHead>
            <TableHead className="text-center">FT%</TableHead>
            <TableHead className="text-center">ORPG</TableHead>
            <TableHead className="text-center">TOPG</TableHead>
            <TableHead className="text-center">+/−</TableHead>
            <TableHead className="text-center">GmSc</TableHead>
            <TableHead className="text-center">Score</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {contenders.map((c) => {
            const gp = c.gamesPlayed;
            const s = c.totalStats;
            const jersey =
              c.jerseyNumber != null && Number.isFinite(c.jerseyNumber)
                ? String(c.jerseyNumber)
                : '—';
            const member = c as AllTeamMember;
            return (
              <TableRow
                key={c.playerId}
                className="cursor-pointer hover:bg-muted/50"
                onClick={() => onNavigateToPlayer(c.playerId, c.team.id)}
              >
                <TableCell className="text-center font-mono text-muted-foreground">
                  {jersey}
                </TableCell>
                <TableCell className="font-medium">{c.player.name}</TableCell>
                <TableCell>{c.team.abbreviation || c.team.name}</TableCell>
                <TableCell>{c.player.position || '—'}</TableCell>
                {showAllTeamScore && (
                  <TableCell className="text-center font-medium">
                    {member.seat}
                    {member.seat !== member.naturalBucket ? '*' : ''}
                  </TableCell>
                )}
                <TableCell className="text-center">{gp}</TableCell>
                <TableCell className="text-center">
                  {c.mpg != null ? c.mpg.toFixed(1) : '—'}
                </TableCell>
                <TableCell className="text-center">
                  {formatAvg(s.points, gp)}
                </TableCell>
                <TableCell className="text-center">
                  {formatAvg(s.orb + s.drb, gp)}
                </TableCell>
                <TableCell className="text-center">
                  {formatAvg(s.assists, gp)}
                </TableCell>
                <TableCell className="text-center">
                  {formatAvg(s.steals, gp)}
                </TableCell>
                <TableCell className="text-center">
                  {formatAvg(s.blocks, gp)}
                </TableCell>
                <TableCell className="text-center">
                  {formatPct(s.fg_made, s.fg_attempted)}
                </TableCell>
                <TableCell className="text-center">
                  {formatPct(s.three_made, s.three_attempted)}
                </TableCell>
                <TableCell className="text-center">
                  {formatPct(s.ft_made, s.ft_attempted)}
                </TableCell>
                <TableCell className="text-center">
                  {formatAvg(s.orb, gp)}
                </TableCell>
                <TableCell className="text-center">
                  {formatAvg(s.turnovers, gp)}
                </TableCell>
                <TableCell className="text-center">
                  {c.plusMinusPerGame != null
                    ? `${c.plusMinusPerGame >= 0 ? '+' : ''}${c.plusMinusPerGame.toFixed(1)}`
                    : '—'}
                </TableCell>
                <TableCell className="text-center">
                  {c.gmscPerGame.toFixed(1)}
                </TableCell>
                <TableCell className="text-center font-medium">
                  {showAllTeamScore
                    ? member.allTeamScore.toFixed(1)
                    : formatAwardScore(c.sortValue)}
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}

function AwardBlock({
  section,
  onNavigateToPlayer,
}: {
  section: TournamentAwardSection;
  onNavigateToPlayer: (playerId: string, teamId?: string) => void;
}) {
  return (
    <section className="space-y-3">
      <div className="flex items-center gap-2">
        <h3 className="text-lg font-semibold tracking-tight">{section.title}</h3>
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              type="button"
              className="inline-flex text-muted-foreground hover:text-foreground"
              aria-label={`How ${section.title} is determined`}
            >
              <HelpCircle className="h-4 w-4" />
            </button>
          </TooltipTrigger>
          <TooltipContent className="max-w-sm text-sm">
            {section.tooltip}
          </TooltipContent>
        </Tooltip>
      </div>
      <ContenderTable
        contenders={section.contenders}
        onNavigateToPlayer={onNavigateToPlayer}
      />
    </section>
  );
}

function AllTeamBlock({
  tier,
  shortName,
  members,
  tooltip,
  showTooltip,
  onNavigateToPlayer,
}: {
  tier: AllTeamTier;
  shortName: string;
  members: AllTeamMember[];
  tooltip: string;
  showTooltip: boolean;
  onNavigateToPlayer: (playerId: string, teamId?: string) => void;
}) {
  const title = allTeamTierTitle(tier, shortName);
  return (
    <section className="space-y-3">
      <div className="flex items-center gap-2">
        <h3 className="text-lg font-semibold tracking-tight">{title}</h3>
        {showTooltip && (
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                type="button"
                className="inline-flex text-muted-foreground hover:text-foreground"
                aria-label={`How All-${shortName} teams are determined`}
              >
                <HelpCircle className="h-4 w-4" />
              </button>
            </TooltipTrigger>
            <TooltipContent className="max-w-sm text-sm">
              {tooltip}
              {' Seat * = soft-filled from another position.'}
            </TooltipContent>
          </Tooltip>
        )}
      </div>
      <ContenderTable
        contenders={members}
        onNavigateToPlayer={onNavigateToPlayer}
        showAllTeamScore
      />
    </section>
  );
}

function AllTeamsPanel({
  result,
  onNavigateToPlayer,
}: {
  result: AllTournamentTeamsResult;
  onNavigateToPlayer: (playerId: string, teamId?: string) => void;
}) {
  const tiers: { tier: AllTeamTier; members: AllTeamMember[] }[] = [
    { tier: 'first', members: result.first },
    { tier: 'second', members: result.second },
    { tier: 'third', members: result.third },
  ];
  const anyMembers = tiers.some((t) => t.members.length > 0);

  if (!anyMembers) {
    return (
      <p className="text-sm text-muted-foreground">
        No eligible All-{result.shortName} players yet (need completed games and
        ≥60% team GP for majors).
      </p>
    );
  }

  return (
    <div className="space-y-10">
      {tiers.map(({ tier, members }, index) =>
        members.length === 0 ? null : (
          <AllTeamBlock
            key={tier}
            tier={tier}
            shortName={result.shortName}
            members={members}
            tooltip={result.tooltip}
            showTooltip={index === 0}
            onNavigateToPlayer={onNavigateToPlayer}
          />
        )
      )}
      {result.honorableMentions.length > 0 && (
        <section className="space-y-3">
          <div className="flex items-center gap-2">
            <h3 className="text-lg font-semibold tracking-tight">
              Honourable Mentions
            </h3>
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  type="button"
                  className="inline-flex text-muted-foreground hover:text-foreground"
                  aria-label="How honourable mentions are chosen"
                >
                  <HelpCircle className="h-4 w-4" />
                </button>
              </TooltipTrigger>
              <TooltipContent className="max-w-sm text-sm">
                Next {result.honorableMentions.length} eligible players by
                All-Team Score who did not make First, Second, or Third Team
                All-{result.shortName}. Seat shows position bucket (G/F), not an
                All-Team seat.
              </TooltipContent>
            </Tooltip>
          </div>
          <ContenderTable
            contenders={result.honorableMentions}
            onNavigateToPlayer={onNavigateToPlayer}
            showAllTeamScore
          />
        </section>
      )}
    </div>
  );
}

export function TournamentAwardsTab({
  tournamentId,
  tournamentName,
  games,
  teams,
  tournamentRosters,
  structure,
  onNavigateToPlayer,
}: TournamentAwardsTabProps) {
  const sections = buildTournamentAwardsForGames({
    tournamentId,
    games,
    teams,
    tournamentRosters,
    structure,
  });
  const allTeams = buildAllTournamentTeamsForGames({
    tournamentId,
    tournamentName,
    games,
    teams,
    tournamentRosters,
    structure,
  });

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold">Awards contenders</h2>
        <p className="text-sm text-muted-foreground mt-1">
          Admin preview — formulas from completed games only. Not final awards.
        </p>
      </div>

      <Tabs defaultValue="individual">
        <TabsList>
          <TabsTrigger value="individual">Individual</TabsTrigger>
          <TabsTrigger value="all-teams">
            All-{allTeams.shortName}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="individual" className="space-y-10 mt-6">
          {sections.map((section) => (
            <AwardBlock
              key={section.id}
              section={section}
              onNavigateToPlayer={onNavigateToPlayer}
            />
          ))}
        </TabsContent>

        <TabsContent value="all-teams" className="mt-6">
          <AllTeamsPanel
            result={allTeams}
            onNavigateToPlayer={onNavigateToPlayer}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}
