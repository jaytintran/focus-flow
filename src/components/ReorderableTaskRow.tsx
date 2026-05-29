import React from "react";
import { Reorder, useDragControls } from "motion/react";
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
}

export const ReorderableTaskRow: React.FC<ReorderableTaskRowProps> = (
	props,
) => {
	const dragControls = useDragControls();

	return (
		<Reorder.Item
			value={props.task}
			dragListener={false}
			dragControls={dragControls}
			className="select-none"
			layout={false}
		>
			<TaskRow {...props} onDragStart={(e) => dragControls.start(e)} />
		</Reorder.Item>
	);
};
