import React, { useState, useEffect, useMemo } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
	X,
	Calendar,
	Flag,
	Tag as TagIcon,
	AlignLeft,
	Wand2,
	RefreshCw,
	Clock,
	Check,
	Plus,
	HelpCircle,
} from "lucide-react";

import { Task, Category, Tag } from "../types";
import { TAGS } from "../constants";
import {
	parseSmartInput,
	formatDateToInput,
	combineDateAndTime,
	formatTimeOfDate,
	formatDurationShort,
	formatDueDate,
} from "../utils";
import { CategoryIcon, CATEGORY_ICONS } from "./CategoryIcon";
import { HABIT_COLORS } from "../colors";

interface TaskFormProps {
	isOpen: boolean;
	onClose: () => void;
	onSubmit: (task: Partial<Task>) => void;
	initialTask?: Task;
	categories: Category[];
	selectedCategoryId: string;
	defaultRecurring?: boolean;
	darkMode: boolean;
}

export default function TaskForm({
	isOpen,
	onClose,
	onSubmit,
	initialTask,
	categories,
	selectedCategoryId,
	defaultRecurring,
	darkMode,
}: TaskFormProps) {
	const [isRecurring, setIsRecurring] = useState(
		initialTask?.isRecurring || defaultRecurring || false,
	);
	const [recurringIcon, setRecurringIcon] = useState(
		initialTask?.recurringIcon || "Flame",
	);
	const [recurringColor, setRecurringColor] = useState(
		initialTask?.recurringColor || HABIT_COLORS[0].value,
	);

	const defaultCat = categories.find((c) => c.isDefault) || categories[0];
	const initialCatIdFromContext =
		selectedCategoryId === "all" ? defaultCat?.id || "1" : selectedCategoryId;

	const [name, setName] = useState(initialTask?.name || "");
	const [description, setDescription] = useState(
		initialTask?.description || "",
	);
	const [categoryId, setCategoryId] = useState(
		initialTask?.categoryId || initialCatIdFromContext,
	);
	const [tag, setTag] = useState<Tag>(initialTask?.tag || "explore");
	const [dueDate, setDueDate] = useState(initialTask?.dueDate || "");
	const [startTime, setStartTime] = useState("");
	const [duration, setDuration] = useState("");
	const [showTooltip, setShowTooltip] = useState(false);
	const parsedName = useMemo(() => parseSmartInput(name), [name]);
	const hasParsedNameTokens =
		!!parsedName.categoryName ||
		!!parsedName.relativeDate ||
		!!parsedName.startTimeStr ||
		!!parsedName.durationMs ||
		!!parsedName.tag ||
		!!parsedName.isRecurring;

	useEffect(() => {
		if (isOpen) {
			setName(initialTask?.name || "");
			setDescription(initialTask?.description || "");
			setCategoryId(initialTask?.categoryId || initialCatIdFromContext);
			setTag(initialTask?.tag || "explore");
			setDueDate(initialTask?.dueDate || "");
			setIsRecurring(initialTask?.isRecurring || defaultRecurring || false);
			setRecurringIcon(initialTask?.recurringIcon || "Flame");
			setRecurringColor(initialTask?.recurringColor || HABIT_COLORS[0].value);

			if (initialTask?.startAt) {
				const date = new Date(initialTask.startAt);
				const hours = String(date.getHours()).padStart(2, "0");
				const minutes = String(date.getMinutes()).padStart(2, "0");
				setStartTime(`${hours}:${minutes}`);
			} else {
				setStartTime("");
			}

			if (initialTask?.duration) {
				setDuration(String(Math.round(initialTask.duration / (60 * 1000))));
			} else {
				setDuration("");
			}
		}
	}, [
		isOpen,
		initialTask,
		categories,
		initialCatIdFromContext,
		defaultRecurring,
	]);

	const handleNameChange = (val: string) => {
		setName(val);
		const { categoryName, relativeDate, startTimeStr, durationMs } =
			parseSmartInput(val);

		if (categoryName) {
			const found = categories.find(
				(c) => c.name.toLowerCase() === categoryName.toLowerCase(),
			);
			if (found) setCategoryId(found.id);
		}

		if (relativeDate) {
			setDueDate(formatDateToInput(relativeDate));
		}

		if (startTimeStr) {
			setStartTime(startTimeStr);
			if (!dueDate) {
				setDueDate(formatDateToInput(new Date()));
			}
		}

		if (durationMs) {
			setDuration(String(Math.round(durationMs / (60 * 1000))));
		}
	};

	const handleSubmit = (e: React.FormEvent) => {
		e.preventDefault();
		if (!name.trim()) return;

		const { cleanName } = parseSmartInput(name);

		let startAt: number | undefined;
		let durationVal: number | undefined;
		let endAt: number | undefined;

		if (startTime) {
			const dateStr = dueDate || formatDateToInput(new Date());
			startAt = combineDateAndTime(dateStr, startTime);

			if (duration && !isNaN(Number(duration))) {
				durationVal = Number(duration) * 60 * 1000;
				endAt = startAt + durationVal;
			}
		}

		onSubmit({
			name: cleanName,
			description: description.trim() || undefined,
			categoryId,
			tag,
			dueDate:
				dueDate || (startTime ? formatDateToInput(new Date()) : undefined),
			isRecurring,
			recurringIcon: isRecurring ? recurringIcon : undefined,
			recurringColor: isRecurring ? recurringColor : undefined,
			startAt,
			duration: durationVal,
			endAt,
		});
		onClose();
	};

	const selectedCat = categories.find((c) => c.id === categoryId);
	const parsedCategory = parsedName.categoryName
		? categories.find(
				(c) =>
					c.name.toLowerCase() === parsedName.categoryName?.toLowerCase(),
			)
		: undefined;

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
						{/* ── HEADER ── */}
						<div className="flex-none px-5 pt-4 pb-3 border-b border-gray-100 dark:border-gray-800">
							{/* Drag handle */}
							<div className="w-9 h-1 bg-gray-200 dark:bg-gray-700 rounded-full mx-auto mb-3" />

							<div className="flex items-center gap-3">
								{/* Close */}
								<button
									type="button"
									onClick={onClose}
									className="w-8 h-8 flex items-center justify-center rounded-xl hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors shrink-0"
								>
									<X className="w-4 h-4 text-gray-400" />
								</button>

								<h2 className="flex-1 text-[15px] font-black text-gray-900 dark:text-white tracking-tight">
									{initialTask ? "Edit Task" : "New Task"}
								</h2>

								{/* Submit in header */}
								<button
									type="submit"
									form="task-form"
									className="flex items-center gap-1.5 px-4 py-1.5 bg-blue-600 hover:bg-blue-700 active:scale-95 text-white rounded-xl text-xs font-bold transition-all shadow-md shadow-blue-500/25"
								>
									{initialTask ? (
										<>
											<Check className="w-3.5 h-3.5" />
											Save
										</>
									) : (
										<>
											<Plus className="w-3.5 h-3.5" />
											Create
										</>
									)}
								</button>
							</div>
						</div>

						{/* ── SCROLLABLE BODY ── */}
						<div className="flex-1 overflow-y-auto">
							<form
								id="task-form"
								onSubmit={handleSubmit}
								className="px-5 py-4 space-y-5"
							>
								{/* Task Name + Tooltip */}
								<div className="relative">
									<div className="flex items-center justify-between mb-1.5">
										<label className="text-[10px] uppercase tracking-widest font-black text-gray-400 dark:text-gray-500">
											Task Name
										</label>
										{/* Magic Input tooltip trigger */}
										<div className="relative">
											<button
												type="button"
												onClick={() => setShowTooltip(!showTooltip)}
												onMouseEnter={() => setShowTooltip(true)}
												onMouseLeave={() => setShowTooltip(false)}
												className="flex items-center gap-1 opacity-50 hover:opacity-100 transition-opacity"
											>
												<HelpCircle className="w-3.5 h-3.5 text-blue-500" />
												<span className="text-[9px] font-bold text-blue-500 uppercase tracking-tight">
													Smart Input
												</span>
											</button>

											<AnimatePresence>
												{showTooltip && (
													<motion.div
														initial={{ opacity: 0, scale: 0.95, y: 6 }}
														animate={{ opacity: 1, scale: 1, y: 0 }}
														exit={{ opacity: 0, scale: 0.95, y: 6 }}
														transition={{ duration: 0.15 }}
														className="absolute right-0 top-full mt-2 w-64 p-3.5 bg-gray-900 dark:bg-gray-800 text-white rounded-2xl shadow-2xl z-[80] border border-white/10 pointer-events-none"
													>
														<p className="text-[10px] font-black text-blue-400 uppercase tracking-wider mb-2">
															Smart Input Guide
														</p>
														<div className="space-y-1.5 text-[10px] text-gray-300">
															<p>
																<span className="text-purple-300 font-mono font-bold">
																	?work
																</span>{" "}
																→ Set category
															</p>
															<p>
																<span className="text-blue-300 font-mono font-bold">
																	!today
																</span>
																{" · "}
																<span className="text-blue-300 font-mono font-bold">
																	!tomorrow
																</span>
																{" · "}
																<span className="text-blue-300 font-mono font-bold">
																	!2026-05-22
																</span>{" "}
																→ Date
															</p>
															<p>
																<span className="text-green-300 font-mono font-bold">
																	at2pm
																</span>
																{" · "}
																<span className="text-green-300 font-mono font-bold">
																	at1pm30
																</span>{" "}
																→ Start time
															</p>
															<p>
																<span className="text-orange-300 font-mono font-bold">
																	for30m
																</span>
																{" · "}
																<span className="text-orange-300 font-mono font-bold">
																	for1h30
																</span>{" "}
																→ Duration
															</p>
															<p>
																<span className="text-red-300 font-mono font-bold">
																	#quick
																</span>
																{" · "}
																<span className="text-red-300 font-mono font-bold">
																	#explore
																</span>
																{" · "}
																<span className="text-red-300 font-mono font-bold">
																	#finish
																</span>
																{" · "}
																<span className="text-red-300 font-mono font-bold">
																	#handle
																</span>{" "}
																→ Tag
															</p>
														</div>
														<div className="mt-2 pt-2 border-t border-white/10 text-[9px] text-gray-500 italic leading-relaxed">
															e.g. "Read book ?study !today at3pm for1h30 #quick"
														</div>
													</motion.div>
												)}
											</AnimatePresence>
										</div>
									</div>

									<input
										autoFocus
										type="text"
										value={name}
										onChange={(e) => handleNameChange(e.target.value)}
										placeholder='e.g. "Read book ?study !today at3pm for1h30 #quick"'
										className="w-full text-[15px] font-semibold bg-transparent border-b-2 border-gray-100 dark:border-gray-800 pb-2 focus:border-blue-500 outline-none transition-colors text-gray-900 dark:text-white placeholder-gray-300 dark:placeholder-gray-700"
									/>
									<AnimatePresence>
										{name.trim() && hasParsedNameTokens && (
											<motion.div
												initial={{ opacity: 0, y: -4 }}
												animate={{ opacity: 1, y: 0 }}
												exit={{ opacity: 0, y: -4 }}
												className={`mt-2 rounded-xl border px-3 py-2 ${
													darkMode
														? "bg-gray-900/70 border-gray-800"
														: "bg-gray-50 border-gray-100"
												}`}
											>
												<div className="flex items-center gap-2 min-w-0">
													<Wand2 className="w-3.5 h-3.5 text-blue-500 shrink-0" />
													<span className="text-[10px] font-black uppercase tracking-widest text-gray-400 shrink-0">
														Will create
													</span>
													<span className="text-xs font-bold truncate text-gray-700 dark:text-gray-200">
														{parsedName.cleanName || name.trim()}
													</span>
												</div>
												<div className="mt-2 flex flex-wrap gap-1.5">
													{parsedCategory && (
														<span className="text-[9px] px-2 py-0.5 rounded-full bg-purple-500 text-white font-bold uppercase tracking-wide">
															{parsedCategory.name}
														</span>
													)}
													{parsedName.relativeDate && (
														<span className="text-[9px] px-2 py-0.5 rounded-full bg-blue-500 text-white font-bold uppercase tracking-wide">
															{formatDueDate(formatDateToInput(parsedName.relativeDate))}
														</span>
													)}
													{parsedName.startTimeStr && (
														<span className="text-[9px] px-2 py-0.5 rounded-full bg-emerald-500 text-white font-bold uppercase tracking-wide">
															{parsedName.startTimeStr}
														</span>
													)}
													{parsedName.durationMs && (
														<span className="text-[9px] px-2 py-0.5 rounded-full bg-amber-500 text-white font-bold uppercase tracking-wide">
															{formatDurationShort(parsedName.durationMs)}
														</span>
													)}
													{parsedName.tag && (
														<span className="text-[9px] px-2 py-0.5 rounded-full bg-orange-500 text-white font-bold uppercase tracking-wide">
															{parsedName.tag}
														</span>
													)}
													{parsedName.isRecurring && (
														<span className="text-[9px] px-2 py-0.5 rounded-full bg-green-500 text-white font-bold uppercase tracking-wide">
															{parsedName.recurringPattern || "recurring"}
														</span>
													)}
												</div>
											</motion.div>
										)}
									</AnimatePresence>
								</div>

								{/* Description */}
								<div>
									<label className="flex items-center gap-1 text-[10px] uppercase tracking-widest font-black text-gray-400 dark:text-gray-500 mb-1.5">
										<AlignLeft className="w-3 h-3" />
										Description
									</label>
									<textarea
										value={description}
										onChange={(e) => setDescription(e.target.value)}
										placeholder="Add details (optional)..."
										rows={2}
										className="w-full bg-gray-50 dark:bg-gray-900 border border-gray-100 dark:border-gray-800 rounded-xl px-3 py-2 text-[13px] focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all text-gray-700 dark:text-gray-300 placeholder-gray-400 dark:placeholder-gray-600 resize-none"
									/>
								</div>

								{/* Category + Priority row */}
								<div className="grid grid-cols-2 gap-4">
									{/* Category */}
									<div>
										<label className="flex items-center gap-1 text-[10px] uppercase tracking-widest font-black text-gray-400 dark:text-gray-500 mb-1.5">
											<TagIcon className="w-3 h-3" />
											Category
										</label>
										<div className="flex flex-wrap gap-1.5">
											{categories.map((cat) => (
												<button
													key={cat.id}
													type="button"
													onClick={() => setCategoryId(cat.id)}
													className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all border ${
														categoryId === cat.id
															? "bg-blue-600 border-blue-600 text-white shadow-sm shadow-blue-500/20"
															: "bg-gray-50 dark:bg-gray-900 border-gray-100 dark:border-gray-800 text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800"
													}`}
												>
													<CategoryIcon
														name={cat.iconName}
														className={`w-3 h-3 ${categoryId === cat.id ? "text-white" : ""}`}
														style={
															categoryId !== cat.id ? { color: cat.color } : {}
														}
													/>
													{cat.name}
												</button>
											))}
										</div>
									</div>

									{/* Tag */}
									<div>
										<label className="flex items-center gap-1 text-[10px] uppercase tracking-widest font-black text-gray-400 dark:text-gray-500 mb-1.5">
											<Flag className="w-3 h-3" />
											Tag
										</label>
										<div className="flex gap-1.5">
											{(["quick", "explore", "finish", "handle"] as Tag[]).map(
												(t) => {
													const tInfo = TAGS.find((prev) => prev.label === t);
													return (
														<button
															key={t}
															type="button"
															onClick={() => setTag(t)}
															className={`flex-1 py-1.5 rounded-lg text-[11px] font-bold transition-all border uppercase ${
																tag === t
																	? "bg-white dark:bg-gray-900 shadow-sm ring-1"
																	: "bg-gray-50 dark:bg-gray-900 border-transparent text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
															}`}
															style={{
																borderColor:
																	tag === t ? tInfo?.color : "transparent",
																color: tag === t ? tInfo?.color : undefined,
															}}
														>
															{t}
														</button>
													);
												},
											)}
										</div>
									</div>
								</div>

								{/* Date / Start Time / Duration */}
								<div>
									<label className="text-[10px] uppercase tracking-widest font-black text-gray-400 dark:text-gray-500 mb-1.5 block">
										Schedule
									</label>
									<div className="grid grid-cols-3 gap-2">
										{/* Date */}
										<div className="relative">
											<Calendar className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400 pointer-events-none" />
											<input
												type="date"
												value={dueDate}
												onChange={(e) => setDueDate(e.target.value)}
												className="w-full bg-gray-50 dark:bg-gray-900 border border-gray-100 dark:border-gray-800 rounded-xl pl-7 pr-2 py-2 text-[11px] font-bold focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all text-gray-700 dark:text-gray-300"
											/>
										</div>

										{/* Start Time */}
										<div className="relative">
											<Clock className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400 pointer-events-none" />
											<input
												type="time"
												value={startTime}
												onChange={(e) => {
													setStartTime(e.target.value);
													if (e.target.value && !dueDate) {
														setDueDate(formatDateToInput(new Date()));
													}
												}}
												className="w-full bg-gray-50 dark:bg-gray-900 border border-gray-100 dark:border-gray-800 rounded-xl pl-7 pr-2 py-2 text-[11px] font-bold focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all text-gray-700 dark:text-gray-300"
											/>
										</div>

										{/* Duration */}
										<div className="relative">
											<Clock className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400 pointer-events-none" />
											<input
												type="number"
												min="1"
												value={duration}
												onChange={(e) => setDuration(e.target.value)}
												disabled={!startTime}
												placeholder={startTime ? "min" : "—"}
												className={`w-full bg-gray-50 dark:bg-gray-900 border border-gray-100 dark:border-gray-800 rounded-xl pl-7 pr-2 py-2 text-[11px] font-bold focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all text-gray-700 dark:text-gray-300 ${
													!startTime ? "opacity-40 cursor-not-allowed" : ""
												}`}
											/>
										</div>
									</div>

									{/* Calculated schedule preview */}
									<AnimatePresence>
										{startTime &&
											duration &&
											!isNaN(Number(duration)) &&
											Number(duration) > 0 && (
												<motion.div
													initial={{ opacity: 0, height: 0 }}
													animate={{ opacity: 1, height: "auto" }}
													exit={{ opacity: 0, height: 0 }}
													className="overflow-hidden"
												>
													<div className="mt-2 px-3 py-2 rounded-xl bg-blue-50 dark:bg-blue-950/40 border border-blue-100 dark:border-blue-900/40 flex items-center justify-between">
														<span className="text-[10px] font-bold text-blue-500 uppercase tracking-wide">
															Schedule
														</span>
														<span className="text-[11px] font-mono font-bold text-blue-600 dark:text-blue-400">
															{(() => {
																const dateStr =
																	dueDate || formatDateToInput(new Date());
																const start = combineDateAndTime(
																	dateStr,
																	startTime,
																);
																const end =
																	start + Number(duration) * 60 * 1000;
																return `${formatTimeOfDate(start)} – ${formatTimeOfDate(end)}`;
															})()}
														</span>
													</div>
												</motion.div>
											)}
									</AnimatePresence>
								</div>

								{/* Recurring Habit */}
								<div
									className={`rounded-2xl border transition-all ${
										isRecurring
											? darkMode
												? "bg-gray-900 border-gray-800"
												: "bg-white border-gray-100 shadow-sm"
											: darkMode
												? "bg-gray-900/60 border-gray-800"
												: "bg-gray-50 border-gray-100"
									}`}
								>
									{/* Toggle row */}
									<button
										type="button"
										onClick={() => setIsRecurring(!isRecurring)}
										className="w-full flex items-center gap-3 px-4 py-3"
									>
										<div
											className={`w-7 h-7 rounded-xl flex items-center justify-center shrink-0 ${
												isRecurring
													? "bg-orange-500/10 text-orange-500"
													: "bg-gray-100 dark:bg-gray-800 text-gray-400"
											}`}
										>
											<RefreshCw className="w-3.5 h-3.5" />
										</div>
										<div className="flex-1 text-left">
											<p className="text-[13px] font-black text-gray-900 dark:text-white">
												Recurring Habit
											</p>
											<p className="text-[10px] text-gray-500 leading-none mt-0.5">
												Repeat this task daily
											</p>
										</div>
										{/* Toggle pill */}
										<div
											className={`relative w-9 h-5 rounded-full transition-all shrink-0 ${
												isRecurring
													? "bg-orange-500"
													: "bg-gray-200 dark:bg-gray-700"
											}`}
										>
											<div
												className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${
													isRecurring ? "translate-x-4" : ""
												}`}
											/>
										</div>
									</button>

									{/* Expanded habit options */}
									{isRecurring && (
										<motion.div
											initial={{ height: 0, opacity: 0 }}
											animate={{ height: "auto", opacity: 1 }}
											className="px-4 pb-4 space-y-4 border-t border-gray-100 dark:border-gray-800 pt-3"
										>
											{/* Icon picker */}
											<div>
												<label className="block text-[10px] uppercase tracking-widest font-black text-gray-400 dark:text-gray-500 mb-2">
													Icon
												</label>
												<div className="grid grid-cols-8 gap-1.5">
													{Object.keys(CATEGORY_ICONS).map((iconName) => (
														<button
															key={iconName}
															type="button"
															onClick={() => setRecurringIcon(iconName)}
															className={`aspect-square rounded-xl flex items-center justify-center transition-all border ${
																recurringIcon === iconName
																	? "text-white border-transparent shadow scale-105"
																	: darkMode
																		? "bg-gray-800 border-gray-700 text-gray-400 hover:bg-gray-700"
																		: "bg-gray-50 border-gray-100 text-gray-500 hover:bg-gray-100"
															}`}
															style={
																recurringIcon === iconName
																	? { backgroundColor: recurringColor }
																	: {}
															}
														>
															<CategoryIcon
																name={iconName}
																className="w-3.5 h-3.5"
															/>
														</button>
													))}
												</div>
											</div>

											{/* Color picker */}
											<div>
												<label className="block text-[10px] uppercase tracking-widest font-black text-gray-400 dark:text-gray-500 mb-2">
													Color
												</label>
												<div className="grid grid-cols-9 gap-1.5 max-h-[120px] overflow-y-auto pr-1">
													{HABIT_COLORS.map((color) => (
														<button
															key={color.value}
															type="button"
															onClick={() => setRecurringColor(color.value)}
															className={`aspect-square rounded-lg transition-all border-2 ${
																recurringColor === color.value
																	? "border-gray-900 dark:border-white scale-110 shadow"
																	: "border-transparent hover:scale-105"
															}`}
															style={{ backgroundColor: color.value }}
															title={color.name}
														>
															{recurringColor === color.value && (
																<div className="w-full h-full flex items-center justify-center">
																	<div className="w-1.5 h-1.5 bg-white rounded-full shadow" />
																</div>
															)}
														</button>
													))}
												</div>
											</div>
										</motion.div>
									)}
								</div>

								{/* Bottom safe-area spacing */}
								<div className="h-4" />
							</form>
						</div>
					</motion.div>
				</>
			)}
		</AnimatePresence>
	);
}
