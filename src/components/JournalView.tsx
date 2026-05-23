import React, { useState, useMemo } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
	History,
	Plus,
	Send,
	Clock,
	CheckCircle2,
	Calendar as CalendarIcon,
	Zap,
	ArrowLeft,
	X,
	Circle,
	Trash2,
	Package,
	Pencil,
	ChevronLeft,
	ChevronRight,
	ChevronDown,
	Wand2,
	ArrowLeftIcon,
} from "lucide-react";
import { JournalEntry, Task, JournalType, Category } from "../types";
import { DEFAULT_CATEGORIES } from "../constants";
import { generateId, formatScheduledTime, formatScheduledDate } from "../utils";
import { CategoryIcon } from "./CategoryIcon";

interface JournalViewProps {
	onClose: () => void;
	tasks: Task[];
	categories: Category[];
	journalEntries: JournalEntry[];
	onAddEntry: (entry: Partial<JournalEntry>) => void;
	onUpdateEntry: (id: string, content: string) => void;
	onDeleteEntry: (id: string) => void;
	onToggleCompleteTask: (id: string) => void;
	onDeleteTask: (id: string) => void;
	onEditTask: (task: Task) => void;
	darkMode: boolean;
}

export default function JournalView({
	onClose,
	tasks,
	categories,
	journalEntries,
	onAddEntry,
	onUpdateEntry,
	onDeleteEntry,
	onToggleCompleteTask,
	onDeleteTask,
	onEditTask,
	darkMode,
}: JournalViewProps) {
	const [content, setContent] = useState("");
	const [type, setType] = useState<JournalType>("Event");
	const [editingEntryId, setEditingEntryId] = useState<string | null>(null);
	const [editingContent, setEditingContent] = useState("");
	const [selectedCategoryId, setSelectedCategoryId] = useState<
		string | undefined
	>(undefined);
	const [journalMode, setJournalMode] = useState<"timeline" | "day">(
		"timeline",
	);
	const [selectedDate, setSelectedDate] = useState<Date>(new Date());
	const [calendarViewDate, setCalendarViewDate] = useState<Date>(new Date());
	const [isCalendarOpen, setIsCalendarOpen] = useState(false);
	const [showTooltip, setShowTooltip] = useState(false);
	const [viewMode, setViewMode] = useState<"normal" | "mini">(() => {
		const saved = localStorage.getItem("journalViewMode");
		return (saved as "normal" | "mini") || "normal";
	});

	// Persist view mode to localStorage
	React.useEffect(() => {
		localStorage.setItem("journalViewMode", viewMode);
	}, [viewMode]);

	const getLocalDateStr = (dateOrTime: Date | number) => {
		const d =
			typeof dateOrTime === "number" ? new Date(dateOrTime) : dateOrTime;
		const year = d.getFullYear();
		const month = String(d.getMonth() + 1).padStart(2, "0");
		const day = String(d.getDate()).padStart(2, "0");
		return `${year}-${month}-${day}`;
	};

	const combinedItems = useMemo(() => {
		const completedTasks = tasks
			.filter((t) => t.completed && t.completedAt)
			.map((t) => ({
				id: `task-${t.id}`,
				content: t.name,
				type: "Task" as JournalType,
				timestamp: t.completedAt!,
				categoryId: t.categoryId,
				originalId: t.id,
				isCompletedTask: true,
				isScheduledActiveTask: false,
				task: t,
			}));

		const activeScheduledTasks = tasks
			.filter((t) => !t.completed && (t.startAt || t.dueDate))
			.map((t) => {
				let timestamp = t.createdAt;
				if (t.startAt) {
					timestamp = t.startAt;
				} else if (t.dueDate) {
					const [year, month, day] = t.dueDate.split("-").map(Number);
					timestamp = new Date(year, month - 1, day, 0, 0, 0, 0).getTime();
				}
				return {
					id: `scheduled-task-${t.id}`,
					content: t.name,
					type: "Task" as JournalType,
					timestamp,
					categoryId: t.categoryId,
					originalId: t.id,
					isCompletedTask: false,
					isScheduledActiveTask: true,
					task: t,
				};
			});

		const entries = journalEntries.map((e) => ({
			id: e.id,
			content: e.content,
			type: e.type,
			timestamp: e.timestamp,
			categoryId: e.categoryId,
			originalId: e.id,
			isCompletedTask: false,
			isScheduledActiveTask: false,
			task: undefined as Task | undefined,
		}));

		return [...completedTasks, ...activeScheduledTasks, ...entries].sort(
			(a, b) => b.timestamp - a.timestamp,
		);
	}, [tasks, journalEntries]);

	const activeDays = useMemo(() => {
		const days = new Set<string>();
		combinedItems.forEach((item) => {
			days.add(getLocalDateStr(item.timestamp));
		});
		return days;
	}, [combinedItems]);

	const filteredItems = useMemo(() => {
		if (journalMode === "day") {
			const targetStr = getLocalDateStr(selectedDate);
			return combinedItems.filter(
				(item) => getLocalDateStr(item.timestamp) === targetStr,
			);
		}
		return combinedItems;
	}, [combinedItems, journalMode, selectedDate]);

	const parseTimeFromContent = (
		text: string,
		baseDate: Date = new Date(),
	): { content: string; timestamp?: number } => {
		// Match @<time> patterns like @2pm, @3:30pm, @14:00, @2:30, etc.
		const timePattern = /@(\d{1,2})(?::(\d{2}))?\s*(am|pm)?/i;
		const match = text.match(timePattern);

		if (!match) {
			return { content: text };
		}

		let hours = parseInt(match[1]);
		const minutes = match[2] ? parseInt(match[2]) : 0;
		const meridiem = match[3]?.toLowerCase();

		// Handle 12-hour format
		if (meridiem) {
			if (meridiem === "pm" && hours !== 12) {
				hours += 12;
			} else if (meridiem === "am" && hours === 12) {
				hours = 0;
			}
		}

		// Create timestamp for baseDate at the specified time
		const timestamp = new Date(
			baseDate.getFullYear(),
			baseDate.getMonth(),
			baseDate.getDate(),
			hours,
			minutes,
		).getTime();

		// Remove the @time part from content
		const cleanContent = text.replace(timePattern, "").trim();

		return { content: cleanContent, timestamp };
	};

	const parseCategoryFromContent = (
		text: string,
	): { content: string; categoryId?: string } => {
		// Match category (#tag)
		const categoryMatch = text.match(/#(\w+)/);
		if (!categoryMatch) {
			return { content: text };
		}

		const tagName = categoryMatch[1].toLowerCase();
		const matchedCat = categories.find((c) => c.name.toLowerCase() === tagName);

		// Remove the #tag part from content
		const cleanContent = text.replace(/#\w+/g, "").replace(/\s+/g, " ").trim();

		return {
			content: cleanContent,
			...(matchedCat && { categoryId: matchedCat.id }),
		};
	};

	const handleContentChange = (val: string) => {
		setContent(val);

		// If user types #category, auto-select it in the state
		const categoryMatch = val.match(/#(\w+)/);
		if (categoryMatch) {
			const tagName = categoryMatch[1].toLowerCase();
			const matchedCat = categories.find(
				(c) => c.name.toLowerCase() === tagName,
			);
			if (matchedCat) {
				setSelectedCategoryId(matchedCat.id);
			}
		}
	};

	const handleSubmit = (e: React.FormEvent) => {
		e.preventDefault();
		if (!content.trim()) return;

		const baseDate = journalMode === "day" ? selectedDate : new Date();
		const { content: contentAfterTime, timestamp } = parseTimeFromContent(
			content,
			baseDate,
		);
		const { content: cleanContent, categoryId: parsedCategoryId } =
			parseCategoryFromContent(contentAfterTime);

		const finalCategoryId = parsedCategoryId || selectedCategoryId;

		let finalTimestamp = timestamp;
		if (!finalTimestamp) {
			if (journalMode === "day") {
				const now = new Date();
				finalTimestamp = new Date(
					selectedDate.getFullYear(),
					selectedDate.getMonth(),
					selectedDate.getDate(),
					now.getHours(),
					now.getMinutes(),
					now.getSeconds(),
				).getTime();
			} else {
				finalTimestamp = Date.now();
			}
		}

		onAddEntry({
			content: cleanContent,
			type,
			timestamp: finalTimestamp,
			...(finalCategoryId && { categoryId: finalCategoryId }),
		});
		setContent("");
		setSelectedCategoryId(undefined);
	};

	const handleStartEdit = (entry: (typeof combinedItems)[0]) => {
		if (!entry.isCompletedTask) {
			setEditingEntryId(entry.id);
			setEditingContent(entry.content);
		}
	};

	const handleCancelEdit = () => {
		setEditingEntryId(null);
		setEditingContent("");
	};

	const handleSaveEdit = (id: string) => {
		if (!editingContent.trim()) return;
		onUpdateEntry(id, editingContent.trim());
		setEditingEntryId(null);
		setEditingContent("");
	};

	const handleDateSelect = (date: Date) => {
		setSelectedDate(date);
		if (journalMode === "timeline") {
			const dateStr = getLocalDateStr(date);
			const element = document.getElementById(`date-section-${dateStr}`);
			if (element) {
				element.scrollIntoView({ behavior: "smooth", block: "start" });
			}
		}
	};

	const groupItemsByDate = (items: typeof combinedItems) => {
		const groups: { [date: string]: typeof combinedItems } = {};
		items.forEach((item) => {
			const date = new Date(item.timestamp).toLocaleDateString(undefined, {
				weekday: "long",
				month: "short",
				day: "numeric",
			});
			if (!groups[date]) groups[date] = [];
			groups[date].push(item);
		});
		return groups;
	};

	const groupedItems = groupItemsByDate(filteredItems);

	const currentMonth = calendarViewDate.getMonth();
	const currentYear = calendarViewDate.getFullYear();

	const calendarDays = useMemo(() => {
		const firstDayOfMonth = new Date(currentYear, currentMonth, 1);
		const startDayOfWeek = firstDayOfMonth.getDay(); // 0 is Sunday
		const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();

		const days = [];
		// Padding days from previous month
		for (let i = 0; i < startDayOfWeek; i++) {
			days.push(null);
		}
		// Current month days
		for (let day = 1; day <= daysInMonth; day++) {
			days.push(new Date(currentYear, currentMonth, day));
		}
		return days;
	}, [currentMonth, currentYear]);

	const handlePrevMonth = () => {
		setCalendarViewDate(new Date(currentYear, currentMonth - 1, 1));
	};

	const handleNextMonth = () => {
		setCalendarViewDate(new Date(currentYear, currentMonth + 1, 1));
	};

	const monthName = calendarViewDate.toLocaleDateString(undefined, {
		month: "long",
		year: "numeric",
	});

	const weekdays = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];

	return (
		<motion.div
			initial={{ x: "100%" }}
			animate={{ x: 0 }}
			exit={{ x: "100%" }}
			transition={{ type: "spring", damping: 25, stiffness: 200 }}
			className={`fixed inset-0 z-[100] flex flex-col ${darkMode ? "bg-gray-950 text-white" : "bg-white text-gray-900"}`}
		>
			{/* Header */}
			<div
				className={`journal-header px-6 py-6 border-b flex items-center justify-between ${darkMode ? "border-gray-800 bg-gray-950/80" : "border-gray-100 bg-white/80"} backdrop-blur-md sticky top-0 z-10`}
			>
				<div className="flex items-center gap-4">
					{/* <button
						onClick={onClose}
						className={`p-2 rounded-2xl transition-all ${darkMode ? "bg-gray-900 hover:bg-gray-800 text-gray-400" : "bg-gray-50 hover:bg-gray-100 text-gray-500"}`}
					>
						<ArrowLeft className="w-6 h-6" />
					</button> */}
					<div>
						<h2 className="text-xl font-black">Daily Journal</h2>
						<p className="text-[10px] uppercase font-bold tracking-widest text-blue-500">
							Activity & Wins
						</p>
					</div>
				</div>

				<div className="flex items-center gap-2">
					{/* View Mode Selector */}
					<div
						className={`p-0.5 rounded-xl flex gap-1 ${darkMode ? "bg-gray-900" : "bg-gray-100"}`}
					>
						<button
							type="button"
							onClick={() => setViewMode("normal")}
							className={`px-3 py-1.5 rounded-lg text-xs font-black uppercase tracking-wider transition-all cursor-pointer ${
								viewMode === "normal"
									? darkMode
										? "bg-gray-850 text-white shadow-lg"
										: "bg-white text-gray-900 shadow-sm"
									: "text-gray-400 hover:text-gray-350 dark:hover:text-gray-300"
							}`}
						>
							Normal
						</button>
						<button
							type="button"
							onClick={() => setViewMode("mini")}
							className={`px-3 py-1.5 rounded-lg text-xs font-black uppercase tracking-wider transition-all cursor-pointer ${
								viewMode === "mini"
									? darkMode
										? "bg-gray-850 text-white shadow-lg"
										: "bg-white text-gray-900 shadow-sm"
									: "text-gray-400 hover:text-gray-350 dark:hover:text-gray-300"
							}`}
						>
							Mini
						</button>
					</div>

					<div
						className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[10px] font-black uppercase text-blue-500 ${darkMode ? "bg-blue-500/10" : "bg-blue-50"}`}
					>
						<Zap className="w-3 h-3" />
						{combinedItems.length} Entries
					</div>
				</div>
			</div>

			{/* Sub-Header Controls */}
			<div
				className={`px-6 py-3 border-b flex flex-wrap items-center justify-between gap-3 ${
					darkMode
						? "border-gray-800/80 bg-gray-950/40"
						: "border-gray-100 bg-gray-50/50"
				}`}
			>
				{/* Mode Switcher */}
				<div
					className={`p-0.5 rounded-xl flex gap-1 ${darkMode ? "bg-gray-900" : "bg-gray-100"}`}
				>
					<button
						type="button"
						onClick={() => setJournalMode("day")}
						className={`px-3 py-1.5 rounded-lg text-xs font-black uppercase tracking-wider transition-all cursor-pointer ${
							journalMode === "day"
								? darkMode
									? "bg-gray-850 text-white shadow-lg"
									: "bg-white text-gray-900 shadow-sm"
								: "text-gray-400 hover:text-gray-350 dark:hover:text-gray-300"
						}`}
					>
						Day View
					</button>
					<button
						type="button"
						onClick={() => setJournalMode("timeline")}
						className={`px-3 py-1.5 rounded-lg text-xs font-black uppercase tracking-wider transition-all cursor-pointer ${
							journalMode === "timeline"
								? darkMode
									? "bg-gray-850 text-white shadow-lg"
									: "bg-white text-gray-900 shadow-sm"
								: "text-gray-400 hover:text-gray-350 dark:hover:text-gray-300"
						}`}
					>
						Timeline View
					</button>
				</div>

				{/* Date Picker Button */}
				<div className="flex items-center gap-2">
					<button
						type="button"
						onClick={() => {
							setIsCalendarOpen(!isCalendarOpen);
							setCalendarViewDate(selectedDate);
						}}
						className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 border shadow-sm cursor-pointer ${
							isCalendarOpen
								? "bg-blue-600 border-blue-600 text-white"
								: darkMode
									? "bg-gray-900 border-gray-800 text-gray-300 hover:bg-gray-800"
									: "bg-white border-gray-150 text-gray-600 hover:bg-gray-50"
						}`}
					>
						<CalendarIcon className="w-3.5 h-3.5" />
						<span>
							{selectedDate.toLocaleDateString(undefined, {
								weekday: "short",
								month: "short",
								day: "numeric",
								year: "numeric",
							})}
						</span>
						<ChevronDown
							className={`w-3.5 h-3.5 transition-transform duration-250 ${isCalendarOpen ? "rotate-180" : ""}`}
						/>
					</button>
				</div>
			</div>

			{/* Inline Calendar Drawer */}
			<AnimatePresence>
				{isCalendarOpen && (
					<motion.div
						initial={{ height: 0, opacity: 0 }}
						animate={{ height: "auto", opacity: 1 }}
						exit={{ height: 0, opacity: 0 }}
						transition={{ duration: 0.25, ease: "easeInOut" }}
						className={`border-b overflow-hidden ${
							darkMode
								? "bg-gray-900/60 border-gray-800"
								: "bg-gray-50/70 border-gray-150"
						}`}
					>
						<div className="max-w-2xl mx-auto p-6">
							{/* Month Navigation */}
							<div className="flex items-center justify-between mb-4">
								<span className="text-sm font-black uppercase tracking-wider">
									{monthName}
								</span>
								<div className="flex items-center gap-1">
									<button
										type="button"
										onClick={handlePrevMonth}
										className="p-1.5 rounded-xl hover:bg-gray-200 dark:hover:bg-gray-850 transition-colors cursor-pointer"
									>
										<ChevronLeft className="w-4 h-4" />
									</button>
									<button
										type="button"
										onClick={handleNextMonth}
										className="p-1.5 rounded-xl hover:bg-gray-200 dark:hover:bg-gray-850 transition-colors cursor-pointer"
									>
										<ChevronRight className="w-4 h-4" />
									</button>
								</div>
							</div>

							{/* Weekday Labels */}
							<div className="grid grid-cols-7 gap-1 text-center mb-2 border-b border-gray-100 dark:border-gray-800/40 pb-1">
								{weekdays.map((day) => (
									<span
										key={day}
										className="text-[10px] font-black text-gray-400 dark:text-gray-500 uppercase py-1"
									>
										{day}
									</span>
								))}
							</div>

							{/* Days Grid */}
							<div className="grid grid-cols-7 gap-1.5 text-center">
								{calendarDays.map((day, idx) => {
									if (!day) {
										return <div key={`empty-${idx}`} />;
									}

									const dateStr = getLocalDateStr(day);
									const hasEntries = activeDays.has(dateStr);
									const isSelected = getLocalDateStr(selectedDate) === dateStr;
									const isToday = getLocalDateStr(new Date()) === dateStr;

									return (
										<button
											key={dateStr}
											type="button"
											onClick={() => handleDateSelect(day)}
											className={`aspect-square rounded-full flex flex-col items-center justify-center text-xs font-bold transition-all relative cursor-pointer ${
												isSelected
													? "text-white scale-105"
													: isToday
														? "ring-2 ring-blue-500/50"
														: darkMode
															? "text-gray-300 hover:bg-gray-800"
															: "text-gray-700 hover:bg-gray-200"
											}`}
											style={
												isSelected
													? {
															backgroundColor: "#2563EB",
															boxShadow: `0 4px 12px rgba(37, 99, 235, 0.35)`,
														}
													: {}
											}
											title={dateStr}
										>
											<span>{day.getDate()}</span>
											{hasEntries && (
												<span
													className={`absolute bottom-1 w-1.5 h-1.5 rounded-full ${
														isSelected ? "bg-white" : "bg-blue-500"
													}`}
												/>
											)}
										</button>
									);
								})}
							</div>
						</div>
					</motion.div>
				)}
			</AnimatePresence>

			{/* Content */}
			<div className="flex-1 overflow-y-auto px-6 py-8 no-scrollbar scroll-smooth">
				<div className="max-w-2xl mx-auto space-y-10">
					{Object.entries(groupedItems).map(([date, items]) => {
						const dateStr =
							items.length > 0 ? getLocalDateStr(items[0].timestamp) : "";
						return (
							<div
								key={date}
								id={dateStr ? `date-section-${dateStr}` : undefined}
								className="space-y-4"
							>
								<h3
									className={`text-[10px] font-black uppercase tracking-[0.2em] px-4 py-1.5 rounded-lg inline-block ${darkMode ? "bg-gray-900 text-gray-500" : "bg-gray-50 text-gray-400"}`}
								>
									{date}
								</h3>
								<div className="space-y-3 pl-4 border-l-2 border-gray-100 dark:border-gray-800 ml-4">
									{items.map((item) => {
										const category = item.categoryId
											? categories.find((c) => c.id === item.categoryId)
											: undefined;
										const dotColor = category
											? category.color
											: item.type === "Task"
												? "#10B981"
												: "#F97316";

										return (
											<div
												key={item.id}
												className={`relative group ${viewMode === "mini" ? "overflow-visible" : ""}`}
											>
												<div
													className="absolute -left-[2.35rem] top-1/2 -translate-y-1/2 w-4 h-4 rounded-full border-4 border-white dark:border-gray-950 z-10 transition-all duration-300 group-hover:scale-125"
													style={{
														backgroundColor: dotColor,
														boxShadow: `0 0 8px ${dotColor}40`,
													}}
												/>

												<div
													className={`${viewMode === "mini" ? "p-2 rounded-xl" : "p-4 rounded-2xl"} border transition-all duration-300 hover:translate-x-1 ${darkMode ? "bg-gray-900 border-gray-800" : "bg-white border-gray-50 shadow-sm"}`}
												>
													{item.isScheduledActiveTask ? (
														<div className="flex flex-col gap-3">
															<div className="flex items-start justify-between gap-3">
																<div className="flex items-start gap-3 min-w-0 flex-1">
																	<button
																		onClick={(e) => {
																			e.stopPropagation();
																			onToggleCompleteTask(item.originalId);
																		}}
																		className="shrink-0 text-gray-400 hover:text-green-500 transition-colors mt-0.5"
																	>
																		<Circle className="w-5 h-5" />
																	</button>
																	<div className="min-w-0 flex-1">
																		<h4 className="text-sm font-bold text-gray-900 dark:text-white truncate">
																			{item.content}
																		</h4>
																		{category && viewMode === "normal" && (
																			<div className="mt-1 flex items-center gap-1.5 opacity-60">
																				<div
																					className="flex items-center justify-center p-0.5 rounded bg-gray-100 dark:bg-gray-800"
																					style={{ color: category.color }}
																				>
																					<CategoryIcon
																						name={category.iconName}
																						className="w-3 h-3"
																					/>
																				</div>
																				<span className="text-[9px] font-bold text-gray-500 uppercase tracking-widest">
																					{category.name}
																				</span>
																			</div>
																		)}
																	</div>
																</div>

																<div className="flex items-center gap-1 shrink-0">
																	<button
																		onClick={() => onEditTask(item.task!)}
																		className="p-1.5 text-gray-400 hover:text-blue-500 transition-colors"
																		title="Edit task"
																	>
																		<Pencil className="w-3.5 h-3.5" />
																	</button>
																	<button
																		onClick={() =>
																			onDeleteTask(item.originalId)
																		}
																		className="p-1.5 text-gray-400 hover:text-red-500 transition-colors"
																		title="Delete task"
																	>
																		<Trash2 className="w-3.5 h-3.5" />
																	</button>
																</div>
															</div>

															{viewMode === "mini" ? (
																// MINI MODE - Floating chips
																<div className="absolute -top-2 right-0 z-30 flex flex-row-reverse flex-wrap items-start gap-1 justify-end max-w-full pl-8">
																	{/* SCHEDULED TIME CHIP */}
																	<div className="flex items-center gap-1 bg-blue-600/90 backdrop-blur-sm text-white px-1.5 py-0.5 rounded-md border border-blue-500 shadow-sm text-[8px] font-mono">
																		<Clock className="w-2 h-2" />
																		{item.task?.startAt && item.task?.endAt
																			? `${new Date(
																					item.task.startAt,
																				).toLocaleTimeString([], {
																					hour: "numeric",
																					minute: "2-digit",
																				})} → ${new Date(
																					item.task.endAt,
																				).toLocaleTimeString([], {
																					hour: "numeric",
																					minute: "2-digit",
																				})}`
																			: formatScheduledTime(
																					item.task?.startAt || item.timestamp,
																					item.task?.endAt,
																					item.task?.duration,
																				)}
																	</div>

																	{/* DATE CHIP */}
																	{item.task?.dueDate && (
																		<div className="flex items-center gap-1 bg-gray-600/90 backdrop-blur-sm text-white px-1.5 py-0.5 rounded-md border border-gray-500 shadow-sm text-[8px]">
																			<CalendarIcon className="w-2 h-2" />
																			{formatScheduledDate(item.task.dueDate)}
																		</div>
																	)}

																	{/* CATEGORY CHIP */}
																	{category && (
																		<div
																			className="flex items-center gap-1 px-1.5 py-0.5 rounded-md border shadow-sm text-[8px] backdrop-blur-sm uppercase"
																			style={{
																				backgroundColor: `${category.color}90`,
																				borderColor: `${category.color}`,
																				color: "#fff",
																			}}
																		>
																			<CategoryIcon
																				name={category.iconName}
																				className="w-2 h-2"
																			/>
																			{category.name}
																		</div>
																	)}
																</div>
															) : (
																// NORMAL MODE - Inline chip
																<div className="flex items-center gap-1.5 text-xs font-semibold text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/30 px-2.5 py-1 rounded-xl w-fit border border-blue-100 dark:border-blue-900/35 shadow-sm">
																	<Clock className="w-3.5 h-3.5 animate-pulse" />
																	<span>
																		{item.task?.dueDate
																			? formatScheduledDate(item.task.dueDate)
																			: "Scheduled"}
																		:{" "}
																		{item.task?.startAt && item.task?.endAt
																			? `${new Date(
																					item.task.startAt,
																				).toLocaleTimeString([], {
																					hour: "numeric",
																					minute: "2-digit",
																				})} → ${new Date(
																					item.task.endAt,
																				).toLocaleTimeString([], {
																					hour: "numeric",
																					minute: "2-digit",
																				})}`
																			: formatScheduledTime(
																					item.task?.startAt || item.timestamp,
																					item.task?.endAt,
																					item.task?.duration,
																				)}
																	</span>
																</div>
															)}
														</div>
													) : editingEntryId === item.id ? (
														// EDIT MODE
														<div className="space-y-3">
															<textarea
																value={editingContent}
																onChange={(e) =>
																	setEditingContent(e.target.value)
																}
																className={`w-full px-3 py-2 rounded-xl border text-sm resize-none ${
																	darkMode
																		? "bg-gray-800 border-gray-700 text-gray-200"
																		: "bg-gray-50 border-gray-200 text-gray-900"
																} focus:outline-none focus:ring-2 focus:ring-blue-500`}
																rows={3}
																autoFocus
															/>
															<div className="flex items-center justify-end gap-2">
																<button
																	onClick={handleCancelEdit}
																	className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
																		darkMode
																			? "bg-gray-800 hover:bg-gray-700 text-gray-400"
																			: "bg-gray-100 hover:bg-gray-200 text-gray-600"
																	}`}
																>
																	Cancel
																</button>
																<button
																	onClick={() => handleSaveEdit(item.id)}
																	disabled={!editingContent.trim()}
																	className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
																		editingContent.trim()
																			? "bg-blue-600 hover:bg-blue-700 text-white"
																			: "bg-gray-200 text-gray-400 cursor-not-allowed"
																	}`}
																>
																	Save
																</button>
															</div>
														</div>
													) : (
														// VIEW MODE (existing content)
														<>
															{viewMode === "mini" ? (
																// MINI MODE
																<>
																	{/* Floating chips on top-right border */}
																	<div className="absolute -top-2 right-0 z-30 flex flex-row-reverse flex-wrap items-start gap-1 justify-end max-w-full pl-8">
																		{/* TIME CHIP */}
																		<div className="flex items-center gap-1 bg-gray-600/90 backdrop-blur-sm text-white px-1.5 py-0.5 rounded-md border border-gray-500 shadow-sm text-[8px] font-mono">
																			<Clock className="w-2 h-2" />
																			{item.task?.startAt && item.task?.endAt
																				? `${new Date(
																						item.task.startAt,
																					).toLocaleTimeString([], {
																						hour: "numeric",
																						minute: "2-digit",
																					})} → ${new Date(
																						item.task.endAt,
																					).toLocaleTimeString([], {
																						hour: "numeric",
																						minute: "2-digit",
																					})}`
																				: new Date(
																						item.timestamp,
																					).toLocaleTimeString([], {
																						hour: "2-digit",
																						minute: "2-digit",
																					})}
																		</div>

																		{/* TYPE CHIP */}
																		<span
																			className={`px-1.5 py-0.5 rounded-md font-black uppercase tracking-wider shrink-0 text-[8px] shadow-sm backdrop-blur-sm ${
																				item.type === "Task"
																					? "bg-green-500/90 text-white border border-green-400"
																					: "bg-orange-500/90 text-white border border-orange-400"
																			}`}
																		>
																			{item.type}
																		</span>

																		{/* CATEGORY CHIP */}
																		{category && (
																			<div
																				className="flex items-center gap-1 px-1.5 py-0.5 rounded-md border shadow-sm text-[8px] backdrop-blur-sm uppercase"
																				style={{
																					backgroundColor: `${category.color}90`,
																					borderColor: `${category.color}`,
																					color: "#fff",
																				}}
																			>
																				<CategoryIcon
																					name={category.iconName}
																					className="w-2 h-2"
																				/>
																				{category.name}
																			</div>
																		)}
																	</div>

																	{/* Compact content */}
																	<div className="flex items-center justify-between gap-2">
																		<div className="flex items-center gap-2 min-w-0 flex-1">
																			{category ? (
																				<div
																					className="flex items-center justify-center p-0.5 rounded shrink-0"
																					style={{
																						color: category.color,
																						backgroundColor: `${category.color}15`,
																					}}
																				>
																					<CategoryIcon
																						name={category.iconName}
																						className="w-3 h-3"
																					/>
																				</div>
																			) : item.type === "Task" ? (
																				<CheckCircle2 className="w-3.5 h-3.5 text-green-500 shrink-0" />
																			) : (
																				<Package className="w-3.5 h-3.5 text-orange-500 shrink-0" />
																			)}
																			<p
																				className={`text-xs font-bold truncate ${darkMode ? "text-gray-300" : "text-gray-700"}`}
																			>
																				{item.content}
																			</p>
																		</div>
																		{!item.isCompletedTask && (
																			<div className="flex items-center gap-0.5 shrink-0">
																				<button
																					onClick={() => handleStartEdit(item)}
																					className="p-1 text-gray-400 hover:text-blue-500 transition-colors"
																					title="Edit entry"
																				>
																					<Pencil className="w-3 h-3" />
																				</button>
																				<button
																					onClick={() => onDeleteEntry(item.id)}
																					className="p-1 text-gray-400 hover:text-red-500 transition-colors"
																					title="Delete entry"
																				>
																					<Trash2 className="w-3 h-3" />
																				</button>
																			</div>
																		)}
																	</div>
																</>
															) : (
																// NORMAL MODE
																<>
																	<div className="flex items-center justify-between mb-2">
																		<div className="flex items-center gap-2">
																			{category ? (
																				<div
																					className="flex items-center justify-center p-1 rounded-lg"
																					style={{
																						color: category.color,
																						backgroundColor: `${category.color}15`,
																					}}
																				>
																					<CategoryIcon
																						name={category.iconName}
																						className="w-3.5 h-3.5"
																					/>
																				</div>
																			) : item.type === "Task" ? (
																				<CheckCircle2 className="w-4 h-4 text-green-500" />
																			) : (
																				<Package className="w-4 h-4 text-orange-500" />
																			)}
																			<span
																				className={`text-[9px] font-black uppercase tracking-tighter px-1.5 py-0.5 rounded ${item.type === "Task" ? "bg-green-500/10 text-green-500" : "bg-orange-500/10 text-orange-500"}`}
																			>
																				{item.type}
																			</span>
																			<span className="text-[10px] font-mono text-gray-400">
																				{item.task?.startAt && item.task?.endAt
																					? `${new Date(
																							item.task.startAt,
																						).toLocaleTimeString([], {
																							hour: "numeric",
																							minute: "2-digit",
																						})} → ${new Date(
																							item.task.endAt,
																						).toLocaleTimeString([], {
																							hour: "numeric",
																							minute: "2-digit",
																						})}`
																					: new Date(
																							item.timestamp,
																						).toLocaleTimeString([], {
																							hour: "2-digit",
																							minute: "2-digit",
																						})}
																			</span>
																		</div>
																		{!item.isCompletedTask && (
																			<div className="flex items-center gap-1">
																				<button
																					onClick={() => handleStartEdit(item)}
																					className="p-1.5 text-gray-400 hover:text-blue-500 transition-colors"
																					title="Edit entry"
																				>
																					<Pencil className="w-3.5 h-3.5" />
																				</button>
																				<button
																					onClick={() => onDeleteEntry(item.id)}
																					className="p-1.5 text-gray-400 hover:text-red-500 transition-colors"
																					title="Delete entry"
																				>
																					<Trash2 className="w-3.5 h-3.5" />
																				</button>
																			</div>
																		)}
																	</div>
																	<p
																		className={`text-sm font-medium ${darkMode ? "text-gray-300" : "text-gray-700"}`}
																	>
																		{item.content}
																	</p>
																	{item.categoryId &&
																		categories.find(
																			(c) => c.id === item.categoryId,
																		) && (
																			<div className="mt-3 flex items-center gap-1.5 opacity-60">
																				<div
																					className="w-1.5 h-1.5 rounded-full"
																					style={{
																						backgroundColor: categories.find(
																							(c) => c.id === item.categoryId,
																						)?.color,
																					}}
																				/>
																				<span className="text-[9px] font-bold text-gray-500 uppercase tracking-widest">
																					{
																						categories.find(
																							(c) => c.id === item.categoryId,
																						)?.name
																					}
																				</span>
																			</div>
																		)}
																</>
															)}
														</>
													)}
												</div>
											</div>
										);
									})}
								</div>
							</div>
						);
					})}

					{filteredItems.length === 0 && (
						<div className="text-center py-20 opacity-30">
							<History className="w-12 h-12 mx-auto mb-4" />
							<p className="text-sm font-bold uppercase tracking-widest">
								{journalMode === "day"
									? "No entries for this day"
									: "No history yet"}
							</p>
						</div>
					)}
				</div>
			</div>

			{/* Input Bar */}
			<div
				className={`p-6 border-t ${darkMode ? "bg-gray-950 border-gray-800" : "bg-white border-gray-100"}`}
			>
				<div className="max-w-2xl mx-auto">
					<form onSubmit={handleSubmit} className="relative">
						<div
							className={`p-2 rounded-[24px] border transition-all flex flex-col gap-2 ${darkMode ? "bg-gray-900 border-gray-800" : "bg-gray-50 border-gray-100"}`}
						>
							{/* Type Selector Pill Bar */}
							<div className="flex items-center justify-between gap-2 px-2 pt-1 border-b border-gray-100 dark:border-gray-800/60 pb-2">
								<div className="flex items-center gap-2">
									<button
										type="button"
										onClick={() => setType("Event")}
										className={`px-3 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${type === "Event" ? "bg-orange-500 text-white shadow-lg" : "text-gray-500 hover:text-gray-300"}`}
									>
										General Entry
									</button>
									<button
										type="button"
										onClick={() => setType("Task")}
										className={`px-3 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${type === "Task" ? "bg-green-500 text-white shadow-lg" : "text-gray-500 hover:text-gray-300"}`}
									>
										Quick Log
									</button>
								</div>

								{/* Mobile Back Button */}
								<button
									onClick={onClose}
									className={`md:hidden p-3 rounded-full shadow-lg transition-all active:scale-95`}
									style={{ boxShadow: "0 4px 12px rgba(0, 0, 0, 0.15)" }}
								>
									<ArrowLeftIcon className="w-5 h-5" />
								</button>
							</div>

							{/* Category Selector Pill Bar */}
							<div className="flex flex-wrap gap-1.5 px-2 pb-1.5 pt-0.5 border-b border-dashed border-gray-100 dark:border-gray-800/40">
								{categories.map((cat) => {
									const isSelected = selectedCategoryId === cat.id;
									return (
										<button
											key={cat.id}
											type="button"
											onClick={() =>
												setSelectedCategoryId(isSelected ? undefined : cat.id)
											}
											className={`px-2.5 py-1 rounded-xl text-[9px] font-black uppercase tracking-wider transition-all flex items-center gap-1.5 border ${
												isSelected
													? "text-white shadow-sm"
													: darkMode
														? "bg-gray-800/40 border-gray-800 text-gray-400 hover:bg-gray-800"
														: "bg-gray-100 border-gray-200 text-gray-500 hover:bg-gray-200"
											}`}
											style={
												isSelected
													? {
															backgroundColor: cat.color,
															borderColor: cat.color,
															boxShadow: `0 2px 6px ${cat.color}30`,
														}
													: {}
											}
										>
											<span
												className="w-1.5 h-1.5 rounded-full"
												style={{
													backgroundColor: isSelected ? "#fff" : cat.color,
												}}
											/>
											{cat.name}
										</button>
									);
								})}
							</div>

							{/* Input Bar */}
							<div className="flex items-center gap-3 pr-2">
								<input
									type="text"
									value={content}
									onChange={(e) => handleContentChange(e.target.value)}
									placeholder={
										type === "Event"
											? "Write a journal entry... Use #Work for category @3pm for time"
											: "Log something you just did... Use #Work @3pm"
									}
									className="flex-1 bg-transparent px-3 py-2 text-sm outline-none border-none placeholder-gray-500 text-gray-800 dark:text-gray-100"
								/>
								<div className="relative flex items-center shrink-0">
									<button
										type="button"
										onClick={() => setShowTooltip(!showTooltip)}
										onMouseEnter={() => setShowTooltip(true)}
										onMouseLeave={() => setShowTooltip(false)}
										className="p-2 text-gray-400 hover:text-blue-500 transition-colors"
										title="Smart Input Magic"
									>
										<Wand2 className="w-4 h-4" />
									</button>
									<AnimatePresence>
										{showTooltip && (
											<motion.div
												initial={{ opacity: 0, scale: 0.95, y: 10 }}
												animate={{ opacity: 1, scale: 1, y: 0 }}
												exit={{ opacity: 0, scale: 0.95, y: 10 }}
												className="absolute right-0 bottom-full mb-2 w-64 p-4 bg-gray-950 dark:bg-gray-800 text-white rounded-2xl shadow-2xl z-[110] border border-gray-850 dark:border-gray-700 text-[10px] space-y-2 pointer-events-none"
											>
												<p className="font-black text-blue-400 uppercase tracking-wider mb-1 text-xs flex items-center gap-1.5">
													<Wand2 className="w-3.5 h-3.5 text-blue-400 animate-pulse" />
													Journal Parsing Guide
												</p>
												<div className="space-y-1 text-gray-300">
													<p>
														<b className="text-white">#Category:</b> Use{" "}
														<code className="bg-black/25 px-1 py-0.5 rounded text-purple-300 font-mono">
															#work
														</code>{" "}
														or{" "}
														<code className="bg-black/25 px-1 py-0.5 rounded text-purple-300 font-mono">
															#gym
														</code>
													</p>
													<p>
														<b className="text-white">@Log Time:</b> Use{" "}
														<code className="bg-black/25 px-1 py-0.5 rounded text-green-300 font-mono">
															@2pm
														</code>{" "}
														or{" "}
														<code className="bg-black/25 px-1 py-0.5 rounded text-green-300 font-mono">
															@14:30
														</code>{" "}
														to log entry at a specific time
													</p>
												</div>
												<div className="pt-1.5 border-t border-white/10 text-[9px] text-gray-400 italic">
													Example: Did code review #work @3pm
												</div>
											</motion.div>
										)}
									</AnimatePresence>
								</div>
								<button
									type="submit"
									disabled={!content.trim()}
									className={`p-2.5 rounded-xl transition-all ${content.trim() ? "bg-blue-600 text-white hover:bg-blue-700" : "bg-gray-200 text-gray-400"}`}
								>
									<Send className="w-5 h-5" />
								</button>
							</div>
						</div>
					</form>
				</div>
			</div>
		</motion.div>
	);
}
