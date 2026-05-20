import React, { useState, useRef, useEffect } from "react";
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
} from "lucide-react";
import { Task, Category } from "../types";
import { formatDuration, formatTimer, parseSmartInput } from "../utils";

interface WorkingBarProps {
	tasks: Task[];
	categories: Category[];
	activeTask: Task | null;
	timerActive: boolean;
	onSelectTask: (id: string) => void;
	onAddTask: (name: string, categoryId: string) => void;
	onToggleTimer: () => void;
	onStopTimer: () => void;
	onFinishTask: (id: string) => void;
	onDeleteTask: (id: string) => void;
	onReenterTask: (id: string) => void;
	darkMode: boolean;
}

export default function WorkingBar({
	tasks,
	categories,
	activeTask,
	timerActive,
	onSelectTask,
	onAddTask,
	onToggleTimer,
	onStopTimer,
	onFinishTask,
	onDeleteTask,
	onReenterTask,
	darkMode,
}: WorkingBarProps) {
	const [input, setInput] = useState("");
	const [isFocused, setIsFocused] = useState(false);
	const containerRef = useRef<HTMLDivElement>(null);

	const suggestions = tasks
		.filter(
			(t) => !t.completed && t.name.toLowerCase().includes(input.toLowerCase()),
		)
		.slice(0, 5);

	const handleClickOutside = (e: MouseEvent) => {
		if (
			containerRef.current &&
			!containerRef.current.contains(e.target as Node)
		) {
			setIsFocused(false);
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
									Working on
								</p>
								<h3 className="text-sm font-bold truncate leading-tight">
									{activeTask.name}
								</h3>
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
										className="p-2 text-gray-400 hover:text-gray-600"
									>
										<X className="w-4 h-4" />
									</button>
								)}
								<div className="pr-4 py-2 shrink-0 hidden sm:block">
									<div className="px-3 py-1 font-mono text-xs font-black text-gray-300 border border-gray-100 dark:border-gray-800 rounded-lg">
										0:00:00
									</div>
								</div>
							</div>

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
