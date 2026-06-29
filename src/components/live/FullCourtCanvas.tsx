import React, { useRef, useCallback, useMemo, useState, useEffect } from 'react';
import {
  FibaFullCourtSvg,
  fitCourtDimensions,
  useIsDarkMode,
  type FullCourtMarker,
} from '../../lib/fibaFullCourtSvg';
import {
  offenseAttacksBottom,
  fullCourtClickToHalfCourtPoint,
  halfCourtPointToFullCourtM,
} from '../../lib/fullCourtClick';
import type { CourtMarker } from '../../liveEntry/liveEntryStateMachine';
import { percentToCourtPointM, type CourtPointM } from '../../lib/fibaCourtGeometry';
import type { Game, Shot } from '../../App';
import { cn } from '../ui/utils';

interface FullCourtCanvasProps {
  game: Game;
  homeTeamId: string;
  offenseTeamId: string;
  onPointClick: (point: CourtPointM) => void;
  sessionMarkers?: CourtMarker[];
  shots?: Shot[];
  showZones?: boolean;
  interactive?: boolean;
  className?: string;
  children?: React.ReactNode;
}

function shotToFullCourtMarker(
  shot: Shot,
  homeTeamId: string,
  offenseTeamId: string
): FullCourtMarker {
  const half = percentToCourtPointM(shot.x, shot.y);
  const full = halfCourtPointToFullCourtM(half, homeTeamId, offenseTeamId);
  return {
    point: full,
    color: shot.made ? 'green' : 'red',
  };
}

export function FullCourtCanvas({
  game,
  homeTeamId,
  offenseTeamId,
  onPointClick,
  sessionMarkers = [],
  shots = [],
  showZones = true,
  interactive = true,
  className,
  children,
}: FullCourtCanvasProps) {
  const clickRef = useRef<HTMLDivElement>(null);
  const fitRef = useRef<HTMLDivElement>(null);
  const [courtSize, setCourtSize] = useState<{ width: number; height: number } | null>(
    null
  );
  const isDark = useIsDarkMode();
  const activeHalf = offenseAttacksBottom(homeTeamId, offenseTeamId) ? 'bottom' : 'top';

  useEffect(() => {
    const fitEl = fitRef.current;
    if (!fitEl) return;

    const update = () => {
      const { width, height } = fitEl.getBoundingClientRect();
      setCourtSize(fitCourtDimensions(width, height));
    };

    update();
    const observer = new ResizeObserver(update);
    observer.observe(fitEl);
    return () => observer.disconnect();
  }, []);

  const markers = useMemo((): FullCourtMarker[] => {
    const shotMarkers = shots.map((s) => {
      const teamId = game.homeTeam.players.some((p) => p.id === s.playerId)
        ? game.homeTeamId
        : game.awayTeamId;
      return shotToFullCourtMarker(s, homeTeamId, teamId);
    });
    const liveMarkers = sessionMarkers.map((m) => ({
      point: halfCourtPointToFullCourtM(m.point, homeTeamId, offenseTeamId),
      color: m.color,
    }));
    return [...shotMarkers, ...liveMarkers];
  }, [game, homeTeamId, offenseTeamId, sessionMarkers, shots]);

  const handleClick = useCallback(
    (e: React.MouseEvent) => {
      if (!interactive || !clickRef.current) return;
      const rect = clickRef.current.getBoundingClientRect();
      const point = fullCourtClickToHalfCourtPoint(
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

  return (
    <div ref={fitRef} className={cn('w-full h-full min-h-0', className)}>
      <div className="w-full h-full flex items-center justify-center">
        <div
          ref={clickRef}
          style={
            courtSize
              ? { width: courtSize.width, height: courtSize.height }
              : { width: '100%', height: '100%', maxWidth: '100%', maxHeight: '100%' }
          }
          className={cn(
            'relative overflow-hidden rounded-xl border-2 border-border shadow-md bg-[#eab676] dark:bg-[#6b5344]',
            interactive && 'cursor-crosshair'
          )}
          onClick={handleClick}
        >
          <FibaFullCourtSvg
            showZones={showZones}
            markers={markers}
            activeHalf={activeHalf}
            isDark={isDark}
          />
          {children}
        </div>
      </div>
    </div>
  );
}
