/**
 * Admin-only tournament Awards tab: individual + All-Teams + All-Defensive.
 */
import { useState } from 'react';
import { ChevronDown, ChevronUp, HelpCircle } from 'lucide-react';
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
  allDefensiveTierTitle,
  buildAllDefensiveTeamsForGames,
  type AllDefensiveTeamsResult,
  type AllDefensiveTier,
} from '../utils/tournamentAllDefensive';
import { formatDecimalMinutes } from '../utils/formatMinutes';
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

function formatBoxPct(made: number, attempted: number): string {
  if (attempted <= 0) return '—';
  return `${((made / attempted) * 100).toFixed(1)}%`;
}

function formatFraction(made: number, attempted: number): string {
  return `${Math.round(made)}/${Math.round(attempted)}`;
}

function formatInt(n: number): string {
  if (!Number.isFinite(n)) return '—';
  return String(Math.round(n));
}

function formatAvg(total: number, gp: number, digits = 1): string {
  if (gp <= 0) return '—';
  return (total / gp).toFixed(digits);
}

function formatAwardScore(sortValue: number): string {
  if (!Number.isFinite(sortValue)) return '—';
  return sortValue.toFixed(1);
}

function formatAstTo(assists: number, turnovers: number): string {
  if (turnovers <= 0) {
    if (assists <= 0) return '—';
    return '∞';
  }
  return (assists / turnovers).toFixed(2);
}

function formatPlusMinusInt(value: number | null): string {
  if (value == null || !Number.isFinite(value)) return '—';
  const n = Math.round(value);
  return `${n >= 0 ? '+' : ''}${n}`;
}

/** Thin chevron row under an award table: expand / collapse extra ranks. */
function AwardExpandToggle({
  expanded,
  onToggle,
  expandLabel,
  collapseLabel,
}: {
  expanded: boolean;
  onToggle: () => void;
  expandLabel: string;
  collapseLabel: string;
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-expanded={expanded}
      aria-label={expanded ? collapseLabel : expandLabel}
      className="flex w-full items-center justify-center py-1 text-muted-foreground hover:bg-muted/50 hover:text-foreground transition-colors"
    >
      {expanded ? (
        <ChevronUp className="h-3.5 w-3.5" aria-hidden />
      ) : (
        <ChevronDown className="h-3.5 w-3.5" aria-hidden />
      )}
    </button>
  );
}

/** Single-game Finals MVP: box-score totals (not per-game averages). */
function FinalsMvpBoxTable({
  contenders,
  onNavigateToPlayer,
}: {
  contenders: AwardContender[];
  onNavigateToPlayer: (playerId: string, teamId?: string) => void;
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
          <TableRow className="text-xs">
            <TableHead className="w-8 text-center">#</TableHead>
            <TableHead>Player</TableHead>
            <TableHead>Team</TableHead>
            <TableHead className="text-center">MIN</TableHead>
            <TableHead className="text-center">PTS</TableHead>
            <TableHead className="text-center">REB</TableHead>
            <TableHead className="text-center">AST</TableHead>
            <TableHead className="text-center">STL</TableHead>
            <TableHead className="text-center">BLK</TableHead>
            <TableHead className="text-center">FG</TableHead>
            <TableHead className="text-center">FG%</TableHead>
            <TableHead className="text-center">3P</TableHead>
            <TableHead className="text-center">3P%</TableHead>
            <TableHead className="text-center">ORB</TableHead>
            <TableHead className="text-center">TO</TableHead>
            <TableHead className="text-center">+/−</TableHead>
            <TableHead className="text-center">GmSc</TableHead>
            <TableHead className="text-center">Score</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {contenders.map((c) => {
            const s = c.totalStats;
            const jersey =
              c.jerseyNumber != null && Number.isFinite(c.jerseyNumber)
                ? String(c.jerseyNumber)
                : '—';
            return (
              <TableRow
                key={c.playerId}
                className="cursor-pointer hover:bg-muted/50 text-sm"
                onClick={() => onNavigateToPlayer(c.playerId, c.team.id)}
              >
                <TableCell className="text-center font-mono text-muted-foreground">
                  {jersey}
                </TableCell>
                <TableCell className="font-medium">{c.player.name}</TableCell>
                <TableCell>{c.team.abbreviation || c.team.name}</TableCell>
                <TableCell className="text-center font-mono">
                  {formatDecimalMinutes(s.minutes_played)}
                </TableCell>
                <TableCell className="text-center font-mono font-medium">
                  {formatInt(s.points)}
                </TableCell>
                <TableCell className="text-center font-mono font-medium">
                  {formatInt(s.orb + s.drb)}
                </TableCell>
                <TableCell className="text-center font-mono">
                  {formatInt(s.assists)}
                </TableCell>
                <TableCell className="text-center font-mono">
                  {formatInt(s.steals)}
                </TableCell>
                <TableCell className="text-center font-mono">
                  {formatInt(s.blocks)}
                </TableCell>
                <TableCell className="text-center font-mono">
                  {formatFraction(s.fg_made, s.fg_attempted)}
                </TableCell>
                <TableCell className="text-center font-mono">
                  {formatBoxPct(s.fg_made, s.fg_attempted)}
                </TableCell>
                <TableCell className="text-center font-mono">
                  {formatFraction(s.three_made, s.three_attempted)}
                </TableCell>
                <TableCell className="text-center font-mono">
                  {formatBoxPct(s.three_made, s.three_attempted)}
                </TableCell>
                <TableCell className="text-center font-mono">
                  {formatInt(s.orb)}
                </TableCell>
                <TableCell className="text-center font-mono">
                  {formatInt(s.turnovers)}
                </TableCell>
                <TableCell className="text-center font-mono">
                  {formatPlusMinusInt(c.plusMinusPerGame)}
                </TableCell>
                <TableCell className="text-center font-mono">
                  {c.gmscPerGame.toFixed(1)}
                </TableCell>
                <TableCell className="text-center font-mono font-medium">
                  {formatAwardScore(c.sortValue)}
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}

function ContenderTable({
  contenders,
  onNavigateToPlayer,
  showAllTeamScore = false,
  showAstTo = false,
}: {
  contenders: AwardContender[] | AllTeamMember[];
  onNavigateToPlayer: (playerId: string, teamId?: string) => void;
  showAllTeamScore?: boolean;
  /** Playmaker: show AST/TO ratio instead of ORPG. */
  showAstTo?: boolean;
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
            <TableHead className="text-center">
              {showAstTo ? 'AST/TO' : 'ORPG'}
            </TableHead>
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
                  {showAstTo
                    ? formatAstTo(s.assists, s.turnovers)
                    : formatAvg(s.orb, gp)}
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
                    ? (c as AllTeamMember).allTeamScore.toFixed(1)
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
  const isFmvp = section.id === 'finals_mvp';
  const collapsedN = isFmvp ? 3 : 5;
  const expandedN = isFmvp ? 5 : 10;
  const [expanded, setExpanded] = useState(false);
  const visible = section.contenders.slice(
    0,
    expanded ? expandedN : collapsedN
  );
  const canExpand = section.contenders.length > collapsedN;

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
      <div>
        {isFmvp ? (
          <FinalsMvpBoxTable
            contenders={visible}
            onNavigateToPlayer={onNavigateToPlayer}
          />
        ) : (
          <ContenderTable
            contenders={visible}
            onNavigateToPlayer={onNavigateToPlayer}
            showAstTo={section.id === 'playmaker'}
          />
        )}
        {canExpand && (
          <AwardExpandToggle
            expanded={expanded}
            onToggle={() => setExpanded((v) => !v)}
            expandLabel={
              isFmvp ? 'Show top 5 Finals MVP' : `Show top ${expandedN}`
            }
            collapseLabel={
              isFmvp ? 'Show top 3 Finals MVP' : `Show top ${collapsedN}`
            }
          />
        )}
      </div>
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
        ≥55% team GP for majors).
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
                All-Team Score who did not make All-{result.shortName} 1st,
                2nd, or 3rd Team.
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

function AllDefensiveBlock({
  tier,
  members,
  tooltip,
  showTooltip,
  onNavigateToPlayer,
}: {
  tier: AllDefensiveTier;
  members: AllTeamMember[];
  tooltip: string;
  showTooltip: boolean;
  onNavigateToPlayer: (playerId: string, teamId?: string) => void;
}) {
  const title = allDefensiveTierTitle(tier);
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
                aria-label="How All-Defensive teams are determined"
              >
                <HelpCircle className="h-4 w-4" />
              </button>
            </TooltipTrigger>
            <TooltipContent className="max-w-sm text-sm">
              {tooltip}
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

function AllDefensivePanel({
  result,
  onNavigateToPlayer,
}: {
  result: AllDefensiveTeamsResult;
  onNavigateToPlayer: (playerId: string, teamId?: string) => void;
}) {
  const tiers: { tier: AllDefensiveTier; members: AllTeamMember[] }[] = [
    { tier: 'first', members: result.first },
    { tier: 'second', members: result.second },
  ];
  const anyMembers = tiers.some((t) => t.members.length > 0);

  if (!anyMembers) {
    return (
      <p className="text-sm text-muted-foreground">
        No eligible All-Defensive players yet (need completed games and ≥55%
        team GP for majors).
      </p>
    );
  }

  return (
    <div className="space-y-10">
      {tiers.map(({ tier, members }, index) =>
        members.length === 0 ? null : (
          <AllDefensiveBlock
            key={tier}
            tier={tier}
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
                  aria-label="How All-Defensive honourable mentions are chosen"
                >
                  <HelpCircle className="h-4 w-4" />
                </button>
              </TooltipTrigger>
              <TooltipContent className="max-w-sm text-sm">
                Next {result.honorableMentions.length} eligible players by
                All-Defensive Score who did not make 1st or 2nd Team.
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
  const allDefensive = buildAllDefensiveTeamsForGames({
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
          <TabsTrigger value="all-defensive">All-Defensive</TabsTrigger>
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

        <TabsContent value="all-defensive" className="mt-6">
          <AllDefensivePanel
            result={allDefensive}
            onNavigateToPlayer={onNavigateToPlayer}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}
