import React, { useState, useRef, useEffect, useMemo } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
	Play,
	Pause,
	Square,
	CheckCircle2,
	Search,
	Plus,
	X,
	Trash2,
	Clock,
	RotateCcw,
	Wand2,
	Trophy,
	FileText,
	ChevronUp,
	ChevronDown,
	Send,
	Layers,
} from "lucide-react";
import { Task, Category } from "../types";
import {
	formatDateToInput,
	formatDueDate,
	formatDuration,
	formatDurationShort,
	formatTimer,
	parseSmartInput,
} from "../utils";

interface WorkingBarProps {
	tasks: Task[];
	categories: Category[];
	activeTask: Task | null;
	activeSessionTasks: Task[];
	timerActive: boolean;
	onSelectTask: (id: string) => void;
	onAddTaskToSession: (id: string) => void;
	onRemoveTaskFromSession: (id: string) => void;
	onAddTask: (name: string, categoryId: string) => void;
	onToggleTimer: () => void;
	onStopTimer: () => void;
	onFinishTask: (id: string) => void;
	onDeleteTask: (id: string) => void;
	onReenterTask: (id: string) => void;
	onAddSessionLog: (
		content: string,
		type: "SessionLog" | "Achievement",
	) => void;
	darkMode: boolean;
}

export default function WorkingBar({
	tasks,
	categories,
	activeTask,
	activeSessionTasks,
	timerActive,
	onSelectTask,
	onAddTaskToSession,
	onRemoveTaskFromSession,
	onAddTask,
	onToggleTimer,
	onStopTimer,
	onFinishTask,
	onDeleteTask,
	onReenterTask,
	onAddSessionLog,
	darkMode,
}: WorkingBarProps) {
	const [input, setInput] = useState("");
	const [isFocused, setIsFocused] = useState(false);
	const [showTooltip, setShowTooltip] = useState(false);
	const [showSessionTaskPicker, setShowSessionTaskPicker] = useState(false);
	const [sessionTaskQuery, setSessionTaskQuery] = useState("");
	const containerRef = useRef<HTMLDivElement>(null);
	const parsedInput = useMemo(() => parseSmartInput(input), [input]);
	const parsedCategory = parsedInput.categoryName
		? categories.find(
				(c) =>
					c.name.toLowerCase() === parsedInput.categoryName?.toLowerCase(),
			)
		: undefined;
	const hasParsedInputTokens =
		!!parsedInput.categoryName ||
		!!parsedInput.relativeDate ||
		!!parsedInput.startTimeStr ||
		!!parsedInput.durationMs ||
		!!parsedInput.tag ||
		!!parsedInput.isRecurring;

	// Session log state
	const [logInput, setLogInput] = useState("");
	const [logType, setLogType] = useState<"SessionLog" | "Achievement">(
		"SessionLog",
	);
	const [showSessionLog, setShowSessionLog] = useState(true);
	const [showNiceFeedback, setShowNiceFeedback] = useState(false);
	const niceFeedbackTimeoutRef = useRef<NodeJS.Timeout | null>(null);

	const handleSubmitLog = () => {
		if (!logInput.trim() || !activeTask) return;
		onAddSessionLog(
			logInput.trim(),
			logType,
		);
		setLogInput("");
		// Show "Nice !!!" feedback
		setShowNiceFeedback(true);
		if (niceFeedbackTimeoutRef.current) {
			clearTimeout(niceFeedbackTimeoutRef.current);
		}
		niceFeedbackTimeoutRef.current = setTimeout(() => {
			setShowNiceFeedback(false);
		}, 1800);
	};

	const handleLogKeyDown = (e: React.KeyboardEvent) => {
		if (e.key === "Enter" && logInput.trim()) {
			e.preventDefault();
			handleSubmitLog();
		}
	};

	const suggestions = tasks
		.filter(
			(t) => !t.completed && t.name.toLowerCase().includes(input.toLowerCase()),
		)
		.slice(0, 5);
	const workingTasks =
		activeSessionTasks.length > 0
			? activeSessionTasks
			: activeTask
				? [activeTask]
				: [];
	const sessionTaskIds = new Set(workingTasks.map((task) => task.id));
	const sessionTaskSuggestions = tasks
		.filter(
			(t) =>
				!t.completed &&
				!sessionTaskIds.has(t.id) &&
				t.name.toLowerCase().includes(sessionTaskQuery.toLowerCase()),
		)
		.slice(0, 5);

	const handleClickOutside = (e: MouseEvent) => {
		if (
			containerRef.current &&
			!containerRef.current.contains(e.target as Node)
		) {
			setIsFocused(false);
			setShowSessionTaskPicker(false);
		}
	};

	useEffect(() => {
		document.addEventListener("mousedown", handleClickOutside);
		return () => document.removeEventListener("mousedown", handleClickOutside);
	}, []);

	const handleKeyDown = (e: React.KeyboardEvent) => {
		if (e.key === "Enter" && input.trim()) {
			const exactMatch = tasks.find(
				(t) =>
					t.name.toLowerCase() === input.trim().toLowerCase() && !t.completed,
			);
			if (exactMatch) {
				onSelectTask(exactMatch.id);
			} else {
				const { categoryName } = parseSmartInput(input.trim());
				let catId = categories[0]?.id;
				if (categoryName) {
					const found = categories.find(
						(c) => c.name.toLowerCase() === categoryName.toLowerCase(),
					);
					if (found) catId = found.id;
				}
				onAddTask(input.trim(), catId);
			}
			setInput("");
			setIsFocused(false);
		}
	};

	return (
		<div ref={containerRef} className="relative flex-1 w-full">
			<AnimatePresence mode="wait">
				{activeTask ? (
					<>
						<motion.div
							key="active"
							initial={{ opacity: 0, y: -10 }}
							animate={{ opacity: 1, y: 0 }}
							exit={{ opacity: 0, y: 10 }}
							className={`flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3 p-3 sm:p-1.5 sm:pl-4 rounded-xl sm:rounded-xl border shadow-lg transition-all ${
								darkMode
									? "bg-blue-600 border-blue-500 text-white"
									: "bg-blue-600 border-blue-500 text-white"
							}`}
						>
							{/* Task Info + Timer (Stacked on mobile) */}
							<div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3 flex-1 min-w-0">
								<div className="flex-1 min-w-0">
									<p className="text-[10px] font-black uppercase tracking-widest text-blue-200 mb-0.5">
										{workingTasks.length > 1 ? "Working set" : "Working on"}
									</p>
									<h3 className="text-sm font-bold truncate leading-tight">
										{workingTasks.length > 1
											? `${workingTasks.length} tasks together`
											: activeTask.name}
									</h3>
									{workingTasks.length > 1 && (
										<div className="mt-1 flex flex-wrap gap-1">
											{workingTasks.map((task) => (
												<span
													key={task.id}
													className="inline-flex max-w-[180px] items-center gap-1 rounded-lg bg-white/10 px-1.5 py-0.5 text-[10px] font-bold text-blue-50"
												>
													<span className="truncate">{task.name}</span>
													<button
														type="button"
														onClick={() => onRemoveTaskFromSession(task.id)}
														className="rounded p-0.5 text-blue-200 hover:bg-white/10 hover:text-white"
														title="Remove from working set"
													>
														<X className="w-2.5 h-2.5" />
													</button>
												</span>
											))}
										</div>
									)}
								</div>
							</div>

							{/* Action Buttons */}
							<div className="flex items-center gap-1 bg-black/10 rounded-xl p-1 shrink-0 self-stretch sm:self-auto">
								{/* Timer Display - inline with buttons */}
								<div className="px-3 py-2 font-mono text-sm font-bold flex-shrink-0">
									{formatTimer(activeTask.spentTime)}
								</div>

								<div className="w-px h-4 bg-white/10" />
								<button
									onClick={() =>
										setShowSessionTaskPicker(!showSessionTaskPicker)
									}
									className="flex-1 sm:flex-none p-2 hover:bg-white/10 rounded-lg transition-colors text-blue-200 hover:text-white"
									title="Add task to working set"
								>
									<Layers className="w-4 h-4 mx-auto" />
								</button>

								<button
									onClick={onToggleTimer}
									className="flex-1 sm:flex-none p-2 hover:bg-white/10 rounded-lg transition-colors"
									title={timerActive ? "Pause" : "Continue"}
								>
									{timerActive ? (
										<Pause className="w-4 h-4 fill-current mx-auto" />
									) : (
										<Play className="w-4 h-4 fill-current mx-auto" />
									)}
								</button>

								<button
									onClick={() => onFinishTask(activeTask.id)}
									className="flex-1 sm:flex-none p-2 hover:bg-white/10 rounded-lg transition-colors text-blue-200 hover:text-white"
									title="Finish Task"
								>
									<CheckCircle2 className="w-4 h-4 mx-auto" />
								</button>

								<button
									onClick={() => onReenterTask(activeTask.id)}
									className="flex-1 sm:flex-none p-2 hover:bg-white/10 rounded-lg transition-colors text-blue-200 hover:text-white"
									title="Finish and Re-enter"
								>
									<RotateCcw className="w-4 h-4 mx-auto" />
								</button>

								<div className="w-px h-4 bg-white/10 mx-0.5" />

								<button
									onClick={onStopTimer}
									className="flex-1 sm:flex-none p-2 hover:bg-white/10 rounded-lg transition-colors text-blue-200 hover:text-white"
									title="Stop Tracking"
								>
									<Square className="w-4 h-4 fill-current mx-auto" />
								</button>

								<button
									onClick={() => onDeleteTask(activeTask.id)}
									className="flex-1 sm:flex-none p-2 hover:bg-red-500/20 rounded-lg transition-colors text-red-200 hover:text-red-100"
									title="Delete Task"
								>
									<Trash2 className="w-4 h-4 mx-auto" />
								</button>
							</div>
						</motion.div>

						<AnimatePresence>
							{showSessionTaskPicker && (
								<motion.div
									initial={{ opacity: 0, y: -6 }}
									animate={{ opacity: 1, y: 0 }}
									exit={{ opacity: 0, y: -6 }}
									className={`mt-2 rounded-xl border p-2 shadow-sm ${
										darkMode
											? "bg-gray-900 border-gray-800"
											: "bg-white border-gray-100"
									}`}
								>
									<div className="flex items-center gap-2">
										<div
											className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${
												darkMode ? "bg-gray-800" : "bg-blue-50"
											}`}
										>
											<Layers className="w-3.5 h-3.5 text-blue-500" />
										</div>
										<input
											type="text"
											value={sessionTaskQuery}
											onChange={(e) => setSessionTaskQuery(e.target.value)}
											placeholder="Add another task to this session..."
											className={`flex-1 bg-transparent px-2 py-1.5 text-sm font-medium outline-none border-none ${
												darkMode
													? "placeholder-gray-600 text-gray-200"
													: "placeholder-gray-400 text-gray-800"
											}`}
										/>
										<button
											type="button"
											onClick={() => setShowSessionTaskPicker(false)}
											className="p-1.5 text-gray-400 hover:text-gray-600"
											title="Close"
										>
											<X className="w-3.5 h-3.5" />
										</button>
									</div>
									{sessionTaskSuggestions.length > 0 && (
										<div className="mt-2 max-h-44 overflow-y-auto no-scrollbar">
											{sessionTaskSuggestions.map((task) => (
												<button
													key={task.id}
													type="button"
													onClick={() => {
														onAddTaskToSession(task.id);
														setSessionTaskQuery("");
													}}
													className={`w-full rounded-lg px-3 py-2 text-left text-xs font-bold transition-colors ${
														darkMode
															? "hover:bg-gray-800 text-gray-200"
															: "hover:bg-blue-50 text-gray-700"
													}`}
												>
													{task.name}
												</button>
											))}
										</div>
									)}
								</motion.div>
							)}
						</AnimatePresence>

						{/* Session Log Input */}
						<AnimatePresence>
							{showSessionLog && (
								<motion.div
									initial={{ opacity: 0, height: 0 }}
									animate={{ opacity: 1, height: "auto" }}
									exit={{ opacity: 0, height: 0 }}
									transition={{ duration: 0.2, ease: "easeInOut" }}
									className="overflow-hidden"
								>
									<div
										className={`mt-2 p-2 rounded-xl border transition-all ${
											darkMode
												? "bg-gray-900 border-gray-800"
												: "bg-white border-gray-100 shadow-sm"
										}`}
									>
										{/* Type Toggle Pills */}
										<div className="flex items-center gap-1 mb-2">
											<div
												className={`flex gap-0.5 p-0.5 rounded-lg ${darkMode ? "bg-gray-800" : "bg-gray-100"}`}
											>
												<button
													type="button"
													onClick={() => setLogType("SessionLog")}
													className={`flex items-center gap-1 px-2.5 py-1 rounded-md text-[10px] font-black uppercase tracking-wider transition-all ${
														logType === "SessionLog"
															? "bg-blue-500 text-white shadow-sm"
															: darkMode
																? "text-gray-400 hover:text-gray-300"
																: "text-gray-500 hover:text-gray-700"
													}`}
												>
													<FileText className="w-3 h-3" />
													Log
												</button>
												<button
													type="button"
													onClick={() => setLogType("Achievement")}
													className={`flex items-center gap-1 px-2.5 py-1 rounded-md text-[10px] font-black uppercase tracking-wider transition-all ${
														logType === "Achievement"
															? "bg-amber-500 text-white shadow-sm"
															: darkMode
																? "text-gray-400 hover:text-gray-300"
																: "text-gray-500 hover:text-gray-700"
													}`}
												>
													<Trophy className="w-3 h-3" />
													Achievement
												</button>
											</div>

											<div className="flex-1" />

											{/* "Nice !!!" Feedback */}
											<AnimatePresence>
												{showNiceFeedback && (
													<motion.span
														initial={{ opacity: 0, x: 10 }}
														animate={{ opacity: 1, x: 0 }}
														exit={{ opacity: 0, x: -5 }}
														transition={{ duration: 0.3 }}
														className={`text-[11px] font-black tracking-wide ${
															logType === "Achievement"
																? "text-amber-500"
																: "text-blue-500"
														} mr-1`}
													>
														Nice !!!
													</motion.span>
												)}
											</AnimatePresence>

											{/* Collapse toggle */}
											<button
												type="button"
												onClick={() => setShowSessionLog(false)}
												className={`p-1 rounded-md transition-colors ${
													darkMode
														? "text-gray-500 hover:text-gray-300 hover:bg-gray-800"
														: "text-gray-400 hover:text-gray-600 hover:bg-gray-100"
												}`}
												title="Collapse session log"
											>
												<ChevronUp className="w-3.5 h-3.5" />
											</button>
										</div>

										{/* Input Row */}
										<div className="flex items-center gap-2">
											<div
												className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${
													logType === "Achievement"
														? "bg-amber-500/10 text-amber-500"
														: "bg-blue-500/10 text-blue-500"
												}`}
											>
												{logType === "Achievement" ? (
													<Trophy className="w-3.5 h-3.5" />
												) : (
													<FileText className="w-3.5 h-3.5" />
												)}
											</div>
											<input
												type="text"
												value={logInput}
												onChange={(e) => setLogInput(e.target.value)}
												onKeyDown={handleLogKeyDown}
												placeholder={
													logType === "Achievement"
														? "What did you just achieve?"
														: "Jot down what you did..."
												}
												className={`flex-1 bg-transparent px-2 py-1.5 text-sm font-medium outline-none border-none ${
													darkMode
														? "placeholder-gray-600 text-gray-200"
														: "placeholder-gray-400 text-gray-800"
												}`}
											/>
											<button
												type="button"
												onClick={handleSubmitLog}
												disabled={!logInput.trim()}
												className={`p-1.5 rounded-lg transition-all ${
													logInput.trim()
														? logType === "Achievement"
															? "bg-amber-500 text-white hover:bg-amber-600 shadow-sm"
															: "bg-blue-500 text-white hover:bg-blue-600 shadow-sm"
														: darkMode
															? "bg-gray-800 text-gray-600 cursor-not-allowed"
															: "bg-gray-100 text-gray-300 cursor-not-allowed"
												}`}
												title="Log entry"
											>
												<Send className="w-3.5 h-3.5" />
											</button>
										</div>
									</div>
								</motion.div>
							)}
						</AnimatePresence>

						{/* Collapsed state - show expand button */}
						{!showSessionLog && (
							<motion.button
								initial={{ opacity: 0 }}
								animate={{ opacity: 1 }}
								type="button"
								onClick={() => setShowSessionLog(true)}
								className={`mt-1.5 w-full flex items-center justify-center gap-1.5 py-1 rounded-lg text-[10px] font-bold uppercase tracking-wider transition-all ${
									darkMode
										? "text-gray-500 hover:text-gray-400 hover:bg-gray-900"
										: "text-gray-400 hover:text-gray-500 hover:bg-gray-50"
								}`}
							>
								<ChevronDown className="w-3 h-3" />
								Session Log
							</motion.button>
						)}
					</>
				) : (
					<motion.div
						key="input"
						initial={{ opacity: 0 }}
						animate={{ opacity: 1 }}
						className="flex items-center w-full"
					>
						<div
							className={`relative flex-1 group transition-all ${isFocused ? "scale-[1.02]" : ""}`}
						>
							<div
								className={`flex items-center gap-3 p-1 rounded-xl border shadow-sm transition-all focus-within:ring-4 focus-within:ring-blue-500/10 ${
									darkMode
										? "bg-gray-900 border-gray-800 focus-within:border-blue-500"
										: "bg-white border-gray-100 focus-within:border-blue-500"
								}`}
							>
								<div
									className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${darkMode ? "bg-gray-800" : "bg-gray-50"}`}
								>
									<Play className="w-4 h-4 text-blue-500 ml-0.5" />
								</div>
								<input
									type="text"
									value={input}
									onChange={(e) => setInput(e.target.value)}
									onFocus={() => setIsFocused(true)}
									onKeyDown={handleKeyDown}
									placeholder="What are you working on?"
									className="flex-1 bg-transparent px-2 py-2 text-sm font-medium outline-none border-none placeholder-gray-400"
								/>
								{input && (
									<button
										onClick={() => setInput("")}
										className="p-2 text-gray-400 hover:text-gray-600 animate-fade-in"
									>
										<X className="w-4 h-4" />
									</button>
								)}
								<div className="relative flex items-center shrink-0 mr-2">
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
												className="absolute right-0 top-full mt-2 w-64 p-4 bg-gray-950 dark:bg-gray-800 text-white rounded-2xl shadow-2xl z-[110] border border-gray-850 dark:border-gray-700 text-[10px] space-y-2 pointer-events-none"
											>
												<p className="font-black text-blue-400 uppercase tracking-wider mb-1 text-xs flex items-center gap-1.5">
													<Wand2 className="w-3.5 h-3.5 text-blue-400 animate-pulse" />
													Smart Input Guide
												</p>
												<div className="space-y-1 text-gray-300">
													<p>
														<b className="text-white">?Category:</b> Use{" "}
														<code className="bg-black/25 px-1 py-0.5 rounded text-purple-300 font-mono">
															?work
														</code>{" "}
														or{" "}
														<code className="bg-black/25 px-1 py-0.5 rounded text-purple-300 font-mono">
															?gym
														</code>
													</p>
													<p>
														<b className="text-white">!Date:</b> Use{" "}
														<code className="bg-black/25 px-1 py-0.5 rounded text-blue-300 font-mono">
															!today
														</code>
														,{" "}
														<code className="bg-black/25 px-1 py-0.5 rounded text-blue-300 font-mono">
															!tomorrow
														</code>
														,{" "}
														<code className="bg-black/25 px-1 py-0.5 rounded text-blue-300 font-mono">
															!2026-05-22
														</code>
													</p>
													<p>
														<b className="text-white">Start Time:</b> Use{" "}
														<code className="bg-black/25 px-1 py-0.5 rounded text-green-300 font-mono">
															at2pm
														</code>{" "}
														or{" "}
														<code className="bg-black/25 px-1 py-0.5 rounded text-green-300 font-mono">
															at1pm30
														</code>
													</p>
													<p>
														<b className="text-white">Duration:</b> Use{" "}
														<code className="bg-black/25 px-1 py-0.5 rounded text-orange-300 font-mono">
															for30m
														</code>
														,{" "}
														<code className="bg-black/25 px-1 py-0.5 rounded text-orange-300 font-mono">
															for1h30
														</code>
													</p>
													<p>
														<b className="text-white">#Tag:</b> Use{" "}
														<code className="bg-black/25 px-1 py-0.5 rounded text-red-300 font-mono">
															#quick
														</code>
														{" · "}
														<code className="bg-black/25 px-1 py-0.5 rounded text-red-300 font-mono">
															#explore
														</code>
														{" · "}
														<code className="bg-black/25 px-1 py-0.5 rounded text-red-300 font-mono">
															#finish
														</code>
														{" · "}
														<code className="bg-black/25 px-1 py-0.5 rounded text-red-300 font-mono">
															#handle
														</code>
													</p>
												</div>
												<div className="pt-1.5 border-t border-white/10 text-[9px] text-gray-400 italic">
													Example: Code review ?work !today at3pm for1h30 #quick
												</div>
											</motion.div>
										)}
									</AnimatePresence>
								</div>
								<div className="pr-4 py-2 shrink-0 hidden sm:block">
									<div className="px-3 py-1 font-mono text-xs font-black text-gray-300 border border-gray-100 dark:border-gray-800 rounded-lg">
										0:00:00
									</div>
								</div>
							</div>

							<AnimatePresence>
								{input.trim() && hasParsedInputTokens && (
									<motion.div
										initial={{ opacity: 0, y: -4 }}
										animate={{ opacity: 1, y: 0 }}
										exit={{ opacity: 0, y: -4 }}
										className="mt-1.5 flex flex-wrap items-center gap-1.5 px-2"
									>
										<span
											className={`flex items-center gap-1 text-[9px] px-2 py-0.5 rounded-full font-black uppercase tracking-wide ${
												darkMode
													? "bg-blue-500/15 text-blue-300"
													: "bg-blue-50 text-blue-500"
											}`}
										>
											<Wand2 className="w-2.5 h-2.5" />
											Parsed
										</span>
										{parsedCategory && (
											<span className="text-[9px] px-2 py-0.5 rounded-full bg-purple-500 text-white font-bold uppercase tracking-wide">
												{parsedCategory.name}
											</span>
										)}
										{parsedInput.relativeDate && (
											<span className="text-[9px] px-2 py-0.5 rounded-full bg-blue-500 text-white font-bold uppercase tracking-wide">
												{formatDueDate(formatDateToInput(parsedInput.relativeDate))}
											</span>
										)}
										{parsedInput.startTimeStr && (
											<span className="text-[9px] px-2 py-0.5 rounded-full bg-emerald-500 text-white font-bold uppercase tracking-wide">
												{parsedInput.startTimeStr}
											</span>
										)}
										{parsedInput.durationMs && (
											<span className="text-[9px] px-2 py-0.5 rounded-full bg-amber-500 text-white font-bold uppercase tracking-wide">
												{formatDurationShort(parsedInput.durationMs)}
											</span>
										)}
										{parsedInput.tag && (
											<span className="text-[9px] px-2 py-0.5 rounded-full bg-orange-500 text-white font-bold uppercase tracking-wide">
												{parsedInput.tag}
											</span>
										)}
										{parsedInput.isRecurring && (
											<span className="text-[9px] px-2 py-0.5 rounded-full bg-green-500 text-white font-bold uppercase tracking-wide">
												{parsedInput.recurringPattern || "recurring"}
											</span>
										)}
									</motion.div>
								)}
							</AnimatePresence>

							{/* Suggestions Dropdown */}
							<AnimatePresence>
								{isFocused && (input || suggestions.length > 0) && (
									<motion.div
										initial={{ opacity: 0, y: 10 }}
										animate={{ opacity: 1, y: 0 }}
										exit={{ opacity: 0, scale: 0.95 }}
										className={`absolute top-full left-0 right-0 mt-2 rounded-2xl border shadow-2xl overflow-hidden z-[100] ${
											darkMode
												? "bg-gray-900 border-gray-800"
												: "bg-white border-gray-100"
										}`}
									>
										<div className="p-2 border-b border-gray-100 dark:border-gray-800 bg-gray-50/50 dark:bg-gray-800/50 flex items-center justify-between">
											<span className="text-[10px] font-black uppercase tracking-widest text-gray-400 pl-2">
												Suggestions
											</span>
										</div>

										<div className="max-h-[300px] overflow-y-auto no-scrollbar">
											{suggestions.map((task) => (
												<button
													key={task.id}
													onClick={() => {
														onSelectTask(task.id);
														setIsFocused(false);
														setInput("");
													}}
													className={`w-full text-left px-4 py-3 flex items-center gap-3 transition-colors ${
														darkMode ? "hover:bg-gray-800" : "hover:bg-gray-50"
													}`}
												>
													<Search className="w-4 h-4 text-gray-400" />
													<span className="text-sm font-bold flex-1 truncate">
														{task.name}
													</span>
													<span className="text-[10px] font-mono text-gray-400">
														{formatDuration(task.spentTime)}
													</span>
												</button>
											))}

											{input.trim() &&
												!tasks.find(
													(t) =>
														t.name.toLowerCase() === input.trim().toLowerCase(),
												) && (
													<button
														onClick={() => {
															const { categoryName } = parseSmartInput(
																input.trim(),
															);
															let catId = categories[0]?.id || "1";
															if (categoryName) {
																const found = categories.find(
																	(c) =>
																		c.name.toLowerCase() ===
																		categoryName.toLowerCase(),
																);
																if (found) catId = found.id;
															}
															onAddTask(input.trim(), catId);
															setIsFocused(false);
															setInput("");
														}}
														className={`w-full text-left px-4 py-4 flex items-center gap-3 transition-colors text-blue-500 ${
															darkMode
																? "hover:bg-blue-500/10"
																: "hover:bg-blue-50"
														}`}
													>
														<Plus className="w-4 h-4" />
														<div className="flex-1">
															<span className="text-sm font-black uppercase tracking-tight">
																Create new task:
															</span>
															<span className="text-sm font-bold ml-2">
																"{input}"
															</span>
														</div>
													</button>
												)}

											{input &&
												suggestions.length === 0 &&
												!tasks.find(
													(t) =>
														t.name.toLowerCase() === input.trim().toLowerCase(),
												) && (
													<div className="p-8 text-center bg-gray-50/30 dark:bg-gray-900/30">
														<Clock className="w-8 h-8 text-gray-300 mx-auto mb-2" />
														<p className="text-xs font-bold text-gray-400 uppercase tracking-widest">
															Type to create a new session
														</p>
													</div>
												)}
										</div>
									</motion.div>
								)}
							</AnimatePresence>
						</div>
					</motion.div>
				)}
			</AnimatePresence>
		</div>
	);
}
