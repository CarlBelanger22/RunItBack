import React from "react";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
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

interface SortableRosterListProps {
  players: Player[];
  starterCount?: number;
  sortable?: boolean;
  onReorder: (players: Player[]) => void;
  renderTrailing?: (player: Player) => React.ReactNode;
}

interface SortableRowProps {
  player: Player;
  index: number;
  starterCount: number;
  sortable: boolean;
  showBenchDivider: boolean;
  renderTrailing?: (player: Player) => React.ReactNode;
}

function SortableRow({
  player,
  index,
  starterCount,
  sortable,
  showBenchDivider,
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

  const isStarter = index < starterCount;
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <>
      {showBenchDivider && index === starterCount && (
        <div className="relative py-1.5">
          <div className="absolute inset-x-0 top-1/2 border-t border-border" />
          <span className="relative mx-auto block w-fit bg-card px-2 text-[10px] uppercase tracking-wide text-muted-foreground">
            Bench
          </span>
        </div>
      )}
      <div
        ref={setNodeRef}
        style={style}
        className={cn(
          "flex items-center gap-1.5 rounded-md border border-transparent py-1 pl-0.5 pr-1.5 text-sm",
          isStarter && "border-l-2 border-l-primary pl-1",
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

export function SortableRosterList({
  players,
  starterCount = DEFAULT_STARTER_COUNT,
  sortable = true,
  onReorder,
  renderTrailing,
}: SortableRosterListProps) {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = players.findIndex((p) => p.id === active.id);
    const newIndex = players.findIndex((p) => p.id === over.id);
    if (oldIndex < 0 || newIndex < 0) return;
    onReorder(arrayMove(players, oldIndex, newIndex));
  };

  const showBenchDivider =
    players.length > starterCount && players.length >= starterCount + 1;

  const list = (
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

  const content = sortable ? (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragEnd={handleDragEnd}
    >
      <SortableContext
        items={players.map((p) => p.id)}
        strategy={verticalListSortingStrategy}
      >
        {list}
      </SortableContext>
    </DndContext>
  ) : (
    list
  );

  if (players.length > SCROLL_THRESHOLD) {
    return (
      <ScrollArea className="max-h-[min(480px,50vh)] pr-2">
        {content}
      </ScrollArea>
    );
  }

  return content;
}
