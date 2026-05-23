import React, { useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
	X,
	Plus,
	ChevronDown,
	Edit3,
	Check,
	Calendar,
	Clock,
} from "lucide-react";
import { Task, Category } from "../types";
import { CategoryIcon } from "./CategoryIcon";
import { TAGS } from "../constants";
import {
	parseSmartInput,
	formatDueDate,
	formatScheduledTime,
	formatDateToInput,
} from "../utils";

interface InboxViewProps {
	isOpen: boolean;
	onClose: () => void;
	tasks: Task[];
	categories: Category[];
	onAddTask: (name: string) => void;
	onAssignCategory: (taskId: string, categoryId: string) => void;
	onUpdateTask: (taskId: string, updates: Partial<Task>) => void;
	onDeleteTask: (taskId: string) => void;
	darkMode: boolean;
}

export default function InboxView({
	isOpen,
	onClose,
	tasks,
	categories,
	onAddTask,
	onAssignCategory,
	onUpdateTask,
	onDeleteTask,
	darkMode,
}: InboxViewProps) {
	const [quickAddValue, setQuickAddValue] = useState("");
	const [editingTaskId, setEditingTaskId] = useState<string | null>(null);
	const [editValue, setEditValue] = useState("");
	const [expandedCategoryId, setExpandedCategoryId] = useState<string | null>(
		null,
	);

	const inboxTasks = tasks.filter((t) => t.inbox && !t.completed);

	const handleQuickAdd = (e: React.FormEvent) => {
		e.preventDefault();
		if (!quickAddValue.trim()) return;
		onAddTask(quickAddValue);
		setQuickAddValue("");
	};

	const handleStartEdit = (task: Task) => {
		setEditingTaskId(task.id);
		setEditValue(task.name);
	};

	const handleSaveEdit = (taskId: string) => {
		if (!editValue.trim()) return;

		const parsed = parseSmartInput(editValue);
		const { cleanName, relativeDate, tag, startTimeStr, durationMs } = parsed;

		let startAt: number | undefined;
		let durationVal: number | undefined;
		let endAt: number | undefined;

		if (startTimeStr) {
			const dateStr = relativeDate
				? formatDateToInput(relativeDate)
				: formatDateToInput(new Date());
			const [hours, minutes] = startTimeStr.split(":").map(Number);
			const [year, month, day] = dateStr.split("-").map(Number);
			startAt = new Date(year, month - 1, day, hours, minutes, 0, 0).getTime();

			if (durationMs) {
				durationVal = durationMs;
				endAt = startAt + durationVal;
			}
		}

		onUpdateTask(taskId, {
			name: cleanName,
			tag: tag || undefined,
			dueDate: relativeDate ? formatDateToInput(relativeDate) : undefined,
			startAt,
			duration: durationVal,
			endAt,
		});

		setEditingTaskId(null);
		setEditValue("");
	};

	const handleCancelEdit = () => {
		setEditingTaskId(null);
		setEditValue("");
	};

	return (
		<AnimatePresence>
			{isOpen && (
				<>
					{/* Backdrop */}
					<motion.div
						initial={{ opacity: 0 }}
						animate={{ opacity: 1 }}
						exit={{ opacity: 0 }}
						className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[60]"
						onClick={onClose}
					/>

					{/* Sheet */}
					<motion.div
						initial={{ y: "100%" }}
						animate={{ y: 0 }}
						exit={{ y: "100%" }}
						transition={{ type: "spring", damping: 28, stiffness: 320 }}
						className="fixed inset-x-0 bottom-0 bg-white dark:bg-gray-950 rounded-t-3xl z-[70] max-h-[92vh] flex flex-col shadow-2xl"
					>
						{/* Header */}
						<div className="flex-none px-5 pt-4 pb-3 border-b border-gray-100 dark:border-gray-800">
							<div className="w-9 h-1 bg-gray-200 dark:bg-gray-700 rounded-full mx-auto mb-3" />
							<div className="flex items-center gap-3">
								<button
									type="button"
									onClick={onClose}
									className="w-8 h-8 flex items-center justify-center rounded-xl hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors shrink-0"
								>
									<X className="w-4 h-4 text-gray-400" />
								</button>
								<h2 className="flex-1 text-[15px] font-black text-gray-900 dark:text-white tracking-tight">
									Inbox ({inboxTasks.length})
								</h2>
							</div>
						</div>

						{/* Quick Add */}
						<div className="flex-none px-5 py-3 border-b border-gray-100 dark:border-gray-800">
							<form onSubmit={handleQuickAdd} className="flex gap-2">
								<input
									type="text"
									value={quickAddValue}
									onChange={(e) => setQuickAddValue(e.target.value)}
									placeholder="Quick capture... !today @3pm ~1h #quick"
									className="flex-1 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl px-3 py-2 text-[13px] focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-600"
								/>
								<button
									type="submit"
									className="w-9 h-9 flex items-center justify-center bg-blue-600 hover:bg-blue-700 text-white rounded-xl transition-colors shrink-0"
								>
									<Plus className="w-4 h-4" />
								</button>
							</form>
						</div>

						{/* Task List */}
						<div className="flex-1 overflow-y-auto px-5 py-3">
							{inboxTasks.length === 0 ? (
								<div className="flex flex-col items-center justify-center py-12 text-gray-400">
									<div className="w-16 h-16 rounded-full bg-gray-100 dark:bg-gray-800 flex items-center justify-center mb-3">
										<Plus className="w-8 h-8" />
									</div>
									<p className="text-sm font-semibold">Inbox is empty</p>
									<p className="text-xs mt-1">Quick capture tasks here</p>
								</div>
							) : (
								<div className="space-y-2">
									{inboxTasks.map((task) => {
										const isEditing = editingTaskId === task.id;
										const tagInfo = TAGS.find((t) => t.label === task.tag);

										return (
											<motion.div
												key={task.id}
												layout
												initial={{ opacity: 0, y: 10 }}
												animate={{ opacity: 1, y: 0 }}
												exit={{ opacity: 0, y: -10 }}
												className="relative bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl p-3"
											>
												{isEditing ? (
													<div className="flex items-center gap-2">
														<input
															autoFocus
															type="text"
															value={editValue}
															onChange={(e) => setEditValue(e.target.value)}
															onKeyDown={(e) => {
																if (e.key === "Enter") {
																	handleSaveEdit(task.id);
																} else if (e.key === "Escape") {
																	handleCancelEdit();
																}
															}}
															className="flex-1 bg-white dark:bg-gray-950 border border-gray-300 dark:border-gray-700 rounded-lg px-2 py-1.5 text-[13px] focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 dark:text-white"
														/>
														<button
															onClick={() => handleSaveEdit(task.id)}
															className="w-7 h-7 flex items-center justify-center bg-green-600 hover:bg-green-700 text-white rounded-lg transition-colors"
														>
															<Check className="w-3.5 h-3.5" />
														</button>
														<button
															onClick={handleCancelEdit}
															className="w-7 h-7 flex items-center justify-center bg-gray-300 dark:bg-gray-700 hover:bg-gray-400 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300 rounded-lg transition-colors"
														>
															<X className="w-3.5 h-3.5" />
														</button>
													</div>
												) : (
													<>
														<div className="flex items-start gap-2 mb-2">
															<p className="flex-1 text-[13px] font-semibold text-gray-900 dark:text-white leading-snug">
																{task.name}
															</p>
															<button
																onClick={() => handleStartEdit(task)}
																className="w-6 h-6 flex items-center justify-center hover:bg-gray-200 dark:hover:bg-gray-800 rounded-lg transition-colors shrink-0"
															>
																<Edit3 className="w-3 h-3 text-gray-400" />
															</button>
														</div>

														{/* Metadata chips */}
														<div className="flex flex-wrap items-center gap-1.5">
															{/* Category Assign Button */}
															<div className="relative">
																<button
																	onClick={() =>
																		setExpandedCategoryId(
																			expandedCategoryId === task.id
																				? null
																				: task.id,
																		)
																	}
																	className="flex items-center gap-1 px-2 py-0.5 bg-purple-100 dark:bg-purple-900/30 border border-purple-200 dark:border-purple-800 rounded-full text-[9px] font-bold text-purple-700 dark:text-purple-300 hover:bg-purple-200 dark:hover:bg-purple-900/50 transition-colors"
																>
																	<span>Assign Category</span>
																	<ChevronDown className="w-2.5 h-2.5" />
																</button>

																{/* Category Dropdown */}
																<AnimatePresence>
																	{expandedCategoryId === task.id && (
																		<motion.div
																			initial={{ opacity: 0, y: -4 }}
																			animate={{ opacity: 1, y: 0 }}
																			exit={{ opacity: 0, y: -4 }}
																			className="absolute top-full left-0 mt-1 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl shadow-lg z-10 p-2 min-w-[140px]"
																		>
																			{categories.map((cat) => (
																				<button
																					key={cat.id}
																					onClick={() => {
																						onAssignCategory(task.id, cat.id);
																						setExpandedCategoryId(null);
																					}}
																					className="w-full flex items-center gap-2 px-2 py-1.5 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors text-left"
																				>
																					<CategoryIcon
																						name={cat.iconName}
																						className="w-3 h-3"
																						style={{ color: cat.color }}
																					/>
																					<span className="text-[11px] font-semibold text-gray-900 dark:text-white">
																						{cat.name}
																					</span>
																				</button>
																			))}
																		</motion.div>
																	)}
																</AnimatePresence>
															</div>

															{/* Tag chip */}
															{tagInfo && (
																<span
																	className="px-1.5 py-0.5 rounded-full text-[8px] font-black uppercase tracking-wider"
																	style={{
																		backgroundColor: `${tagInfo.color}20`,
																		color: tagInfo.color,
																	}}
																>
																	{task.tag}
																</span>
															)}

															{/* Due date chip */}
															{task.dueDate && (
																<span className="flex items-center gap-1 px-1.5 py-0.5 bg-blue-50 dark:bg-blue-900/20 border border-blue-100 dark:border-blue-900/30 rounded-full text-[8px] font-bold text-blue-600 dark:text-blue-400">
																	<Calendar className="w-2.5 h-2.5" />
																	{formatDueDate(task.dueDate)}
																</span>
															)}

															{/* Schedule chip */}
															{task.startAt && (
																<span className="flex items-center gap-1 px-1.5 py-0.5 bg-green-50 dark:bg-green-900/20 border border-green-100 dark:border-green-900/30 rounded-full text-[8px] font-bold text-green-600 dark:text-green-400">
																	<Clock className="w-2.5 h-2.5" />
																	{formatScheduledTime(
																		task.startAt,
																		task.endAt,
																		task.duration,
																	)}
																</span>
															)}
														</div>
													</>
												)}
											</motion.div>
										);
									})}
								</div>
							)}
						</div>
					</motion.div>
				</>
			)}
		</AnimatePresence>
	);
}
