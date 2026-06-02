import React from "react";
import { Task, Category } from "../types";
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

interface TaskTableProps {
	tasks: Task[];
	categories: Category[];
	activeTaskId: string | null;
	activeTaskIds?: string[];
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
	activeTaskIds = activeTaskId ? [activeTaskId] : [],
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
						const isActive = activeTaskIds.includes(task.id) && timerActive;

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
									{task.topics && task.topics.length > 0 && (
										<div className="flex flex-wrap gap-1 mt-1">
											{task.topics.map((t) => (
												<span
													key={t}
													className="text-[8px] font-black uppercase tracking-wider bg-teal-50 dark:bg-teal-950/30 text-teal-600 dark:text-teal-400 px-1 py-0.25 rounded border border-teal-100/60 dark:border-teal-900/30"
												>
													#{t}
												</span>
											))}
										</div>
									)}
									{task.description && (
										<p className="text-[10px] text-gray-400 truncate max-w-[200px] mt-0.5">
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
