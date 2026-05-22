import React, { useState, useRef } from "react";
import { motion, AnimatePresence } from "motion/react";
import { Plus, Edit2, LayoutGrid, Flame } from "lucide-react";
import { Task } from "../types";
import { CategoryIcon } from "./CategoryIcon";
import { calculateStreak } from "../utils";
import { HabitCalendarModal } from "./HabitCalendarModal";

const triggerHaptic = () => {
	if (typeof navigator !== "undefined" && navigator.vibrate) {
		navigator.vibrate(12);
	}
};

interface HabitRowProps {
	habits: Task[];
	onToggleHabit: (id: string) => void;
	onAddHabit: () => void;
	onEditHabit: (task: Task) => void;
	darkMode: boolean;
}

export const HabitRow: React.FC<HabitRowProps> = ({
	habits,
	onToggleHabit,
	onAddHabit,
	onEditHabit,
	darkMode,
}) => {
	const today = new Date().toISOString().split("T")[0];
	const [selectedCalendarHabit, setSelectedCalendarHabit] =
		useState<Task | null>(null);
	const [isExpanded, setIsExpanded] = useState(false);
	const [isEditMode, setIsEditMode] = useState(false);

	const longPressTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
	const longPressTriggeredRef = useRef(false);

	// Last 7 days as ISO date strings (oldest → newest)
	const last7Days = Array.from({ length: 7 }, (_, i) => {
		const d = new Date();
		d.setDate(d.getDate() - (6 - i));
		return d.toISOString().split("T")[0];
	});

	const handlePointerDown = (habit: Task) => {
		longPressTriggeredRef.current = false;
		longPressTimerRef.current = setTimeout(() => {
			longPressTriggeredRef.current = true;
			triggerHaptic();
			setSelectedCalendarHabit(habit);
		}, 500);
	};

	const handlePointerUp = () => {
		if (longPressTimerRef.current) {
			clearTimeout(longPressTimerRef.current);
			longPressTimerRef.current = null;
		}
	};

	const handlePointerCancel = () => {
		if (longPressTimerRef.current) {
			clearTimeout(longPressTimerRef.current);
			longPressTimerRef.current = null;
		}
	};

	const handleHabitTap = (habit: Task) => {
		if (longPressTriggeredRef.current) return;
		if (isEditMode) {
			onEditHabit(habit);
		} else {
			triggerHaptic();
			onToggleHabit(habit.id);
		}
	};

	const renderHabitCard = (habit: Task, isGrid: boolean) => {
		const isCompletedToday = habit.completedDates?.includes(today);
		const habitColor = habit.recurringColor || "#FF6B35";
		const streak = calculateStreak(habit.completedDates);

		return (
			<div
				key={habit.id}
				className={
					isGrid
						? "relative group w-full"
						: "relative group shrink-0 w-[40%] min-w-[140px] snap-start"
				}
			>
				<motion.button
					whileTap={{ scale: isEditMode ? 0.96 : 1.08 }}
					title={habit.name}
					onPointerDown={() => handlePointerDown(habit)}
					onPointerUp={handlePointerUp}
					onPointerLeave={handlePointerCancel}
					onPointerCancel={handlePointerCancel}
					onClick={() => handleHabitTap(habit)}
					className={`w-full rounded-xl px-2 py-2 flex items-center gap-2 transition-all border relative overflow-hidden ${
						isCompletedToday
							? "shadow-lg"
							: darkMode
								? "bg-gray-900 border-gray-800"
								: "bg-white border-gray-100 shadow-sm"
					} ${isEditMode ? "ring-2 ring-blue-400/40" : ""}`}
					style={
						isCompletedToday
							? {
									backgroundColor: `${habitColor}15`,
									borderColor: `${habitColor}50`,
								}
							: {}
					}
				>
					{/* Edit mode indicator dot */}
					{isEditMode && (
						<div className="absolute top-1.5 right-1.5 z-10">
							<Edit2 className="w-2.5 h-2.5 text-blue-400 opacity-70" />
						</div>
					)}

					{/* Icon circle */}
					<div
						className={`relative w-9 h-9 rounded-full flex items-center justify-center shrink-0 text-white ${
							!isCompletedToday &&
							(darkMode
								? "!bg-gray-800 !text-gray-400"
								: "!bg-gray-100 !text-gray-500")
						}`}
						style={isCompletedToday ? { backgroundColor: habitColor } : {}}
					>
						<CategoryIcon name={habit.recurringIcon} className="w-4 h-4" />

						{streak > 0 && (
							<span
								className={`absolute -top-1 -right-1 min-w-[14px] h-[14px] px-[3px] rounded-full text-[7px] font-black flex items-center justify-center shadow-sm text-white border-[1.5px] ${
									darkMode ? "border-gray-900" : "border-white"
								} z-10`}
								style={{ backgroundColor: habitColor }}
							>
								<Flame className="w-[6px] h-[6px] mr-[0.5px] fill-current" />
								<span className="leading-none">{streak}</span>
							</span>
						)}
					</div>

					<div className="flex flex-col flex-1 justify-start items-start">
						{/* Habit name */}
						<span
							className={`text-[11px] text-left font-semibold truncate flex-1 ${
								!isCompletedToday &&
								(darkMode ? "text-gray-200" : "text-gray-600")
							}`}
							style={isCompletedToday ? { color: habitColor } : {}}
						>
							{habit.name}
						</span>

						{/* 7-day micro progress bars — bottom-left */}
						<div className="flex items-end gap-[2.5px]">
							{last7Days.map((day) => {
								const done = habit.completedDates?.includes(day);
								return (
									<div
										key={day}
										className="w-[5px] h-[2px] rounded-t-full transition-all"
										style={{
											backgroundColor: done
												? habitColor
												: darkMode
													? "#374151"
													: "#e5e7eb",
											opacity: done ? 1 : 0.5,
										}}
									/>
								);
							})}
						</div>
					</div>
				</motion.button>
			</div>
		);
	};

	// ── Empty state ──────────────────────────────────────────────────────────
	if (habits.length === 0) {
		return (
			<div className="flex items-center gap-2 py-0.5">
				<span
					className={`text-xs font-semibold ${darkMode ? "text-gray-500" : "text-gray-400"}`}
				>
					No habits yet
				</span>
				<motion.button
					whileTap={{ scale: 0.95 }}
					onClick={onAddHabit}
					className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold border transition-all ${
						darkMode
							? "bg-gray-900 border-gray-800 text-blue-400 hover:bg-blue-500/10"
							: "bg-white border-gray-200 text-blue-600 hover:bg-blue-50"
					}`}
				>
					<Plus className="w-3 h-3" />
					Add habit
				</motion.button>
			</div>
		);
	}

	// ── Main render ──────────────────────────────────────────────────────────
	return (
		<div className="relative w-full">
			<div className="flex items-center gap-3 w-full">
				<div className="flex-1 min-w-0 relative">
					{isExpanded ? (
						/* Expanded stats + action bar */
						<div className="flex gap-2.5 w-full pr-10 pb-2">
							{/* Total count */}
							<div
								className={`flex-1 flex items-center justify-center gap-2 h-11 rounded-xl border shadow-sm ${
									darkMode
										? "bg-gray-900 border-gray-800"
										: "bg-white border-gray-100"
								}`}
							>
								<span className="text-[10px] font-bold uppercase tracking-wider text-gray-400 dark:text-gray-500">
									Total:
								</span>
								<span className="text-sm font-bold font-mono text-blue-600 dark:text-blue-400">
									{habits.length}
								</span>
							</div>

							{/* Edit mode toggle */}
							<motion.button
								whileTap={{ scale: 0.96 }}
								onClick={() => {
									triggerHaptic();
									setIsEditMode((v) => !v);
								}}
								className={`flex-1 flex items-center justify-center gap-1.5 h-11 rounded-xl border shadow-sm cursor-pointer transition-all ${
									isEditMode
										? "bg-blue-500 border-blue-500 text-white"
										: darkMode
											? "bg-gray-900 border-gray-800 text-gray-400 hover:text-blue-400 hover:border-blue-500/50"
											: "bg-white border-gray-100 text-gray-500 hover:text-blue-600 hover:bg-blue-50"
								}`}
							>
								<Edit2 className="w-3.5 h-3.5" />
								<span className="text-xs font-bold">
									{isEditMode ? "Done" : "Edit"}
								</span>
							</motion.button>

							{/* Add habit */}
							<motion.button
								whileHover={{ y: -1 }}
								whileTap={{ scale: 0.97 }}
								onClick={onAddHabit}
								className={`flex-1 flex items-center justify-center gap-1.5 h-11 rounded-xl border shadow-sm cursor-pointer transition-all ${
									darkMode
										? "bg-gray-900 border-gray-800 text-blue-400 hover:border-blue-500/50 hover:bg-blue-500/10"
										: "bg-white border-gray-100 text-blue-600 hover:bg-blue-50 hover:border-blue-100"
								}`}
							>
								<Plus className="w-4 h-4" />
								<span className="text-xs font-bold">Add</span>
							</motion.button>
						</div>
					) : (
						/* Horizontal scrolling habit strip */
						<div className="flex gap-4 overflow-x-auto pb-2 no-scrollbar snap-x snap-mandatory">
							{habits.map((habit) => renderHabitCard(habit, false))}
						</div>
					)}

					{/* Gradient fade — only in collapsed strip */}
					{!isExpanded && (
						<div className="absolute right-0 top-0 h-full w-12 pointer-events-none">
							<div
								className={`absolute inset-0 ${
									darkMode
										? "bg-gradient-to-l from-gray-950 via-gray-950/70 to-transparent"
										: "bg-gradient-to-l from-[#F8F9FE] via-[#F8F9FE]/80 to-transparent"
								}`}
							/>
						</div>
					)}

					{/* LayoutGrid expand/collapse — no border, no bg, blends into gradient */}
					<div className="absolute right-0 top-0 h-full flex items-center justify-end pr-1 pointer-events-none">
						<motion.button
							whileTap={{ scale: 0.88 }}
							onClick={() => {
								setIsExpanded((v) => !v);
								if (isExpanded) setIsEditMode(false);
							}}
							className="relative z-10 w-8 h-8 cursor-pointer pointer-events-auto flex items-center justify-center -translate-y-[3px]"
							title={isExpanded ? "Collapse" : "Show all habits"}
						>
							<LayoutGrid
								className={`w-4 h-4 transition-all duration-300 ${
									isExpanded
										? darkMode
											? "text-blue-400"
											: "text-blue-500"
										: darkMode
											? "text-gray-500"
											: "text-gray-400"
								}`}
							/>
						</motion.button>
					</div>
				</div>
			</div>

			{/* Expanded grid */}
			<AnimatePresence>
				{isExpanded && (
					<motion.div
						initial={{ height: 0, opacity: 0 }}
						animate={{ height: "auto", opacity: 1 }}
						exit={{ height: 0, opacity: 0 }}
						transition={{ duration: 0.25, ease: "easeInOut" }}
						className="overflow-hidden w-full mt-3"
					>
						<div className="grid grid-cols-2 gap-3 w-full pb-2">
							{habits.map((habit) => renderHabitCard(habit, true))}
						</div>
					</motion.div>
				)}
			</AnimatePresence>

			{/* Calendar modal — opened by long press on any habit card */}
			{selectedCalendarHabit && (
				<HabitCalendarModal
					isOpen={!!selectedCalendarHabit}
					onClose={() => setSelectedCalendarHabit(null)}
					habits={habits}
					initialHabit={selectedCalendarHabit}
					darkMode={darkMode}
				/>
			)}
		</div>
	);
};
