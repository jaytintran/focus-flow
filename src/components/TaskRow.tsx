import React from "react";
import { motion } from "motion/react";
import {
	Play,
	Pause,
	Trash2,
	CheckCircle2,
	Circle,
	Calendar,
	AlignLeft,
	RotateCcw,
} from "lucide-react";
import { Task, Category, ViewMode } from "../types";
import { formatDuration, formatDueDate } from "../utils";
import { PRIORITIES } from "../constants";
import { CategoryIcon } from "./CategoryIcon";

interface TaskRowProps {
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

export const TaskRow: React.FC<TaskRowProps> = ({
	task,
	category,
	isActive,
	viewMode,
	onTogglePlay,
	onDelete,
	onToggleComplete,
	onEdit,
	onReenter,
}) => {
	const priorityInfo = PRIORITIES.find((p) => p.label === task.priority);

	return (
		<motion.div
			layout
			initial={{ opacity: 0, y: 10 }}
			animate={{ opacity: 1, y: 0 }}
			exit={{ opacity: 0, x: -20 }}
			className={`group flex items-center transition-all border shadow-sm ${
				viewMode === "compact"
					? "p-2 rounded-xl gap-2"
					: viewMode === "detailed"
						? "p-5 rounded-xl gap-4"
						: "p-4 rounded-xl gap-4"
			} ${
				isActive
					? "ring-2 ring-blue-500 ring-offset-2 dark:ring-offset-gray-950 bg-blue-50/50 dark:bg-blue-500/10 border-blue-200 dark:border-blue-500/30"
					: "bg-white dark:bg-gray-900 border-gray-100 dark:border-gray-800 hover:border-blue-100 dark:hover:border-blue-900"
			} ${task.completed ? "opacity-50 grayscale-[0.5]" : ""}`}
		>
			<button
				onClick={() => onToggleComplete(task.id)}
				className="shrink-0 text-gray-400 hover:text-blue-500 transition-colors"
			>
				{task.completed ? (
					<CheckCircle2
						className={
							viewMode === "compact"
								? "w-5 h-5 text-green-500"
								: "w-6 h-6 text-green-500"
						}
					/>
				) : (
					<Circle className={viewMode === "compact" ? "w-5 h-5" : "w-6 h-6"} />
				)}
			</button>

			<div className="flex-1 min-w-0" onClick={() => onEdit(task)}>
				<div className="flex items-center gap-2 mb-1">
					<h3
						className={`${viewMode === "compact" ? "text-xs" : "text-sm"} font-bold truncate ${task.completed ? "line-through text-gray-400" : "text-gray-900 dark:text-white"}`}
					>
						{task.name}
					</h3>
					{task.description && viewMode !== "compact" && (
						<AlignLeft className="w-3 h-3 text-gray-400 shrink-0" />
					)}
				</div>

				{viewMode !== "compact" && (
					<div className="flex flex-wrap items-center gap-2 text-[9px] font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
						{/* PRIORITY CHIP */}
						{priorityInfo && (
							<span
								className="text-[8px] px-1.5 py-0.5 rounded-full font-black uppercase tracking-wider shrink-0"
								style={{
									backgroundColor: `${priorityInfo.color}20`,
									color: priorityInfo.color,
								}}
							>
								{task.priority}
							</span>
						)}
						{/* CATEGORY CHIP */}
						{category && (
							<div className="flex items-center gap-1.5 bg-gray-50 dark:bg-gray-800 px-2 py-0.5 rounded-lg border border-gray-100 dark:border-gray-700">
								<CategoryIcon
									name={category.iconName}
									className="w-2.5 h-2.5"
									style={{ color: category.color }}
								/>
								{category.name}
							</div>
						)}
						{/* DUE DATE CHIP */}
						{task.dueDate && (
							<div
								className={`flex items-center gap-1 ${new Date(task.dueDate) < new Date() && !task.completed ? "text-red-500" : ""}`}
							>
								<Calendar className="w-3 h-3" />
								{formatDueDate(task.dueDate)}
							</div>
						)}
						{/* SPENT TIME CHIP */}
						<div className="flex items-center gap-1 font-mono bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 px-2 py-0.5 rounded-lg border border-blue-100 dark:border-blue-900/50">
							{formatDuration(task.spentTime)}
						</div>
						{/* TASK DESCRIPTION */}
						{task.description && viewMode === "detailed" && (
							<p className="mt-2 text-xs text-gray-500 dark:text-gray-400 line-clamp-2 w-full mt-1">
								{task.description}
							</p>
						)}
					</div>
				)}
			</div>

			<div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
				<button
					onClick={() => onDelete(task.id)}
					className={`text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30 transition-all ${
						viewMode === "compact"
							? "p-1.5 sm:p-2 rounded-xl"
							: "p-2 sm:p-3 rounded-2xl"
					}`}
					title="Delete task"
				>
					<Trash2
						className={
							viewMode === "compact" ? "w-4 h-4" : "w-4.5 h-4.5 sm:w-5 sm:h-5"
						}
					/>
				</button>

				{onReenter && (
					<button
						onClick={() => onReenter(task.id)}
						className={`text-gray-400 hover:text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-950/30 transition-all ${
							viewMode === "compact"
								? "p-1.5 sm:p-2 rounded-xl"
								: "p-2 sm:p-3 rounded-2xl"
						}`}
						title="Re-enter task"
					>
						<RotateCcw
							className={
								viewMode === "compact" ? "w-4 h-4" : "w-4.5 h-4.5 sm:w-5 sm:h-5"
							}
						/>
					</button>
				)}

				{!task.completed && (
					<button
						onClick={() => onTogglePlay(task.id)}
						className={`transition-all shadow-sm ${
							viewMode === "compact"
								? "p-1.5 sm:p-2 rounded-xl"
								: "p-2 sm:p-3 rounded-2xl"
						} ${
							isActive
								? "bg-orange-500 text-white hover:bg-orange-600 shadow-orange-500/20"
								: "bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 hover:bg-blue-100 dark:hover:bg-blue-900/40 border border-blue-100 dark:border-blue-900/50"
						}`}
					>
						{isActive ? (
							<Pause
								className={
									viewMode === "compact"
										? "w-4 h-4 fill-current"
										: "w-4.5 h-4.5 sm:w-5 sm:h-5 fill-current"
								}
							/>
						) : (
							<Play
								className={
									viewMode === "compact"
										? "w-4 h-4 fill-current"
										: "w-4.5 h-4.5 sm:w-5 sm:h-5 fill-current"
								}
							/>
						)}
					</button>
				)}
			</div>
		</motion.div>
	);
};
