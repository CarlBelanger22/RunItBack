import { useState, useCallback, useRef } from "react";

// ─── Constants ────────────────────────────────────────────────────────────────

const HOME_COLOR = "#1a7eff";
const AWAY_COLOR = "#ff6b35";
const VW = 188;
const VH = 100;

// ─── Types ────────────────────────────────────────────────────────────────────

type TeamId = "home" | "away";

interface Player {
  id: number;
  number: string;
  name: string;
  pos: string;
  onCourt: boolean;
}

interface BoxPlayer extends Player {
  pts: number; reb: number; ast: number; stl: number; blk: number;
  to: number; pf: number; fgm: number; fga: number;
  tpm: number; tpa: number; ftm: number; fta: number;
}

interface ShotMark {
  id: number; x: number; y: number; made: boolean; team: TeamId;
}

interface LogEntry {
  id: number; period: number; clock: string;
  team: TeamId; player: string; action: string; detail?: string;
}

// ─── Data ─────────────────────────────────────────────────────────────────────

const bp = (
  id: number, number: string, name: string, pos: string, onCourt: boolean,
  pts: number, reb: number, ast: number, stl: number, blk: number,
  to: number, pf: number, fgm: number, fga: number,
  tpm: number, tpa: number, ftm: number, fta: number
): BoxPlayer => ({
  id, number, name, pos, onCourt,
  pts, reb, ast, stl, blk, to, pf, fgm, fga, tpm, tpa, ftm, fta,
});

const INIT_HOME: BoxPlayer[] = [
  bp(1,  "3",  "L. James",    "SF", true,  14, 4, 7, 1, 0, 2, 1, 5, 11, 1, 3, 2, 3),
  bp(2,  "23", "A. Davis",    "C",  true,  18, 9, 2, 1, 3, 1, 2, 7, 13, 0, 1, 4, 5),
  bp(3,  "11", "K. Irving",   "PG", true,  22, 3, 6, 2, 0, 3, 0, 8, 16, 2, 5, 2, 2),
  bp(4,  "7",  "C. Anthony",  "SG", true,   8, 2, 1, 0, 0, 1, 1, 3,  7, 1, 3, 0, 0),
  bp(5,  "14", "T. Tucker",   "PF", true,   4, 3, 2, 1, 1, 0, 2, 2,  5, 0, 2, 0, 0),
  bp(6,  "9",  "R. Westbrook","PG", false,  6, 5, 4, 2, 0, 2, 3, 2,  6, 0, 1, 2, 2),
  bp(7,  "5",  "D. Russell",  "SG", false, 10, 2, 3, 1, 0, 1, 1, 4,  9, 2, 4, 0, 0),
  bp(8,  "12", "K. Nunn",     "SG", false,  5, 1, 1, 0, 0, 0, 0, 2,  4, 1, 2, 0, 0),
];

const INIT_AWAY: BoxPlayer[] = [
  bp(11, "30", "S. Curry",    "PG", true,  26, 5, 7, 2, 0, 2, 1, 9, 19, 3, 8, 2, 2),
  bp(12, "11", "K. Thompson", "SG", true,  16, 3, 2, 1, 0, 0, 2, 6, 13, 2, 6, 0, 0),
  bp(13, "23", "D. Green",    "PF", true,   4, 8, 5, 3, 1, 1, 3, 1,  4, 0, 2, 2, 2),
  bp(14, "5",  "J. Poole",    "SG", true,  12, 2, 3, 1, 0, 2, 1, 4,  9, 1, 3, 2, 3),
  bp(15, "0",  "J. Wiggins",  "SF", true,  10, 4, 1, 2, 0, 1, 2, 4,  9, 1, 3, 0, 0),
  bp(16, "2",  "N. Bjelica",  "PF", false,  4, 3, 1, 0, 1, 0, 1, 1,  3, 1, 2, 0, 0),
  bp(17, "18", "M. Mulder",   "PG", false,  3, 1, 2, 1, 0, 1, 0, 1,  3, 1, 2, 0, 0),
  bp(18, "1",  "P. Siakam",   "SF", false,  8, 5, 2, 1, 1, 1, 2, 3,  7, 0, 2, 2, 3),
];

const INITIAL_LOG: LogEntry[] = [
  { id: 6, period: 2, clock: "07:44", team: "away", player: "S. Curry",  action: "3PT MISS",  detail: "Top of Key"  },
  { id: 5, period: 2, clock: "07:58", team: "home", player: "A. Davis",  action: "2PT MAKE",  detail: "Paint"       },
  { id: 4, period: 2, clock: "08:23", team: "home", player: "K. Irving", action: "3PT MAKE",  detail: "Left Wing"   },
  { id: 3, period: 2, clock: "08:41", team: "away", player: "S. Curry",  action: "2PT MAKE",  detail: "Mid-Range"   },
  { id: 2, period: 2, clock: "09:12", team: "home", player: "A. Davis",  action: "FOUL",      detail: "Personal"    },
  { id: 1, period: 2, clock: "09:44", team: "away", player: "D. Green",  action: "TURNOVER",  detail: "Bad Pass"    },
];

// ─── Clock ────────────────────────────────────────────────────────────────────

function useGameClock(initial = 479) {
  const [secs, setSecs] = useState(initial);
  const [running, setRunning] = useState(false);
  const ref = useRef<ReturnType<typeof setInterval> | null>(null);
  const toggle = useCallback(() => {
    setRunning((r) => {
      if (r) { if (ref.current) clearInterval(ref.current); }
      else { ref.current = setInterval(() => setSecs((s) => Math.max(0, s - 1)), 1000); }
      return !r;
    });
  }, []);
  const reset = useCallback(() => {
    if (ref.current) clearInterval(ref.current);
    setRunning(false); setSecs(initial);
  }, [initial]);
  const fmt = `${String(Math.floor(secs / 60)).padStart(2, "0")}:${String(secs % 60).padStart(2, "0")}`;
  return { fmt, running, toggle, reset };
}

// ─── Player Card (rectangular) ────────────────────────────────────────────────

function PlayerCard({
  player, color, selected, onClick,
}: {
  player: Player; color: string; selected: boolean; onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded transition-all duration-150 text-left"
      style={{
        background: selected ? `${color}28` : `${color}0a`,
        border: `1.5px solid ${selected ? color : `${color}30`}`,
        boxShadow: selected ? `0 0 10px ${color}44, inset 0 0 0 1px ${color}22` : "none",
      }}
    >
      {/* Jersey badge */}
      <div
        className="flex-shrink-0 flex items-center justify-center rounded font-black text-base leading-none"
        style={{
          width: 36, height: 36,
          background: selected ? color : `${color}22`,
          color: selected ? "#fff" : color,
          fontFamily: "'Barlow Condensed', sans-serif",
          fontSize: 16,
        }}
      >
        {player.number}
      </div>
      {/* Name + pos */}
      <div className="flex flex-col min-w-0">
        <span
          className="text-xs font-semibold leading-tight truncate"
          style={{ color: selected ? "#fff" : "#c8d6ec", fontFamily: "'Barlow', sans-serif" }}
        >
          {player.name}
        </span>
        <span
          className="text-[9px] font-mono mt-0.5"
          style={{ color: selected ? color : "#4a5a74" }}
        >
          {player.pos}
        </span>
      </div>
    </button>
  );
}

// ─── Basketball Court ─────────────────────────────────────────────────────────

function BasketballCourt({
  shots, onCourtClick, pendingAction, selectedTeam,
}: {
  shots: ShotMark[]; onCourtClick: (x: number, y: number) => void;
  pendingAction: string | null; selectedTeam: TeamId | null;
}) {
  const svgRef = useRef<SVGSVGElement>(null);
  const handleClick = useCallback((e: React.MouseEvent<SVGSVGElement>) => {
    if (!svgRef.current) return;
    const r = svgRef.current.getBoundingClientRect();
    onCourtClick(((e.clientX - r.left) / r.width) * VW, ((e.clientY - r.top) / r.height) * VH);
  }, [onCourtClick]);

  const keyW = 33, keyD = 39, basketX = 10.5;
  const lBX = 1.5 + basketX, rBX = VW - 1.5 - basketX, bY = VH / 2;
  const arc3R = 45, c3Y = 9;
  const isActive = pendingAction === "MAKE" || pendingAction === "MISS";
  const cc = selectedTeam === "home" ? HOME_COLOR : AWAY_COLOR;

  return (
    <div
      className="relative rounded overflow-hidden"
      style={{
        outline: isActive ? `2px solid ${cc}66` : "none",
        outlineOffset: 2,
      }}
    >
      <svg
        ref={svgRef}
        viewBox={`0 0 ${VW} ${VH}`}
        className="w-full block"
        style={{ cursor: isActive ? "crosshair" : "default" }}
        onClick={handleClick}
      >
        <defs>
          <clipPath id="court2"><rect x="1.5" y="1.5" width={VW - 3} height={VH - 3} /></clipPath>
          <clipPath id="lkey2"><rect x="1.5" y={bY - keyW / 2} width={keyD} height={keyW} /></clipPath>
          <clipPath id="rkey2"><rect x={VW - 1.5 - keyD} y={bY - keyW / 2} width={keyD} height={keyW} /></clipPath>
        </defs>
        {/* Floor */}
        <rect x="0" y="0" width={VW} height={VH} fill="#b8841e" />
        <rect x="0.5" y="0.5" width={VW - 1} height={VH - 1} fill="#cc9930" stroke="#8b6812" strokeWidth="0.2" />
        {Array.from({ length: 22 }).map((_, i) => (
          <line key={i} x1="0" y1={i * 4.8} x2={VW} y2={i * 4.8} stroke="#b8841e" strokeWidth="0.1" opacity="0.5" />
        ))}
        {/* Boundary */}
        <rect x="1.5" y="1.5" width={VW - 3} height={VH - 3} fill="none" stroke="#fff" strokeWidth="0.45" />
        {/* Half-court */}
        <line x1={VW / 2} y1="1.5" x2={VW / 2} y2={VH - 1.5} stroke="#fff" strokeWidth="0.4" />
        <circle cx={VW / 2} cy={bY} r="6" fill="none" stroke="#fff" strokeWidth="0.4" />
        <circle cx={VW / 2} cy={bY} r="0.7" fill="#fff" />
        {/* LEFT KEY */}
        <rect x="1.5" y={bY - keyW / 2} width={keyD} height={keyW} fill="rgba(26,126,255,0.15)" stroke="#fff" strokeWidth="0.4" />
        <circle cx={1.5 + keyD} cy={bY} r="6" fill="none" stroke="#fff" strokeWidth="0.4" strokeDasharray="1.4 1.4" clipPath="url(#lkey2)" />
        <circle cx={1.5 + keyD} cy={bY} r="6" fill="none" stroke="#fff" strokeWidth="0.4" clipPath="url(#court2)" />
        <line x1={1.5 + 4.5} y1={bY - 9} x2={1.5 + 4.5} y2={bY + 9} stroke="#fff" strokeWidth="0.9" />
        <circle cx={lBX} cy={bY} r="2.6" fill="none" stroke="#e07820" strokeWidth="0.65" />
        <circle cx={lBX} cy={bY} r="0.65" fill="#e07820" />
        <path d={`M ${lBX} ${bY - 4.2} A 4.2 4.2 0 0 1 ${lBX} ${bY + 4.2}`} fill="none" stroke="#fff" strokeWidth="0.35" />
        <path d={`M 1.5 ${c3Y} L ${1.5 + 14.5} ${c3Y} A ${arc3R} ${arc3R} 0 0 1 ${1.5 + 14.5} ${VH - c3Y} L 1.5 ${VH - c3Y}`} fill="none" stroke="#fff" strokeWidth="0.4" clipPath="url(#court2)" />
        <line x1="1.5" y1={c3Y} x2={1.5 + 14.5} y2={c3Y} stroke="#fff" strokeWidth="0.4" />
        <line x1="1.5" y1={VH - c3Y} x2={1.5 + 14.5} y2={VH - c3Y} stroke="#fff" strokeWidth="0.4" />
        {/* RIGHT KEY */}
        <rect x={VW - 1.5 - keyD} y={bY - keyW / 2} width={keyD} height={keyW} fill="rgba(255,107,53,0.12)" stroke="#fff" strokeWidth="0.4" />
        <circle cx={VW - 1.5 - keyD} cy={bY} r="6" fill="none" stroke="#fff" strokeWidth="0.4" strokeDasharray="1.4 1.4" clipPath="url(#rkey2)" />
        <circle cx={VW - 1.5 - keyD} cy={bY} r="6" fill="none" stroke="#fff" strokeWidth="0.4" clipPath="url(#court2)" />
        <line x1={VW - 1.5 - 4.5} y1={bY - 9} x2={VW - 1.5 - 4.5} y2={bY + 9} stroke="#fff" strokeWidth="0.9" />
        <circle cx={rBX} cy={bY} r="2.6" fill="none" stroke="#e07820" strokeWidth="0.65" />
        <circle cx={rBX} cy={bY} r="0.65" fill="#e07820" />
        <path d={`M ${rBX} ${bY - 4.2} A 4.2 4.2 0 0 0 ${rBX} ${bY + 4.2}`} fill="none" stroke="#fff" strokeWidth="0.35" />
        <path d={`M ${VW - 1.5} ${c3Y} L ${VW - 1.5 - 14.5} ${c3Y} A ${arc3R} ${arc3R} 0 0 0 ${VW - 1.5 - 14.5} ${VH - c3Y} L ${VW - 1.5} ${VH - c3Y}`} fill="none" stroke="#fff" strokeWidth="0.4" clipPath="url(#court2)" />
        <line x1={VW - 1.5} y1={c3Y} x2={VW - 1.5 - 14.5} y2={c3Y} stroke="#fff" strokeWidth="0.4" />
        <line x1={VW - 1.5} y1={VH - c3Y} x2={VW - 1.5 - 14.5} y2={VH - c3Y} stroke="#fff" strokeWidth="0.4" />
        {/* Shot markers */}
        {shots.map((s) => {
          const c = s.team === "home" ? HOME_COLOR : AWAY_COLOR;
          return s.made ? (
            <circle key={s.id} cx={s.x} cy={s.y} r="1.5" fill={c} stroke="#fff" strokeWidth="0.3" opacity="0.93" />
          ) : (
            <g key={s.id} opacity="0.85">
              <line x1={s.x - 1.4} y1={s.y - 1.4} x2={s.x + 1.4} y2={s.y + 1.4} stroke={c} strokeWidth="0.6" />
              <line x1={s.x + 1.4} y1={s.y - 1.4} x2={s.x - 1.4} y2={s.y + 1.4} stroke={c} strokeWidth="0.6" />
            </g>
          );
        })}
        {/* Half labels */}
        <text x={VW * 0.25} y={bY + 20} textAnchor="middle" fill="rgba(255,255,255,0.10)" fontSize="4.5" fontFamily="JetBrains Mono, monospace" letterSpacing="1.5">LAKERS</text>
        <text x={VW * 0.75} y={bY + 20} textAnchor="middle" fill="rgba(255,255,255,0.10)" fontSize="4.5" fontFamily="JetBrains Mono, monospace" letterSpacing="1.5">WARRIORS</text>
      </svg>
      <div className="absolute bottom-1 left-0 right-0 flex justify-between px-2 pointer-events-none">
        <span className="text-[8px] font-mono" style={{ color: `${HOME_COLOR}66` }}>◀ HOME</span>
        <span className="text-[8px] font-mono" style={{ color: `${AWAY_COLOR}66` }}>AWAY ▶</span>
      </div>
      {isActive && (
        <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
          <span className="text-[10px] font-mono px-2 py-1 rounded"
            style={{ background: `${cc}22`, color: cc, border: `1px solid ${cc}55` }}>
            Click court — {pendingAction === "MAKE" ? "✓ MAKE" : "✗ MISS"}
          </span>
        </div>
      )}
    </div>
  );
}

// ─── Log Card ─────────────────────────────────────────────────────────────────

function LogCard({
  entry, onEdit, onDelete,
}: {
  entry: LogEntry;
  onEdit: (id: number, field: keyof LogEntry, val: string) => void;
  onDelete: (id: number) => void;
}) {
  const [editing, setEditing] = useState<keyof LogEntry | null>(null);
  const [draft, setDraft] = useState("");
  const color = entry.team === "home" ? HOME_COLOR : AWAY_COLOR;

  const startEdit = (field: keyof LogEntry) => { setEditing(field); setDraft(String(entry[field] ?? "")); };
  const commit = () => { if (editing) { onEdit(entry.id, editing, draft); setEditing(null); } };

  const isMake = entry.action.includes("MAKE");
  const isMiss = entry.action.includes("MISS");
  const isFoul = entry.action.includes("FOUL");
  const actionColor = isMake ? "#22d3a0" : isMiss ? "#e63946" : isFoul ? "#f59e0b" : "#a0b0cc";

  const ESpan = ({ field, val, cls }: { field: keyof LogEntry; val: string; cls?: string }) =>
    editing === field ? (
      <input autoFocus value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => { if (e.key === "Enter") commit(); if (e.key === "Escape") setEditing(null); }}
        className="bg-transparent border-b border-white/30 outline-none text-foreground"
        style={{ width: Math.max(draft.length * 7, 36) + "px", fontFamily: "inherit", fontSize: "inherit" }}
      />
    ) : (
      <span className={`cursor-text hover:underline decoration-dotted underline-offset-2 ${cls ?? ""}`}
        onDoubleClick={() => startEdit(field)}>{val}</span>
    );

  return (
    <div
      className="flex-shrink-0 flex flex-col gap-1 rounded px-3 py-2 border relative group"
      style={{ background: `${color}0d`, borderColor: `${color}30`, minWidth: 148, maxWidth: 172 }}
    >
      <div className="flex items-center justify-between">
        <span className="text-[9px] font-mono text-muted-foreground">
          Q{entry.period} · <ESpan field="clock" val={entry.clock} />
        </span>
        <button onClick={() => onDelete(entry.id)}
          className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive text-sm leading-none transition-opacity ml-2">
          ×
        </button>
      </div>
      <div className="px-1.5 py-0.5 rounded self-start text-[9px] font-bold uppercase tracking-widest"
        style={{ background: `${color}20`, color }}>
        {entry.team === "home" ? "LAL" : "GSW"}
      </div>
      <div className="text-[11px] font-medium text-foreground truncate">
        <ESpan field="player" val={entry.player} />
      </div>
      <div className="text-[12px] font-black leading-tight" style={{ color: actionColor, fontFamily: "'Barlow Condensed', sans-serif" }}>
        <ESpan field="action" val={entry.action} />
      </div>
      {entry.detail && (
        <div className="text-[9px] font-mono text-muted-foreground">
          <ESpan field="detail" val={entry.detail} />
        </div>
      )}
      <div className="opacity-0 group-hover:opacity-100 text-[8px] font-mono text-muted-foreground/40 transition-opacity">
        dbl-click to edit
      </div>
    </div>
  );
}

// ─── Box Score Table ──────────────────────────────────────────────────────────

type StatKey = "pts" | "fgm" | "fga" | "tpm" | "tpa" | "ftm" | "fta" | "reb" | "ast" | "stl" | "blk" | "to" | "pf";

const COLS: { key: StatKey; label: string }[] = [
  { key: "pts",  label: "PTS" }, { key: "fgm",  label: "FGM" }, { key: "fga",  label: "FGA" },
  { key: "tpm",  label: "3PM" }, { key: "tpa",  label: "3PA" }, { key: "ftm",  label: "FTM" },
  { key: "fta",  label: "FTA" }, { key: "reb",  label: "REB" }, { key: "ast",  label: "AST" },
  { key: "stl",  label: "STL" }, { key: "blk",  label: "BLK" }, { key: "to",   label: "TO"  },
  { key: "pf",   label: "PF"  },
];

function BoxScoreTable({
  players, team, onEdit,
}: {
  players: BoxPlayer[]; team: TeamId;
  onEdit: (id: number, key: StatKey, val: number) => void;
}) {
  const [sortKey, setSortKey] = useState<StatKey>("pts");
  const [sortDir, setSortDir] = useState<"desc" | "asc">("desc");
  const [editCell, setEditCell] = useState<{ id: number; key: StatKey } | null>(null);
  const [editVal, setEditVal] = useState("");
  const color = team === "home" ? HOME_COLOR : AWAY_COLOR;

  const sorted = [...players].sort((a, b) =>
    sortDir === "desc" ? b[sortKey] - a[sortKey] : a[sortKey] - b[sortKey]
  );

  const handleSort = (k: StatKey) => {
    if (k === sortKey) setSortDir((d) => d === "desc" ? "asc" : "desc");
    else { setSortKey(k); setSortDir("desc"); }
  };

  const startEdit = (id: number, key: StatKey, cur: number) => {
    setEditCell({ id, key }); setEditVal(String(cur));
  };

  const commitEdit = () => {
    if (!editCell) return;
    const v = parseInt(editVal, 10);
    if (!isNaN(v) && v >= 0) onEdit(editCell.id, editCell.key, v);
    setEditCell(null);
  };

  const fgPct = (m: number, a: number) => a > 0 ? `${Math.round((m / a) * 100)}%` : "—";

  return (
    <div className="overflow-x-auto" style={{ scrollbarWidth: "thin", scrollbarColor: "#1a2540 transparent" }}>
      <table className="w-full border-collapse" style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 11 }}>
        <thead>
          <tr style={{ borderBottom: `1px solid rgba(255,255,255,0.07)` }}>
            <th className="text-left py-1.5 px-3 sticky left-0 z-10 font-medium whitespace-nowrap"
              style={{ color: "#5c7099", background: "#0a1018", minWidth: 150 }}>PLAYER</th>
            {COLS.map((c) => (
              <th key={c.key}
                className="py-1.5 px-2 text-center cursor-pointer whitespace-nowrap transition-colors hover:text-foreground select-none"
                style={{ color: sortKey === c.key ? color : "#5c7099" }}
                onClick={() => handleSort(c.key)}
              >
                {c.label}{sortKey === c.key ? (sortDir === "desc" ? " ▼" : " ▲") : ""}
              </th>
            ))}
            <th className="py-1.5 px-2 text-center whitespace-nowrap" style={{ color: "#5c7099" }}>FG%</th>
            <th className="py-1.5 px-2 text-center whitespace-nowrap" style={{ color: "#5c7099" }}>3P%</th>
          </tr>
        </thead>
        <tbody>
          {sorted.map((p) => (
            <tr key={p.id}
              className="transition-colors"
              style={{ borderBottom: "1px solid rgba(255,255,255,0.04)" }}
              onMouseEnter={(e) => (e.currentTarget.style.background = "rgba(255,255,255,0.025)")}
              onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
            >
              <td className="py-1 px-3 sticky left-0 z-10" style={{ background: "#0a1018" }}>
                <div className="flex items-center gap-2">
                  <span className="w-1 h-1 rounded-full" style={{ background: p.onCourt ? color : "#1e2d47", flexShrink: 0 }} />
                  <span className="font-bold" style={{ color }}>{p.number}</span>
                  <span className="text-foreground truncate" style={{ maxWidth: 96 }}>{p.name}</span>
                  <span style={{ color: "#3a4a64", fontSize: 10 }}>{p.pos}</span>
                </div>
              </td>
              {COLS.map((c) => {
                const isEditing = editCell?.id === p.id && editCell.key === c.key;
                return (
                  <td key={c.key} className="py-1 px-2 text-center"
                    onDoubleClick={() => startEdit(p.id, c.key, p[c.key])}>
                    {isEditing ? (
                      <input autoFocus value={editVal}
                        onChange={(e) => setEditVal(e.target.value)}
                        onBlur={commitEdit}
                        onKeyDown={(e) => { if (e.key === "Enter") commitEdit(); if (e.key === "Escape") setEditCell(null); }}
                        className="w-8 text-center bg-secondary border border-primary rounded outline-none text-foreground"
                        style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 11 }}
                      />
                    ) : (
                      <span
                        className="hover:underline decoration-dotted cursor-pointer"
                        style={{ color: c.key === "pts" ? "#dde4f0" : c.key === "to" || c.key === "pf" ? "#e6394688" : "#5c7099", fontWeight: c.key === "pts" ? 700 : 400 }}
                      >
                        {p[c.key]}
                      </span>
                    )}
                  </td>
                );
              })}
              <td className="py-1 px-2 text-center" style={{ color: "#5c7099" }}>{fgPct(p.fgm, p.fga)}</td>
              <td className="py-1 px-2 text-center" style={{ color: "#5c7099" }}>{fgPct(p.tpm, p.tpa)}</td>
            </tr>
          ))}
          {/* Totals */}
          <tr style={{ borderTop: `1px solid ${color}33`, background: `${color}08` }}>
            <td className="py-1 px-3 sticky left-0 z-10 font-bold" style={{ color: "#5c7099", background: "#0a1018", fontFamily: "'Barlow Condensed', sans-serif", fontSize: 11, letterSpacing: "0.05em" }}>
              TEAM TOTALS
            </td>
            {COLS.map((c) => (
              <td key={c.key} className="py-1 px-2 text-center font-bold" style={{ color }}>
                {players.reduce((s, p) => s + p[c.key], 0)}
              </td>
            ))}
            <td className="py-1 px-2 text-center font-bold" style={{ color }}>
              {fgPct(players.reduce((s, p) => s + p.fgm, 0), players.reduce((s, p) => s + p.fga, 0))}
            </td>
            <td className="py-1 px-2 text-center font-bold" style={{ color }}>
              {fgPct(players.reduce((s, p) => s + p.tpm, 0), players.reduce((s, p) => s + p.tpa, 0))}
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}

// ─── Main App ─────────────────────────────────────────────────────────────────

export default function App() {
  const [homePlayers, setHomePlayers] = useState<BoxPlayer[]>(INIT_HOME);
  const [awayPlayers, setAwayPlayers] = useState<BoxPlayer[]>(INIT_AWAY);

  const [homeScore, setHomeScore] = useState(66);
  const [awayScore, setAwayScore] = useState(71);
  const [homeFouls, setHomeFouls] = useState(3);
  const [awayFouls, setAwayFouls] = useState(5);
  const [period, setPeriod] = useState(2);
  const clock = useGameClock();

  const [shots, setShots] = useState<ShotMark[]>([]);
  const [selectedTeam, setSelectedTeam] = useState<TeamId | null>(null);
  const [selectedPlayerId, setSelectedPlayerId] = useState<number | null>(null);
  const [pendingAction, setPendingAction] = useState<string | null>(null);

  const [log, setLog] = useState<LogEntry[]>(INITIAL_LOG);
  const [nextId, setNextId] = useState(10);
  const logRef = useRef<HTMLDivElement>(null);

  const allPlayers = [...homePlayers, ...awayPlayers];
  const selectedPlayer = allPlayers.find((p) => p.id === selectedPlayerId) ?? null;
  const onCourt = (t: TeamId) => (t === "home" ? homePlayers : awayPlayers).filter((p) => p.onCourt);

  const selectPlayer = (team: TeamId, pid: number) => {
    if (selectedPlayerId === pid && selectedTeam === team) {
      setSelectedPlayerId(null); setSelectedTeam(null);
    } else { setSelectedTeam(team); setSelectedPlayerId(pid); }
    setPendingAction(null);
  };

  const pushLog = useCallback((action: string, detail?: string) => {
    setNextId((n) => {
      setLog((prev) => [{
        id: n, period, clock: clock.fmt,
        team: selectedTeam!, player: selectedPlayer?.name ?? "—", action, detail,
      } as LogEntry, ...prev]);
      return n + 1;
    });
    setTimeout(() => { if (logRef.current) logRef.current.scrollLeft = 0; }, 30);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [period, clock.fmt, selectedTeam, selectedPlayer]);

  const handleCourtClick = useCallback((x: number, y: number) => {
    if (!pendingAction || !selectedTeam) return;
    const made = pendingAction === "MAKE";
    setShots((s) => [...s, { id: Date.now(), x, y, made, team: selectedTeam }]);

    const lBX = 1.5 + 10.5, rBX = VW - 1.5 - 10.5, bY = VH / 2, arc3R = 45, c3Y = 9;
    const is3 = x <= VW / 2
      ? Math.sqrt((x - lBX) ** 2 + (y - bY) ** 2) > arc3R || y < c3Y || y > VH - c3Y
      : Math.sqrt((x - rBX) ** 2 + (y - bY) ** 2) > arc3R || y < c3Y || y > VH - c3Y;

    if (made) {
      const pts = is3 ? 3 : 2;
      if (selectedTeam === "home") setHomeScore((s) => s + pts);
      else setAwayScore((s) => s + pts);
      (selectedTeam === "home" ? setHomePlayers : setAwayPlayers)((ps) =>
        ps.map((p) => p.id === selectedPlayerId
          ? { ...p, pts: p.pts + pts, fgm: p.fgm + 1, fga: p.fga + 1, tpm: is3 ? p.tpm + 1 : p.tpm, tpa: is3 ? p.tpa + 1 : p.tpa }
          : p)
      );
    } else {
      (selectedTeam === "home" ? setHomePlayers : setAwayPlayers)((ps) =>
        ps.map((p) => p.id === selectedPlayerId
          ? { ...p, fga: p.fga + 1, tpa: is3 ? p.tpa + 1 : p.tpa }
          : p)
      );
    }

    const zone = y < VH * 0.25 ? "Top Corner" : y > VH * 0.75 ? "Bottom Corner"
      : x < VW * 0.3 ? "Left Block" : x > VW * 0.7 ? "Right Block" : "Mid-Range";
    pushLog(`${is3 ? "3PT" : "2PT"} ${made ? "MAKE" : "MISS"}`, zone);
    setPendingAction(null);
  }, [pendingAction, selectedTeam, selectedPlayerId, pushLog]);

  const handleAction = (action: string) => {
    if (!selectedTeam) return;
    if (action === "MAKE" || action === "MISS") {
      setPendingAction((p) => (p === action ? null : action));
      return;
    }
    if (action === "FOUL") {
      if (selectedTeam === "home") setHomeFouls((f) => Math.min(f + 1, 5));
      else setAwayFouls((f) => Math.min(f + 1, 5));
      (selectedTeam === "home" ? setHomePlayers : setAwayPlayers)((ps) =>
        ps.map((p) => p.id === selectedPlayerId ? { ...p, pf: p.pf + 1 } : p)
      );
      pushLog("FOUL", "Personal");
    } else if (action === "TO") {
      (selectedTeam === "home" ? setHomePlayers : setAwayPlayers)((ps) =>
        ps.map((p) => p.id === selectedPlayerId ? { ...p, to: p.to + 1 } : p)
      );
      pushLog("TURNOVER", "Bad Pass");
    } else if (action === "SUB") {
      pushLog("SUBSTITUTION");
    }
  };

  const editBox = (team: TeamId) => (id: number, key: StatKey, val: number) => {
    (team === "home" ? setHomePlayers : setAwayPlayers)((ps) =>
      ps.map((p) => p.id === id ? { ...p, [key]: val } : p)
    );
  };

  const ACTIONS = [
    { key: "MAKE", label: "MAKE", sub: "Shot In",    color: "#22d3a0" },
    { key: "MISS", label: "MISS", sub: "Shot Out",   color: "#e63946" },
    { key: "FOUL", label: "FOUL", sub: "Personal",   color: "#f59e0b" },
    { key: "TO",   label: "TO",   sub: "Turnover",   color: "#e63946" },
    { key: "SUB",  label: "SUB",  sub: "Sub Player", color: "#a855f7" },
  ];

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col" style={{ fontFamily: "'Barlow', sans-serif" }}>

      {/* ═══ HEADER / SCOREBOARD ═══ */}
      <header className="flex-shrink-0 flex items-center justify-between px-5 py-2 border-b border-border" style={{ background: "#080e18" }}>
        {/* Branding */}
        <div className="flex items-center gap-2 w-44">
          <svg width="20" height="20" viewBox="0 0 22 22" fill="none">
            <circle cx="11" cy="11" r="10" stroke="#d4a843" strokeWidth="1.5" />
            <circle cx="11" cy="11" r="6" stroke="#d4a843" strokeWidth="0.8" />
            <line x1="1" y1="11" x2="21" y2="11" stroke="#d4a843" strokeWidth="0.8" />
            <line x1="11" y1="1" x2="11" y2="21" stroke="#d4a843" strokeWidth="0.8" />
          </svg>
          <div>
            <div className="text-[11px] font-bold tracking-[0.2em] text-muted-foreground uppercase" style={{ fontFamily: "'Barlow Condensed', sans-serif" }}>FIBA LiveStats</div>
            <div className="text-[9px] font-mono text-muted-foreground/40">Data Entry v4.2</div>
          </div>
        </div>

        {/* CENTRAL SCOREBOARD */}
        <div className="flex items-center gap-6">
          {/* Home name */}
          <div className="text-right">
            <div className="text-[9px] font-mono uppercase tracking-widest text-muted-foreground">Los Angeles</div>
            <div className="text-xs font-black" style={{ color: HOME_COLOR, fontFamily: "'Barlow Condensed', sans-serif" }}>LAKERS</div>
          </div>

          <div className="flex flex-col items-center">
            {/* Scores */}
            <div className="flex items-center gap-3">
              <span className="text-5xl font-black tabular-nums leading-none" style={{ color: HOME_COLOR, fontFamily: "'Barlow Condensed', sans-serif" }}>{homeScore}</span>
              <span className="text-xl font-thin text-muted-foreground/30">–</span>
              <span className="text-5xl font-black tabular-nums leading-none" style={{ color: AWAY_COLOR, fontFamily: "'Barlow Condensed', sans-serif" }}>{awayScore}</span>
            </div>
            {/* Fouls + period + clock */}
            <div className="flex items-center gap-4 mt-1.5">
              {/* Home fouls */}
              <div className="flex items-center gap-1">
                {Array.from({ length: 5 }).map((_, i) => (
                  <div key={i} className="w-2 h-2 rounded-full border" style={{ background: i < homeFouls ? HOME_COLOR : "transparent", borderColor: i < homeFouls ? HOME_COLOR : "#1e2d47" }} />
                ))}
                <span className="text-[8px] font-mono text-muted-foreground ml-1">PF</span>
              </div>

              {/* Quarter + clock */}
              <div className="flex flex-col items-center gap-0.5">
                <div className="flex items-center gap-1">
                  {[1, 2, 3, 4].map((q) => (
                    <button key={q} onClick={() => setPeriod(q)}
                      className="w-5 h-5 rounded text-[10px] font-bold font-mono transition-all"
                      style={{ background: period === q ? "#1a7eff" : "rgba(255,255,255,0.05)", color: period === q ? "#fff" : "#5c7099" }}>
                      {q}
                    </button>
                  ))}
                  <span className="text-[8px] font-mono text-muted-foreground ml-1">QTR</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xl font-black tabular-nums" style={{ fontFamily: "'JetBrains Mono', monospace", color: clock.running ? "#22d3a0" : "#dde4f0" }}>
                    {clock.fmt}
                  </span>
                  <button onClick={clock.toggle} className="px-2 py-0.5 rounded text-[10px] font-bold uppercase transition-all"
                    style={{ background: clock.running ? "#e6394618" : "#22d3a018", color: clock.running ? "#e63946" : "#22d3a0", border: `1px solid ${clock.running ? "#e6394644" : "#22d3a044"}`, fontFamily: "'Barlow Condensed', sans-serif" }}>
                    {clock.running ? "■" : "▶"}
                  </button>
                  <button onClick={clock.reset} className="text-[9px] font-mono text-muted-foreground hover:text-foreground transition-colors">RST</button>
                </div>
              </div>

              {/* Away fouls */}
              <div className="flex items-center gap-1">
                <span className="text-[8px] font-mono text-muted-foreground mr-1">PF</span>
                {Array.from({ length: 5 }).map((_, i) => (
                  <div key={i} className="w-2 h-2 rounded-full border" style={{ background: i < awayFouls ? AWAY_COLOR : "transparent", borderColor: i < awayFouls ? AWAY_COLOR : "#1e2d47" }} />
                ))}
              </div>
            </div>
          </div>

          {/* Away name */}
          <div className="text-left">
            <div className="text-[9px] font-mono uppercase tracking-widest text-muted-foreground">Golden State</div>
            <div className="text-xs font-black" style={{ color: AWAY_COLOR, fontFamily: "'Barlow Condensed', sans-serif" }}>WARRIORS</div>
          </div>
        </div>

        {/* Game meta */}
        <div className="text-right w-44">
          <div className="text-[9px] font-mono text-muted-foreground uppercase tracking-widest">Game 4 · NBA Finals</div>
          <div className="text-[9px] font-mono text-muted-foreground/50">Chase Center, San Francisco</div>
          <div className="text-[9px] font-mono text-muted-foreground/40 mt-0.5">28 Jun 2026 · 20:00 PT</div>
        </div>
      </header>

      {/* ═══ COURT ROW ═══ */}
      <div className="flex-shrink-0 flex items-stretch border-b border-border" style={{ background: "#070b12" }}>

        {/* Home player cards */}
        <div className="flex-shrink-0 flex flex-col justify-center gap-1.5 px-2 py-3 border-r border-border"
          style={{ width: 164, background: `${HOME_COLOR}06` }}>
          <div className="text-[8px] font-mono uppercase tracking-widest px-1 mb-0.5" style={{ color: `${HOME_COLOR}77` }}>HOME · On Court</div>
          {onCourt("home").map((p) => (
            <PlayerCard key={p.id} player={p} color={HOME_COLOR}
              selected={selectedPlayerId === p.id && selectedTeam === "home"}
              onClick={() => selectPlayer("home", p.id)} />
          ))}
        </div>

        {/* Court + context + actions */}
        <div className="flex-1 flex flex-col">
          {/* Context bar */}
          <div className="flex-shrink-0 flex items-center gap-2 px-3 py-1.5 border-b border-border text-[11px]"
            style={{ background: "rgba(0,0,0,0.3)" }}>
            {selectedPlayer ? (
              <>
                <span className="px-2 py-0.5 rounded font-bold"
                  style={{ background: `${selectedTeam === "home" ? HOME_COLOR : AWAY_COLOR}22`, color: selectedTeam === "home" ? HOME_COLOR : AWAY_COLOR, fontFamily: "'Barlow Condensed', sans-serif" }}>
                  #{selectedPlayer.number} {selectedPlayer.name}
                </span>
                <span className="text-muted-foreground">— select action below</span>
                <button onClick={() => { setSelectedPlayerId(null); setSelectedTeam(null); setPendingAction(null); }}
                  className="ml-auto font-mono text-muted-foreground hover:text-foreground text-[10px]">
                  [clear]
                </button>
              </>
            ) : (
              <span className="text-muted-foreground font-mono text-[10px]">← Select a player to begin logging</span>
            )}
          </div>

          {/* Court — constrained to 60% of natural width via max-w */}
          <div className="flex items-center justify-center px-3 py-2">
            <div style={{ width: "60%" }}>
              <BasketballCourt shots={shots} onCourtClick={handleCourtClick}
                pendingAction={pendingAction} selectedTeam={selectedTeam} />
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex-shrink-0 border-t border-border px-3 py-2 flex items-center justify-center gap-2.5">
            {ACTIONS.map((a) => {
              const active = pendingAction === a.key;
              const disabled = !selectedTeam;
              return (
                <button key={a.key} onClick={() => handleAction(a.key)} disabled={disabled}
                  className="flex flex-col items-center justify-center gap-0.5 px-5 py-2.5 rounded border transition-all duration-100 select-none active:scale-95 disabled:opacity-30 disabled:cursor-not-allowed"
                  style={{ background: active ? `${a.color}22` : "rgba(255,255,255,0.03)", borderColor: active ? a.color : "rgba(255,255,255,0.08)", minWidth: 76, boxShadow: active ? `0 0 12px ${a.color}33` : "none" }}>
                  <span className="text-base font-black tracking-wider leading-none"
                    style={{ color: active ? a.color : "#8fa4c8", fontFamily: "'Barlow Condensed', sans-serif" }}>
                    {a.label}
                  </span>
                  <span className="text-[9px] font-mono" style={{ color: active ? a.color : "#3a4a64" }}>
                    {a.sub}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Away player cards */}
        <div className="flex-shrink-0 flex flex-col justify-center gap-1.5 px-2 py-3 border-l border-border"
          style={{ width: 164, background: `${AWAY_COLOR}06` }}>
          <div className="text-[8px] font-mono uppercase tracking-widest px-1 mb-0.5" style={{ color: `${AWAY_COLOR}77` }}>AWAY · On Court</div>
          {onCourt("away").map((p) => (
            <PlayerCard key={p.id} player={p} color={AWAY_COLOR}
              selected={selectedPlayerId === p.id && selectedTeam === "away"}
              onClick={() => selectPlayer("away", p.id)} />
          ))}
        </div>
      </div>

      {/* ═══ PLAY-BY-PLAY LOG ═══ */}
      <div className="flex-shrink-0 border-b border-border" style={{ background: "#060a10" }}>
        <div className="flex items-center gap-3 px-4 py-1.5 border-b border-border">
          <div className="flex items-center gap-1.5">
            <div className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
            <span className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground">Live Play-by-Play</span>
          </div>
          <span className="text-[9px] font-mono text-muted-foreground/40">
            {log.length} events · newest left · double-click any field to edit
          </span>
          <button onClick={() => setLog([])} className="ml-auto text-[9px] font-mono text-muted-foreground/40 hover:text-muted-foreground transition-colors">
            clear all
          </button>
        </div>
        <div ref={logRef}
          className="flex items-start gap-2 px-4 py-2.5 overflow-x-auto overflow-y-hidden"
          style={{ scrollbarWidth: "thin", scrollbarColor: "#1a2540 transparent", minHeight: 112 }}>
          {log.length === 0 ? (
            <div className="flex items-center w-full text-muted-foreground/25 text-xs font-mono">
              No events yet — select a player and use the action buttons above
            </div>
          ) : (
            log.map((e) => (
              <LogCard key={e.id} entry={e}
                onEdit={(id, field, val) => setLog((prev) => prev.map((x) => x.id === id ? { ...x, [field]: val } : x))}
                onDelete={(id) => setLog((prev) => prev.filter((x) => x.id !== id))} />
            ))
          )}
        </div>
      </div>

      {/* ═══ BOX SCORE ═══ */}
      <div className="flex-1 flex flex-col overflow-hidden" style={{ background: "#070b12" }}>
        {/* Tab header */}
        <div className="flex-shrink-0 flex items-center gap-0 border-b border-border px-4 py-0">
          <div className="flex items-center gap-2 border-b-2 py-2 pr-6" style={{ borderColor: HOME_COLOR }}>
            <div className="w-2 h-2 rounded-full" style={{ background: HOME_COLOR }} />
            <span className="text-xs font-bold uppercase tracking-wider" style={{ color: HOME_COLOR, fontFamily: "'Barlow Condensed', sans-serif" }}>
              Lakers — Box Score
            </span>
          </div>
          <div className="w-px h-5 mx-4" style={{ background: "rgba(255,255,255,0.07)" }} />
          <div className="flex items-center gap-2 border-b-2 py-2 pr-6" style={{ borderColor: AWAY_COLOR }}>
            <div className="w-2 h-2 rounded-full" style={{ background: AWAY_COLOR }} />
            <span className="text-xs font-bold uppercase tracking-wider" style={{ color: AWAY_COLOR, fontFamily: "'Barlow Condensed', sans-serif" }}>
              Warriors — Box Score
            </span>
          </div>
          <span className="ml-auto text-[9px] font-mono text-muted-foreground/40 py-2">Double-click any stat to edit · click column to sort</span>
        </div>

        {/* Two tables stacked */}
        <div className="flex-1 overflow-y-auto" style={{ scrollbarWidth: "thin", scrollbarColor: "#1a2540 transparent" }}>
          <div style={{ background: "#0a1018" }}>
            <BoxScoreTable players={homePlayers} team="home" onEdit={editBox("home")} />
          </div>
          <div className="border-t border-border" style={{ background: "#0a1018" }}>
            <BoxScoreTable players={awayPlayers} team="away" onEdit={editBox("away")} />
          </div>
        </div>
      </div>

    </div>
  );
}
