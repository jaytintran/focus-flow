import React from "react";
import { Task, Category, Tag } from "../types";
import { CategoryIcon } from "./CategoryIcon";
import { TAGS } from "../constants";
import { formatDuration, formatDueDate } from "../utils";
import {
	Play,
	Pause,
	Trash2,
	CheckCircle2,
	RotateCcw,
	Edit2,
	Calendar,
	Clock,
} from "lucide-react";
import { motion } from "motion/react";

interface TaskTableProps {
	tasks: Task[];
	categories: Category[];
	activeTaskId: string | null;
	timerActive: boolean;
	onTogglePlay: (id: string) => void;
	onDelete: (id: string) => void;
	onToggleComplete: (id: string) => void;
	onEdit: (task: Task) => void;
	onReenter: (id: string) => void;
	darkMode: boolean;
}

export const TaskTable: React.FC<TaskTableProps> = ({
	tasks,
	categories,
	activeTaskId,
	timerActive,
	onTogglePlay,
	onDelete,
	onToggleComplete,
	onEdit,
	onReenter,
	darkMode,
}) => {
	return (
		<div
			className={`overflow-x-auto rounded-[32px] border ${darkMode ? "border-gray-800 bg-gray-900/50" : "border-gray-100 bg-white"} shadow-sm`}
		>
			<table className="w-full text-left border-collapse min-w-[700px]">
				<thead>
					<tr
						className={`border-b ${darkMode ? "border-gray-800" : "border-gray-50"}`}
					>
						<th className="px-6 py-4 text-[10px] font-bold text-gray-400 uppercase tracking-wider w-16">
							Status
						</th>
						<th className="px-6 py-4 text-[10px] font-bold text-gray-400 uppercase tracking-wider">
							Task
						</th>
						<th className="px-6 py-4 text-[10px] font-bold text-gray-400 uppercase tracking-wider">
							Category
						</th>
						<th className="px-6 py-4 text-[10px] font-bold text-gray-400 uppercase tracking-wider">
							Tag
						</th>
						<th className="px-6 py-4 text-[10px] font-bold text-gray-400 uppercase tracking-wider">
							Due Date
						</th>
						<th className="px-6 py-4 text-[10px] font-bold text-gray-400 uppercase tracking-wider">
							Time
						</th>
						<th className="px-6 py-4 text-[10px] font-bold text-gray-400 uppercase tracking-wider text-right">
							Actions
						</th>
					</tr>
				</thead>
				<tbody className="divide-y divide-gray-50 dark:divide-gray-800/50">
					{tasks.map((task) => {
						const category = categories.find((c) => c.id === task.categoryId);
						const tagInfo = TAGS.find(
							(t) => t.label === task.tag,
						);
						const isActive = activeTaskId === task.id && timerActive;

						return (
							<tr
								key={task.id}
								className={`group hover:bg-gray-50/50 dark:hover:bg-gray-800/30 transition-colors ${task.completed ? "opacity-60" : ""}`}
							>
								<td className="px-6 py-4">
									<button
										onClick={() => onToggleComplete(task.id)}
										className={`transition-all ${task.completed ? "text-green-500" : "text-gray-300 hover:text-blue-500"}`}
									>
										<CheckCircle2
											className={`w-5 h-5 ${task.completed ? "fill-current" : ""}`}
										/>
									</button>
								</td>
								<td className="px-6 py-4">
									<p
										className={`font-bold text-sm ${task.completed ? "line-through text-gray-400" : ""}`}
									>
										{task.name}
									</p>
									{task.description && (
										<p className="text-[10px] text-gray-400 truncate max-w-[200px]">
											{task.description}
										</p>
									)}
								</td>
								<td className="px-6 py-4">
									{category && (
										<div className="flex items-center gap-1.5 text-xs font-bold">
											<CategoryIcon
												name={category.iconName}
												className="w-3.5 h-3.5"
												style={{ color: category.color }}
											/>
											<span className="truncate max-w-[100px]">
												{category.name}
											</span>
										</div>
									)}
								</td>
								<td className="px-6 py-4">
									<div className="flex items-center gap-1.5">
										<div
											className="w-1.5 h-1.5 rounded-full"
											style={{ backgroundColor: tagInfo?.color }}
										/>
										<span className="text-xs font-bold">{task.tag}</span>
									</div>
								</td>
								<td className="px-6 py-4 font-bold text-xs text-gray-400">
									{task.dueDate ? (
										<div className="flex items-center gap-1.5 bg-gray-50 dark:bg-gray-800 px-2 py-1 rounded-lg">
											<Calendar className="w-3 h-3 text-blue-500" />
											{formatDueDate(task.dueDate)}
										</div>
									) : (
										"-"
									)}
								</td>
								<td className="px-6 py-4 font-mono text-xs text-gray-400 whitespace-nowrap">
									{formatDuration(task.spentTime)}
								</td>
								<td className="px-6 py-4">
									<div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
										{!task.completed && (
											<button
												onClick={() => onTogglePlay(task.id)}
												className={`p-2 rounded-xl transition-all ${isActive ? "bg-orange-500 text-white" : "hover:bg-blue-50 dark:hover:bg-blue-900/30 text-blue-500"}`}
											>
												{isActive ? (
													<Pause className="w-4 h-4" />
												) : (
													<Play className="w-4 h-4" />
												)}
											</button>
										)}
										<button
											onClick={() => onReenter(task.id)}
											className="p-2 rounded-xl hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-400 hover:text-blue-500"
											title="Re-enter"
										>
											<RotateCcw className="w-4 h-4" />
										</button>
										<button
											onClick={() => onEdit(task)}
											className="p-2 rounded-xl hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-400"
											title="Edit"
										>
											<Edit2 className="w-4 h-4" />
										</button>
										<button
											onClick={() => onDelete(task.id)}
											className="p-2 rounded-xl hover:bg-red-50 dark:hover:bg-red-950/30 text-gray-300 hover:text-red-500"
											title="Delete"
										>
											<Trash2 className="w-4 h-4" />
										</button>
									</div>
								</td>
							</tr>
						);
					})}
				</tbody>
			</table>
		</div>
	);
};

interface TaskGalleryProps {
	tasks: Task[];
	categories: Category[];
	activeTaskId: string | null;
	timerActive: boolean;
	onTogglePlay: (id: string) => void;
	onDelete: (id: string) => void;
	onToggleComplete: (id: string) => void;
	onEdit: (task: Task) => void;
	onReenter: (id: string) => void;
	darkMode: boolean;
}

export const TaskGallery: React.FC<TaskGalleryProps> = ({
	tasks,
	categories,
	activeTaskId,
	timerActive,
	onTogglePlay,
	onDelete,
	onToggleComplete,
	onEdit,
	onReenter,
	darkMode,
}) => {
	return (
		<div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
			{tasks.map((task) => {
				const category = categories.find((c) => c.id === task.categoryId);
				const priorityInfo = PRIORITIES.find((p) => p.label === task.priority);
				const isActive = activeTaskId === task.id && timerActive;

				return (
					<motion.div
						layout
						key={task.id}
						className={`p-5 rounded-[32px] border flex flex-col h-full group transition-all ${
							darkMode
								? "bg-gray-900/50 border-gray-800 hover:border-gray-700"
								: "bg-white border-gray-100 hover:border-gray-200"
						} ${task.completed ? "opacity-60" : ""}`}
					>
						<div className="flex items-start justify-between mb-4">
							<button
								onClick={() => onToggleComplete(task.id)}
								className={`transition-all ${task.completed ? "text-green-500" : "text-gray-300 hover:text-blue-500"}`}
							>
								<CheckCircle2
									className={`w-5 h-5 ${task.completed ? "fill-current" : ""}`}
								/>
							</button>
							<div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
								<button
									onClick={() => onEdit(task)}
									className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-400"
								>
									<Edit2 className="w-3.5 h-3.5" />
								</button>
								<button
									onClick={() => onDelete(task.id)}
									className="p-1.5 rounded-lg hover:bg-red-50 dark:hover:bg-red-950/30 text-gray-300 hover:text-red-500"
								>
									<Trash2 className="w-3.5 h-3.5" />
								</button>
							</div>
						</div>

						<h3
							className={`font-bold text-sm mb-2 line-clamp-2 ${task.completed ? "line-through text-gray-400" : ""}`}
						>
							{task.name}
						</h3>

						<div className="mt-auto space-y-3">
							<div className="flex flex-wrap gap-2">
								{category && (
									<div className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-gray-50 dark:bg-gray-800 border border-gray-100 dark:border-gray-700 text-[9px] font-bold">
										<CategoryIcon
											name={category.iconName}
											className="w-2.5 h-2.5"
											style={{ color: category.color }}
										/>
										{category.name}
									</div>
								)}
								{tagInfo && (
									<div className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-gray-50 dark:bg-gray-800 border border-gray-100 dark:border-gray-700 text-[9px] font-bold">
										<div
											className="w-1.5 h-1.5 rounded-full"
											style={{ backgroundColor: tagInfo.color }}
										/>
										{task.tag}
									</div>
								)}
								{task.dueDate && (
									<div className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-blue-50/50 dark:bg-blue-900/20 border border-blue-100 dark:border-blue-900/30 text-[9px] font-bold text-blue-600 dark:text-blue-400">
										<Calendar className="w-2.5 h-2.5" />
										{formatDueDate(task.dueDate)}
									</div>
								)}
							</div>

							<div className="flex items-center justify-between pt-3 border-t border-gray-50 dark:border-gray-800/50">
								<div className="flex items-center gap-2 text-gray-400 font-mono text-[10px]">
									<Clock className="w-3 h-3" />
									{formatDuration(task.spentTime)}
								</div>
								<div className="flex items-center gap-1">
									<button
										onClick={() => onReenter(task.id)}
										className="p-2 rounded-xl hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-400 hover:text-blue-500"
									>
										<RotateCcw className="w-4 h-4" />
									</button>
									{!task.completed && (
										<button
											onClick={() => onTogglePlay(task.id)}
											className={`p-2 rounded-xl transition-all ${isActive ? "bg-orange-500 text-white" : "bg-blue-50 dark:bg-blue-900/30 text-blue-500"}`}
										>
											{isActive ? (
												<Pause className="w-4 h-4" />
											) : (
												<Play className="w-4 h-4" />
											)}
										</button>
									)}
								</div>
							</div>
						</div>
					</motion.div>
				);
			})}
		</div>
	);
};
