import React from "react";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Task, Category, ViewMode } from "../types";
import { TaskRow } from "./TaskRow";

interface ReorderableTaskRowProps {
  task: Task;
  category: Category | undefined;
  isActive: boolean;
  viewMode: ViewMode;
  onTogglePlay: (id: string) => void;
  onDelete: (id: string) => void;
  onToggleComplete: (id: string) => void;
  onEdit: (task: Task) => void;
  onReenter?: (id: string) => void;
  onDraggingChange?: (isDragging: boolean) => void;
}

export const ReorderableTaskRow: React.FC<ReorderableTaskRowProps> = (
  props,
) => {
  const {
    attributes,
    listeners,
    setNodeRef,
    setActivatorNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: props.task.id });

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
    position: "relative",
    zIndex: isDragging ? 999 : undefined,
  };

  // Expose drag handle props down to TaskRow via onDragStart pattern
  const dragHandleProps = {
    ref: setActivatorNodeRef,
    ...attributes,
    ...listeners,
  };

  return (
    <div ref={setNodeRef} style={style}>
      <TaskRow {...props} dragHandleProps={dragHandleProps} />
    </div>
  );
};
