import React, { useRef, useCallback, useMemo, useState, useEffect } from 'react';
import {
  FigmaHorizontalCourtSvg,
  fitHorizontalCourtDimensions,
  LIVE_HORIZONTAL_COURT_COLORS,
  type HorizontalCourtMarker,
} from '../../lib/figmaHorizontalCourtSvg';
import {
  homeAttacksLeft,
  horizontalClickToHalfCourtPoint,
  halfCourtPointToHorizontalSvg,
  resolveTipOffFlipped,
  resolveShotMarkerAttacksLeft,
  liveCourtNeedsHalfRotate,
  invertClientPointAroundRectCenter,
} from '../../lib/horizontalCourtClick';
import { percentToCourtPointM, type CourtPointM } from '../../lib/fibaCourtGeometry';
import type { CourtMarker as SessionMarker } from '../../liveEntry/liveEntryStateMachine';
import type { Game, Shot } from '../../App';
import { cn } from '../ui/utils';
import { isOpponentUnitShotPlayerId } from '../../liveEntry/opponentUnit';
import { teamIdForPlayer } from '../../liveEntry/reboundTeams';

interface HorizontalFullCourtCanvasProps {
  game: Game;
  homeTeamId: string;
  offenseTeamId: string;
  onPointClick: (point: CourtPointM) => void;
  sessionMarkers?: SessionMarker[];
  shots?: Shot[];
  interactive?: boolean;
  shotMode?: boolean;
  className?: string;
  children?: React.ReactNode;
}

function tipOffFlippedFromGame(game: Game): boolean {
  return resolveTipOffFlipped({
    courtSidesFlipped: game.courtSidesFlipped,
    courtSidesFlippedAtTip: game.courtSidesFlippedAtTip,
  });
}

function shootingTeamIdForShot(shot: Shot, game: Game): string {
  if (isOpponentUnitShotPlayerId(shot.playerId)) return game.awayTeamId;
  return (
    teamIdForPlayer(game, shot.playerId) ??
    (game.homeTeam.players.some((p) => p.id === shot.playerId)
      ? game.homeTeamId
      : game.awayTeamId)
  );
}

function shotMarkerAttacksLeft(shot: Shot, game: Game, tipFlipped: boolean): boolean {
  const shootingTeamId = shootingTeamIdForShot(shot, game);
  const isHome = shootingTeamId === game.homeTeamId;
  const liveSession = Boolean(game.isActive && !game.isCompleted);
  return resolveShotMarkerAttacksLeft({
    liveSession,
    homeTeamId: game.homeTeamId,
    shootingTeamId,
    tipFlipped,
    absolute: {
      isHomeShooter: isHome,
      shotPeriod: shot.period ?? 1,
      currentPeriod: game.currentPeriod ?? 1,
      currentFlipped: !!game.courtSidesFlipped,
      tipOffFlipped:
        game.courtSidesFlippedAtTip === true
          ? true
          : game.courtSidesFlippedAtTip === false
            ? false
            : null,
      gameCompletedOrFlipUnknown: !liveSession,
    },
  });
}

export function HorizontalFullCourtCanvas({
  game,
  homeTeamId,
  offenseTeamId,
  onPointClick,
  sessionMarkers = [],
  shots = [],
  interactive = true,
  shotMode = false,
  className,
  children,
}: HorizontalFullCourtCanvasProps) {
  const clickRef = useRef<HTMLDivElement>(null);
  const fitRef = useRef<HTMLDivElement>(null);
  const [courtSize, setCourtSize] = useState<{ width: number; height: number } | null>(null);

  const tipFlipped = tipOffFlippedFromGame(game);
  const halfRotate = liveCourtNeedsHalfRotate({
    isActive: game.isActive,
    isCompleted: game.isCompleted,
    courtSidesFlipped: game.courtSidesFlipped,
    courtSidesFlippedAtTip: game.courtSidesFlippedAtTip,
  });
  /** Draw / place in tip-off frame; CSS 180° handles post-half camera. */
  const drawFlipped = tipFlipped;

  useEffect(() => {
    const fitEl = fitRef.current;
    if (!fitEl) return;

    const update = () => {
      const { width, height } = fitEl.getBoundingClientRect();
      setCourtSize(fitHorizontalCourtDimensions(width, height));
    };

    update();
    const observer = new ResizeObserver(update);
    observer.observe(fitEl);
    return () => observer.disconnect();
  }, []);

  const markers = useMemo((): HorizontalCourtMarker[] => {
    const shotMarkers = shots.map((s) => {
      const half = percentToCourtPointM(s.x, s.y);
      const { x, y } = halfCourtPointToHorizontalSvg(
        half,
        shotMarkerAttacksLeft(s, game, drawFlipped)
      );
      return {
        x,
        y,
        color: s.made ? ('green' as const) : ('red' as const),
      };
    });
    const liveMarkers = sessionMarkers.map((m) => {
      const { x, y } = halfCourtPointToHorizontalSvg(
        m.point,
        homeAttacksLeft(homeTeamId, offenseTeamId, drawFlipped)
      );
      return { x, y, color: m.color };
    });
    return [...shotMarkers, ...liveMarkers];
  }, [game, homeTeamId, offenseTeamId, sessionMarkers, shots, drawFlipped]);

  const handleClick = useCallback(
    (e: React.MouseEvent) => {
      if (!interactive || !clickRef.current) return;
      const rect = clickRef.current.getBoundingClientRect();
      const raw = halfRotate
        ? invertClientPointAroundRectCenter(e.clientX, e.clientY, rect)
        : { clientX: e.clientX, clientY: e.clientY };
      const point = horizontalClickToHalfCourtPoint(
        raw.clientX,
        raw.clientY,
        rect,
        homeTeamId,
        offenseTeamId,
        drawFlipped
      );
      if (!point) return;
      onPointClick(point);
    },
    [homeTeamId, offenseTeamId, interactive, onPointClick, drawFlipped, halfRotate]
  );

  const shotModeColor = homeAttacksLeft(homeTeamId, offenseTeamId, drawFlipped)
    ? LIVE_HORIZONTAL_COURT_COLORS.home
    : LIVE_HORIZONTAL_COURT_COLORS.away;

  // Tip-frame label positions; CSS 180° + counter-rotate keeps names upright.
  const homeOnLeft = !drawFlipped;

  return (
    <div ref={fitRef} className={cn('h-full w-full min-h-0', className)}>
      <div
        ref={clickRef}
        style={
          courtSize
            ? { width: courtSize.width, height: courtSize.height }
            : { width: '100%', height: '100%', maxWidth: '100%', maxHeight: '100%' }
        }
        className={cn(
          'relative mx-auto',
          interactive && 'cursor-crosshair',
          !interactive && 'pointer-events-none'
        )}
        onClick={interactive ? handleClick : undefined}
      >
        <div
          className={cn('h-full w-full', !interactive && 'pointer-events-none')}
          style={halfRotate ? { transform: 'rotate(180deg)' } : undefined}
        >
          <FigmaHorizontalCourtSvg
            className="h-full w-full"
            markers={markers}
            homeLabel={game.homeTeam.abbreviation}
            awayLabel={game.awayTeam.abbreviation}
            homeOnLeft={homeOnLeft}
            uprightLabelsUnderHalfRotate={halfRotate}
            shotMode={shotMode}
            shotModeColor={shotModeColor}
          />
        </div>
        {children ? (
          <div className="absolute inset-0 z-20 flex items-stretch justify-stretch pointer-events-none [&>*]:pointer-events-auto">
            {children}
          </div>
        ) : null}
      </div>
    </div>
  );
}
