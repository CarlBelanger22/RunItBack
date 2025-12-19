import React, { useRef, useCallback } from 'react';
import { Shot } from '../App';
import { cn } from './ui/utils';
import courtImage from 'figma:asset/f65163b731043f15b81c5eb0e3f3bccc76945c97.png';

interface CourtViewProps {
  shots?: Shot[];
  onCourtClick?: (x: number, y: number) => void;
  showZones?: boolean;
  interactive?: boolean;
  className?: string;
  heatmap?: boolean;
  useSvgBackground?: boolean;
}

export function CourtView({
  shots = [],
  onCourtClick,
  showZones = false,
  interactive = false,
  className,
  heatmap = false,
  useSvgBackground = false,
}: CourtViewProps) {
  const courtRef = useRef<HTMLDivElement>(null);

  const handleTap = useCallback((event: React.MouseEvent) => {
    if (!interactive || !onCourtClick || !courtRef.current) return;
    
    const rect = courtRef.current.getBoundingClientRect();
    const x = ((event.clientX - rect.left) / rect.width) * 100;
    const y = ((event.clientY - rect.top) / rect.height) * 100;
    
    onCourtClick(x, y);
  }, [interactive, onCourtClick]);

  const SvgCourt = () => (
    <svg
      viewBox="0 0 100 75"
      className="w-full h-full bg-muted/10"
      preserveAspectRatio="xMidYMid meet"
    >
      <rect x="0" y="0" width="100" height="75" fill="none" stroke="currentColor" strokeWidth="0.5" className="text-muted-foreground/30" />
      <path d="M 0 37.5 L 100 37.5" stroke="currentColor" strokeWidth="0.5" className="text-muted-foreground/30" />
      <circle cx="50" cy="37.5" r="10" fill="none" stroke="currentColor" strokeWidth="0.5" className="text-muted-foreground/30" />
      {/* Basic Half Court Markings */}
      <rect x="35" y="55" width="30" height="20" fill="none" stroke="currentColor" strokeWidth="0.5" className="text-muted-foreground/30" />
      <circle cx="50" cy="55" r="10" fill="none" stroke="currentColor" strokeWidth="0.5" className="text-muted-foreground/30" />
      <path d="M 10 75 L 10 60 A 40 40 0 0 1 90 60 L 90 75" fill="none" stroke="currentColor" strokeWidth="0.5" className="text-muted-foreground/30" />
    </svg>
  );

  return (
    <div 
      ref={courtRef}
      className={cn(
        "relative w-full aspect-[4/3] overflow-hidden bg-muted/20 rounded-xl border border-border shadow-sm",
        interactive && "cursor-crosshair",
        className
      )}
      onClick={handleTap}
    >
      {/* Background Court */}
      {useSvgBackground ? (
        <div className="absolute inset-0">
          <SvgCourt />
        </div>
      ) : (
        <img 
          src={courtImage}
          alt="Basketball Court"
          className="w-full h-full object-cover select-none pointer-events-none"
          draggable={false}
        />
      )}

      {/* Zones Overlay */}
      {showZones && (
        <div className="absolute inset-0 pointer-events-none opacity-40">
          {/* Paint Area */}
          <div className="absolute bg-blue-500/20 border-2 border-blue-500/40" 
               style={{ left: '35%', top: '65%', width: '30%', height: '35%' }} />
          {/* Three-Point Arc (Approximate) */}
          <div className="absolute border-2 border-orange-500/40 rounded-full bg-orange-500/5"
               style={{ left: '10%', top: '20%', width: '80%', height: '120%', transform: 'translateY(10%)' }} />
        </div>
      )}

      {/* Shot Markers */}
      <div className="absolute inset-0 pointer-events-none">
        {shots.map((shot) => (
          <div
            key={shot.id}
            className={cn(
              "absolute w-3 h-3 rounded-full transform -translate-x-1/2 -translate-y-1/2 border shadow-sm transition-transform hover:scale-150 z-10",
              shot.made 
                ? "bg-green-500 border-green-600 shadow-green-200" 
                : "bg-red-500 border-red-600 shadow-red-200"
            )}
            style={{
              left: `${shot.x}%`,
              top: `${shot.y}%`
            }}
          >
            {/* Optional inner check/x for clarity */}
            <div className="w-full h-full flex items-center justify-center text-[8px] font-bold text-white">
              {shot.made ? '✓' : '×'}
            </div>
          </div>
        ))}
      </div>

      {/* Heatmap overlay could be added here in the future if needed */}
    </div>
  );
}

