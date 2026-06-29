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
} from '../../lib/horizontalCourtClick';
import { percentToCourtPointM, type CourtPointM } from '../../lib/fibaCourtGeometry';
import type { CourtMarker as SessionMarker } from '../../liveEntry/liveEntryStateMachine';
import type { Game, Shot } from '../../App';
import { cn } from '../ui/utils';

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

function shotAttacksLeft(shot: Shot, game: Game): boolean {
  const isHome = game.homeTeam.players.some((p) => p.id === shot.playerId);
  return isHome;
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
      const { x, y } = halfCourtPointToHorizontalSvg(half, shotAttacksLeft(s, game));
      return {
        x,
        y,
        color: s.made ? ('green' as const) : ('red' as const),
      };
    });
    const liveMarkers = sessionMarkers.map((m) => {
      const { x, y } = halfCourtPointToHorizontalSvg(
        m.point,
        homeAttacksLeft(homeTeamId, offenseTeamId)
      );
      return { x, y, color: m.color };
    });
    return [...shotMarkers, ...liveMarkers];
  }, [game, homeTeamId, offenseTeamId, sessionMarkers, shots]);

  const handleClick = useCallback(
    (e: React.MouseEvent) => {
      if (!interactive || !clickRef.current) return;
      const rect = clickRef.current.getBoundingClientRect();
      const point = horizontalClickToHalfCourtPoint(
        e.clientX,
        e.clientY,
        rect,
        homeTeamId,
        offenseTeamId
      );
      if (!point) return;
      onPointClick(point);
    },
    [homeTeamId, offenseTeamId, interactive, onPointClick]
  );

  const shotModeColor = homeAttacksLeft(homeTeamId, offenseTeamId)
    ? LIVE_HORIZONTAL_COURT_COLORS.home
    : LIVE_HORIZONTAL_COURT_COLORS.away;

  return (
    <div ref={fitRef} className={cn('h-full w-full min-h-0', className)}>
      <div
        ref={clickRef}
        style={
          courtSize
            ? { width: courtSize.width, height: courtSize.height }
            : { width: '100%', height: '100%', maxWidth: '100%', maxHeight: '100%' }
        }
        className={cn('relative mx-auto', interactive && 'cursor-crosshair')}
        onClick={handleClick}
      >
        <FigmaHorizontalCourtSvg
          className="h-full w-full"
          markers={markers}
          homeLabel={game.homeTeam.abbreviation}
          awayLabel={game.awayTeam.abbreviation}
          shotMode={shotMode}
          shotModeColor={shotModeColor}
        />
        {children}
      </div>
    </div>
  );
}
