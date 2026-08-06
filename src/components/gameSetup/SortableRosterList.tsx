import React, { useMemo, useState } from "react";
import {
  DndContext,
  DragOverlay,
  closestCorners,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  useDroppable,
  type DragEndEvent,
  type DragStartEvent,
  type UniqueIdentifier,
} from "@dnd-kit/core";
import {
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
  arrayMove,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical } from "lucide-react";
import type { Player } from "../../App";
import { ScrollArea } from "../ui/scroll-area";
import { cn } from "../ui/utils";

const DEFAULT_STARTER_COUNT = 5;
const SCROLL_THRESHOLD = 12;
const ACTIVE_CONTAINER = "active";
const INACTIVE_CONTAINER = "inactive";

interface SortableRosterListProps {
  players: Player[];
  starterCount?: number;
  sortable?: boolean;
  onReorder: (players: Player[]) => void;
  renderTrailing?: (player: Player) => React.ReactNode;
  /**
   * Friendly triage: third band for players not in this game.
   * `players` = Starters + Bench; `inactivePlayers` = Inactive.
   */
  inactivePlayers?: Player[];
  onTriageChange?: (active: Player[], inactive: Player[]) => void;
}

interface SortableRowProps {
  player: Player;
  index: number;
  starterCount: number;
  sortable: boolean;
  showBenchDivider: boolean;
  showInactiveDivider?: boolean;
  isInactiveBand?: boolean;
  renderTrailing?: (player: Player) => React.ReactNode;
}

function SectionDivider({ label }: { label: string }) {
  return (
    <div className="relative py-1.5">
      <div className="absolute inset-x-0 top-1/2 border-t border-border" />
      <span className="relative mx-auto block w-fit bg-card px-2 text-[10px] uppercase tracking-wide text-muted-foreground">
        {label}
      </span>
    </div>
  );
}

function SortableRow({
  player,
  index,
  starterCount,
  sortable,
  showBenchDivider,
  showInactiveDivider = false,
  isInactiveBand = false,
  renderTrailing,
}: SortableRowProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: player.id,
    disabled: !sortable,
  });

  const isStarter = !isInactiveBand && index < starterCount;
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <>
      {showBenchDivider && index === starterCount && (
        <SectionDivider label="Bench" />
      )}
      {showInactiveDivider && index === 0 && (
        <SectionDivider label="Inactive" />
      )}
      <div
        ref={setNodeRef}
        style={style}
        className={cn(
          "flex items-center gap-1.5 rounded-md border border-transparent py-1 pl-0.5 pr-1.5 text-sm",
          isStarter && "border-l-2 border-l-primary pl-1",
          isInactiveBand && "opacity-70",
          isDragging && "z-10 bg-accent shadow-sm opacity-90"
        )}
      >
        {sortable ? (
          <button
            type="button"
            className="flex h-7 w-6 shrink-0 cursor-grab touch-none items-center justify-center rounded text-muted-foreground hover:bg-muted active:cursor-grabbing"
            aria-label={`Reorder ${player.name}`}
            {...attributes}
            {...listeners}
          >
            <GripVertical className="h-3.5 w-3.5" />
          </button>
        ) : (
          <span className="w-6 shrink-0" aria-hidden />
        )}
        <span className="w-8 shrink-0 font-mono text-xs text-muted-foreground">
          #{player.number}
        </span>
        <span className="min-w-0 flex-1 truncate font-medium">{player.name}</span>
        <span className="hidden shrink-0 text-xs text-muted-foreground sm:inline">
          {player.position}
        </span>
        {isStarter && (
          <span className="hidden shrink-0 rounded bg-primary px-1.5 py-0.5 text-[10px] font-medium text-primary-foreground md:inline">
            Starter
          </span>
        )}
        {renderTrailing?.(player)}
      </div>
    </>
  );
}

function RosterDropZone({
  id,
  children,
  isEmpty,
  emptyLabel,
}: {
  id: typeof ACTIVE_CONTAINER | typeof INACTIVE_CONTAINER;
  children: React.ReactNode;
  isEmpty: boolean;
  emptyLabel?: string;
}) {
  const { setNodeRef, isOver } = useDroppable({ id });
  return (
    <div
      ref={setNodeRef}
      className={cn(
        "min-h-[2.5rem] rounded-md",
        isEmpty && "border border-dashed border-border",
        isOver && "bg-muted/50"
      )}
    >
      {isEmpty && emptyLabel ? (
        <p className="px-2 py-2 text-center text-[10px] uppercase tracking-wide text-muted-foreground">
          {emptyLabel}
        </p>
      ) : null}
      {children}
    </div>
  );
}

function findContainer(
  id: UniqueIdentifier,
  activeIds: string[],
  inactiveIds: string[]
): typeof ACTIVE_CONTAINER | typeof INACTIVE_CONTAINER | null {
  const key = String(id);
  if (key === ACTIVE_CONTAINER || key === INACTIVE_CONTAINER) return key;
  if (activeIds.includes(key)) return ACTIVE_CONTAINER;
  if (inactiveIds.includes(key)) return INACTIVE_CONTAINER;
  return null;
}

export function SortableRosterList({
  players,
  starterCount = DEFAULT_STARTER_COUNT,
  sortable = true,
  onReorder,
  renderTrailing,
  inactivePlayers,
  onTriageChange,
}: SortableRosterListProps) {
  const triageMode = inactivePlayers != null && onTriageChange != null;
  const inactive = inactivePlayers ?? [];
  const [activeDragId, setActiveDragId] = useState<string | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const activeIds = useMemo(() => players.map((p) => p.id), [players]);
  const inactiveIds = useMemo(() => inactive.map((p) => p.id), [inactive]);

  const handleSimpleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = players.findIndex((p) => p.id === active.id);
    const newIndex = players.findIndex((p) => p.id === over.id);
    if (oldIndex < 0 || newIndex < 0) return;
    onReorder(arrayMove(players, oldIndex, newIndex));
  };

  const handleTriageDragStart = (event: DragStartEvent) => {
    setActiveDragId(String(event.active.id));
  };

  const handleTriageDragEnd = (event: DragEndEvent) => {
    setActiveDragId(null);
    const { active, over } = event;
    if (!over || !onTriageChange) return;

    const from = findContainer(active.id, activeIds, inactiveIds);
    const to = findContainer(over.id, activeIds, inactiveIds);
    if (!from || !to) return;

    if (from === to) {
      const list = from === ACTIVE_CONTAINER ? [...players] : [...inactive];
      const oldIndex = list.findIndex((p) => p.id === active.id);
      let newIndex =
        over.id === ACTIVE_CONTAINER || over.id === INACTIVE_CONTAINER
          ? list.length - 1
          : list.findIndex((p) => p.id === over.id);
      if (oldIndex < 0 || newIndex < 0 || oldIndex === newIndex) return;
      const next = arrayMove(list, oldIndex, newIndex);
      if (from === ACTIVE_CONTAINER) onTriageChange(next, inactive);
      else onTriageChange(players, next);
      return;
    }

    const fromList = from === ACTIVE_CONTAINER ? [...players] : [...inactive];
    const toList = to === ACTIVE_CONTAINER ? [...players] : [...inactive];
    const fromIndex = fromList.findIndex((p) => p.id === active.id);
    if (fromIndex < 0) return;
    const [moving] = fromList.splice(fromIndex, 1);
    let insertAt =
      over.id === ACTIVE_CONTAINER || over.id === INACTIVE_CONTAINER
        ? toList.length
        : toList.findIndex((p) => p.id === over.id);
    if (insertAt < 0) insertAt = toList.length;
    toList.splice(insertAt, 0, moving);

    if (from === ACTIVE_CONTAINER) onTriageChange(fromList, toList);
    else onTriageChange(toList, fromList);
  };

  const showBenchDivider =
    players.length > starterCount && players.length >= starterCount + 1;

  const activeList = (
    <div className="space-y-0.5 pb-1">
      {players.map((player, index) => (
        <SortableRow
          key={player.id}
          player={player}
          index={index}
          starterCount={starterCount}
          sortable={sortable}
          showBenchDivider={showBenchDivider}
          renderTrailing={renderTrailing}
        />
      ))}
    </div>
  );

  const inactiveList = (
    <div className="space-y-0.5 pb-1">
      {inactive.map((player, index) => (
        <SortableRow
          key={player.id}
          player={player}
          index={index}
          starterCount={starterCount}
          sortable={sortable}
          showBenchDivider={false}
          showInactiveDivider={index === 0}
          isInactiveBand
          renderTrailing={renderTrailing}
        />
      ))}
    </div>
  );

  const dragPlayer =
    activeDragId == null
      ? null
      : players.find((p) => p.id === activeDragId) ??
        inactive.find((p) => p.id === activeDragId) ??
        null;

  let content: React.ReactNode;
  if (!sortable) {
    content = triageMode ? (
      <>
        {activeList}
        {inactive.length > 0 ? inactiveList : null}
      </>
    ) : (
      activeList
    );
  } else if (!triageMode) {
    content = (
      <DndContext
        sensors={sensors}
        collisionDetection={closestCorners}
        onDragEnd={handleSimpleDragEnd}
      >
        <SortableContext
          items={players.map((p) => p.id)}
          strategy={verticalListSortingStrategy}
        >
          {activeList}
        </SortableContext>
      </DndContext>
    );
  } else {
    content = (
      <DndContext
        sensors={sensors}
        collisionDetection={closestCorners}
        onDragStart={handleTriageDragStart}
        onDragEnd={handleTriageDragEnd}
      >
        <RosterDropZone
          id={ACTIVE_CONTAINER}
          isEmpty={players.length === 0}
          emptyLabel="Starters / Bench — drag players here for this game"
        >
          <SortableContext
            items={activeIds}
            id={ACTIVE_CONTAINER}
            strategy={verticalListSortingStrategy}
          >
            {players.length > 0 ? activeList : null}
          </SortableContext>
        </RosterDropZone>
        <RosterDropZone
          id={INACTIVE_CONTAINER}
          isEmpty={inactive.length === 0}
          emptyLabel="Inactive — drag players here to exclude from this game"
        >
          <SortableContext
            items={inactiveIds}
            id={INACTIVE_CONTAINER}
            strategy={verticalListSortingStrategy}
          >
            {inactive.length > 0 ? inactiveList : null}
          </SortableContext>
        </RosterDropZone>
        <DragOverlay>
          {dragPlayer ? (
            <div className="flex items-center gap-1.5 rounded-md border bg-card py-1 pl-0.5 pr-1.5 text-sm shadow-md">
              <span className="w-8 shrink-0 font-mono text-xs text-muted-foreground">
                #{dragPlayer.number}
              </span>
              <span className="font-medium">{dragPlayer.name}</span>
            </div>
          ) : null}
        </DragOverlay>
      </DndContext>
    );
  }

  const totalCount = players.length + inactive.length;
  if (totalCount > SCROLL_THRESHOLD) {
    return (
      <ScrollArea className="max-h-[min(480px,50vh)] pr-2">
        {content}
      </ScrollArea>
    );
  }

  return content;
}
