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
	Inbox as InboxIcon,
} from "lucide-react";
import { Task, Category, Tag } from "../types";
import { CategoryIcon } from "./CategoryIcon";
import { TAGS } from "../constants";
import {
	parseSmartInput,
	formatDueDate,
	formatScheduledTime,
	formatDateToInput,
} from "../utils";

interface InboxViewProps {
	tasks: Task[];
	categories: Category[];
	onAddTask: (name: string) => void;
	onAssignCategory: (taskId: string, categoryId: string) => void;
	onUpdateTask: (taskId: string, updates: Partial<Task>) => void;
	onDeleteTask: (taskId: string) => void;
	darkMode: boolean;
}

export default function InboxView({
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
	const [expandedDropdown, setExpandedDropdown] = useState<{
		taskId: string;
		type: "category" | "tag" | "date" | "time";
	} | null>(null);

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

	const handleTagChange = (taskId: string, tag: Tag) => {
		onUpdateTask(taskId, { tag });
		setExpandedDropdown(null);
	};

	const handleDateChange = (taskId: string, dateStr: string) => {
		onUpdateTask(taskId, { dueDate: dateStr });
		setExpandedDropdown(null);
	};

	return (
		<motion.div
			initial={{ opacity: 0, y: 8 }}
			animate={{ opacity: 1, y: 0 }}
			exit={{ opacity: 0, y: 8 }}
			transition={{ duration: 0.18, ease: "easeOut" }}
			className={`flex-1 min-h-0 flex flex-col rounded-3xl overflow-hidden ${darkMode ? "bg-gray-950 text-white" : "bg-white text-gray-900"}`}
		>
					{/* Quick Add Bar */}
					<div
						className={`px-3 py-2 border-b ${darkMode ? "border-gray-800/80 bg-gray-950/40" : "border-gray-100 bg-gray-50/50"}`}
					>
						<form onSubmit={handleQuickAdd} className="flex gap-2">
							<input
								type="text"
								value={quickAddValue}
								onChange={(e) => setQuickAddValue(e.target.value)}
								placeholder="Quick capture... !today @3pm ~1h #quick"
								className={`flex-1 ${darkMode ? "bg-gray-900 border-gray-800 text-white placeholder-gray-600" : "bg-white border-gray-200 text-gray-900 placeholder-gray-400"} border rounded-xl px-3 py-2 text-[13px] focus:outline-none focus:ring-2 focus:ring-purple-500 transition-all`}
							/>
							<button
								type="submit"
								className="w-9 h-9 flex items-center justify-center bg-purple-600 hover:bg-purple-700 text-white rounded-xl transition-colors shrink-0"
							>
								<Plus className="w-4 h-4" />
							</button>
							<div
								className={`flex items-center gap-1.5 px-2.5 rounded-xl text-[10px] font-black uppercase text-purple-500 shrink-0 ${darkMode ? "bg-purple-500/10" : "bg-purple-50"}`}
							>
								<InboxIcon className="w-3 h-3" />
								{inboxTasks.length}
							</div>
						</form>
					</div>

					{/* Task List */}
					<div className="flex-1 overflow-y-auto px-6 py-8 no-scrollbar">
						<div className="max-w-2xl mx-auto space-y-3">
							{inboxTasks.length === 0 ? (
								<div className="flex flex-col items-center justify-center py-12 text-gray-400">
									<div className="w-16 h-16 rounded-full bg-gray-100 dark:bg-gray-800 flex items-center justify-center mb-3">
										<InboxIcon className="w-8 h-8" />
									</div>
									<p className="text-sm font-semibold">Inbox is empty</p>
									<p className="text-xs mt-1">Quick capture tasks here</p>
								</div>
							) : (
								inboxTasks.map((task) => {
									const isEditing = editingTaskId === task.id;
									const tagInfo = TAGS.find((t) => t.label === task.tag);

									return (
										<motion.div
											key={task.id}
											layout
											initial={{ opacity: 0, y: 10 }}
											animate={{ opacity: 1, y: 0 }}
											exit={{ opacity: 0, y: -10 }}
											className={`relative overflow-visible p-2 rounded-xl border transition-all ${
												expandedDropdown?.taskId === task.id ? "z-50" : "z-10"
											} ${darkMode ? "bg-gray-900 border-gray-800" : "bg-white border-gray-50 shadow-sm"}`}
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
														className={`flex-1 ${darkMode ? "bg-gray-950 border-gray-700 text-white" : "bg-white border-gray-300 text-gray-900"} border rounded-lg px-2 py-1.5 text-[13px] focus:outline-none focus:ring-2 focus:ring-purple-500`}
													/>
													<button
														onClick={() => handleSaveEdit(task.id)}
														className="w-7 h-7 flex items-center justify-center bg-green-600 hover:bg-green-700 text-white rounded-lg transition-colors"
													>
														<Check className="w-3.5 h-3.5" />
													</button>
													<button
														onClick={handleCancelEdit}
														className={`w-7 h-7 flex items-center justify-center ${darkMode ? "bg-gray-700 hover:bg-gray-600 text-gray-300" : "bg-gray-300 hover:bg-gray-400 text-gray-700"} rounded-lg transition-colors`}
													>
														<X className="w-3.5 h-3.5" />
													</button>
												</div>
											) : (
												<>
													{/* Floating chips on top-right border */}
													<div className="absolute -top-2 right-0 z-30 flex flex-row-reverse flex-wrap items-start gap-1 justify-end max-w-full pl-8">
														{/* Category Assign Chip */}
														<div className="relative">
															<button
																onClick={() =>
																	setExpandedDropdown(
																		expandedDropdown?.taskId === task.id &&
																			expandedDropdown?.type === "category"
																			? null
																			: { taskId: task.id, type: "category" },
																	)
																}
																className="flex items-center gap-1 px-1.5 py-0.5 bg-purple-600/90 backdrop-blur-sm border border-purple-500 rounded-md shadow-sm text-[8px] font-bold text-white hover:bg-purple-700/90 transition-colors"
															>
																<span>Assign Category</span>
																<ChevronDown className="w-2.5 h-2.5" />
															</button>

															<AnimatePresence>
																{expandedDropdown?.taskId === task.id &&
																	expandedDropdown?.type === "category" && (
																		<motion.div
																			initial={{ opacity: 0, y: -4 }}
																			animate={{ opacity: 1, y: 0 }}
																			exit={{ opacity: 0, y: -4 }}
																			className={`absolute right-0 top-full mt-1 ${darkMode ? "bg-gray-900 border-gray-800" : "bg-white border-gray-200"} border rounded-xl shadow-lg z-40 p-2 min-w-[140px]`}
																		>
																			{categories.map((cat) => (
																				<button
																					key={cat.id}
																					onClick={() => {
																						onAssignCategory(task.id, cat.id);
																						setExpandedDropdown(null);
																					}}
																					className={`w-full flex items-center gap-2 px-2 py-1.5 ${darkMode ? "hover:bg-gray-800" : "hover:bg-gray-100"} rounded-lg transition-colors text-left`}
																				>
																					<CategoryIcon
																						name={cat.iconName}
																						className="w-3 h-3"
																						style={{ color: cat.color }}
																					/>
																					<span
																						className={`text-[11px] font-semibold ${darkMode ? "text-white" : "text-gray-900"}`}
																					>
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
															<div className="relative">
																<button
																	onClick={() =>
																		setExpandedDropdown(
																			expandedDropdown?.taskId === task.id &&
																				expandedDropdown?.type === "tag"
																				? null
																				: { taskId: task.id, type: "tag" },
																		)
																	}
																	className="px-1.5 py-0.5 rounded-md font-black uppercase tracking-wider text-[8px] shadow-sm backdrop-blur-sm border flex items-center gap-1"
																	style={{
																		backgroundColor: `${tagInfo.color}90`,
																		color: "#fff",
																		borderColor: tagInfo.color,
																	}}
																>
																	{task.tag}
																	<ChevronDown className="w-2.5 h-2.5" />
																</button>

																<AnimatePresence>
																	{expandedDropdown?.taskId === task.id &&
																		expandedDropdown?.type === "tag" && (
																			<motion.div
																				initial={{ opacity: 0, y: -4 }}
																				animate={{ opacity: 1, y: 0 }}
																				exit={{ opacity: 0, y: -4 }}
																				className={`absolute right-0 top-full mt-1 ${darkMode ? "bg-gray-900 border-gray-800" : "bg-white border-gray-200"} border rounded-xl shadow-lg z-40 p-2 min-w-[120px]`}
																			>
																				{TAGS.map((t) => (
																					<button
																						key={t.label}
																						onClick={() =>
																							handleTagChange(
																								task.id,
																								t.label as Tag,
																							)
																						}
																						className={`w-full flex items-center gap-2 px-2 py-1.5 ${darkMode ? "hover:bg-gray-800" : "hover:bg-gray-100"} rounded-lg transition-colors text-left`}
																					>
																						<div
																							className="w-2 h-2 rounded-full"
																							style={{
																								backgroundColor: t.color,
																							}}
																						/>
																						<span
																							className={`text-[11px] font-semibold ${darkMode ? "text-white" : "text-gray-900"}`}
																						>
																							{t.label}
																						</span>
																					</button>
																				))}
																			</motion.div>
																		)}
																</AnimatePresence>
															</div>
														)}

														{/* Due date chip */}
														{task.dueDate && (
															<div className="relative">
																<button
																	onClick={() =>
																		setExpandedDropdown(
																			expandedDropdown?.taskId === task.id &&
																				expandedDropdown?.type === "date"
																				? null
																				: { taskId: task.id, type: "date" },
																		)
																	}
																	className={`flex items-center gap-1 px-1.5 py-0.5 ${darkMode ? "bg-blue-600/90 border-blue-500" : "bg-blue-600/90 border-blue-500"} backdrop-blur-sm border rounded-md shadow-sm text-[8px] font-bold text-white`}
																>
																	<Calendar className="w-2.5 h-2.5" />
																	{formatDueDate(task.dueDate)}
																	<ChevronDown className="w-2.5 h-2.5" />
																</button>

																<AnimatePresence>
																	{expandedDropdown?.taskId === task.id &&
																		expandedDropdown?.type === "date" && (
																			<motion.div
																				initial={{ opacity: 0, y: -4 }}
																				animate={{ opacity: 1, y: 0 }}
																				exit={{ opacity: 0, y: -4 }}
																				className={`absolute right-0 top-full mt-1 ${darkMode ? "bg-gray-900 border-gray-800" : "bg-white border-gray-200"} border rounded-xl shadow-lg z-40 p-3 min-w-[160px]`}
																			>
																				<input
																					type="date"
																					value={task.dueDate}
																					onChange={(e) =>
																						handleDateChange(
																							task.id,
																							e.target.value,
																						)
																					}
																					className={`w-full ${darkMode ? "bg-gray-800 border-gray-700 text-white" : "bg-gray-50 border-gray-200 text-gray-900"} border rounded-lg px-2 py-1.5 text-[11px] focus:outline-none focus:ring-2 focus:ring-blue-500`}
																				/>
																			</motion.div>
																		)}
																</AnimatePresence>
															</div>
														)}

														{/* Schedule chip */}
														{task.startAt && (
															<span className="flex items-center gap-1 bg-green-600/90 backdrop-blur-sm text-white px-1.5 py-0.5 rounded-md border border-green-500 shadow-sm text-[8px] font-mono">
																<Clock className="w-2.5 h-2.5" />
																{formatScheduledTime(
																	task.startAt,
																	task.endAt,
																	task.duration,
																)}
															</span>
														)}
													</div>

													{/* Task content */}
													<div className="flex items-center justify-between gap-2">
														<p
															className={`flex-1 text-[13px] font-semibold ${darkMode ? "text-white" : "text-gray-900"} leading-snug truncate`}
														>
															{task.name}
														</p>
														<div className="flex items-center gap-1 shrink-0">
															<button
																onClick={() => handleStartEdit(task)}
																className={`w-6 h-6 flex items-center justify-center ${darkMode ? "hover:bg-gray-800" : "hover:bg-gray-200"} rounded-lg transition-colors`}
																title="Edit task"
															>
																<Edit3 className="w-3 h-3 text-gray-400" />
															</button>
															<button
																onClick={() => onDeleteTask(task.id)}
																className={`w-6 h-6 flex items-center justify-center ${darkMode ? "hover:bg-gray-800" : "hover:bg-gray-200"} rounded-lg transition-colors`}
																title="Delete task"
															>
																<X className="w-3 h-3 text-red-400 hover:text-red-500" />
															</button>
														</div>
													</div>
												</>
											)}
										</motion.div>
									);
								})
							)}
						</div>
					</div>

		</motion.div>
	);
}
