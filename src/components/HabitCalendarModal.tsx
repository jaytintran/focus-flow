import React, { useState, useMemo } from "react";
import { motion, AnimatePresence } from "motion/react";
import { X, ChevronLeft, ChevronRight, Calendar, Zap, Award, ChevronDown } from "lucide-react";
import { Task } from "../types";
import { CategoryIcon } from "./CategoryIcon";
import { calculateStreak } from "../utils";

interface HabitCalendarModalProps {
	isOpen: boolean;
	onClose: () => void;
	habits: Task[];
	initialHabit: Task;
	darkMode: boolean;
}

export const HabitCalendarModal: React.FC<HabitCalendarModalProps> = ({
	isOpen,
	onClose,
	habits,
	initialHabit,
	darkMode,
}) => {
	const today = new Date();
	const [activeHabitId, setActiveHabitId] = useState<string>(initialHabit.id);
	const [viewDate, setViewDate] = useState(new Date());
	const [isDropdownOpen, setIsDropdownOpen] = useState(false);

	const activeHabit = useMemo(() => {
		return habits.find((h) => h.id === activeHabitId) || initialHabit;
	}, [habits, activeHabitId, initialHabit]);

	const currentMonth = viewDate.getMonth();
	const currentYear = viewDate.getFullYear();

	const habitColor = activeHabit.recurringColor || "#FF6B35";
	const streak = useMemo(() => calculateStreak(activeHabit.completedDates), [activeHabit.completedDates]);

	// Generate days of the month for the calendar grid
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

	const monthCompletionsCount = useMemo(() => {
		if (!activeHabit.completedDates) return 0;
		return activeHabit.completedDates.filter((dateStr) => {
			const date = new Date(dateStr);
			return date.getMonth() === currentMonth && date.getFullYear() === currentYear;
		}).length;
	}, [activeHabit.completedDates, currentMonth, currentYear]);

	const handlePrevMonth = () => {
		setViewDate(new Date(currentYear, currentMonth - 1, 1));
	};

	const handleNextMonth = () => {
		setViewDate(new Date(currentYear, currentMonth + 1, 1));
	};

	const monthName = viewDate.toLocaleDateString(undefined, {
		month: "long",
		year: "numeric",
	});

	const weekdays = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];

	return (
		<AnimatePresence>
			{isOpen && (
				<>
					{/* Backdrop */}
					<motion.div
						initial={{ opacity: 0 }}
						animate={{ opacity: 1 }}
						exit={{ opacity: 0 }}
						className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[110]"
						onClick={onClose}
					/>

					{/* Modal Card */}
					<motion.div
						initial={{ scale: 0.9, y: 20, opacity: 0 }}
						animate={{ scale: 1, y: 0, opacity: 1 }}
						exit={{ scale: 0.9, y: 20, opacity: 0 }}
						transition={{ type: "spring", damping: 25, stiffness: 300 }}
						className={`fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-md p-6 rounded-[32px] shadow-2xl z-[120] ${
							darkMode ? "bg-gray-900 text-white border border-gray-800" : "bg-white text-gray-900 border border-gray-100"
						}`}
					>
						{/* Close button */}
						<button
							onClick={onClose}
							className="absolute top-4 right-4 p-2 rounded-2xl hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors z-10"
						>
							<X className="w-5 h-5 text-gray-400" />
						</button>

						{/* Header with Habit Select Selector */}
						<div className="relative flex items-center gap-3 mb-6 pr-8">
							<div
								className="w-10 h-10 rounded-2xl flex items-center justify-center text-white shadow-lg shrink-0 transition-colors duration-300"
								style={{ backgroundColor: habitColor }}
							>
								<CategoryIcon name={activeHabit.recurringIcon} className="w-5 h-5" />
							</div>
							<div className="flex-1 min-w-0">
								<button
									onClick={() => setIsDropdownOpen(!isDropdownOpen)}
									className={`flex items-center gap-1.5 w-full text-left font-black text-base focus:outline-none truncate cursor-pointer ${
										darkMode ? "text-white" : "text-gray-900"
									}`}
								>
									<span className="truncate">{activeHabit.name}</span>
									<ChevronDown className={`w-4 h-4 shrink-0 transition-transform ${isDropdownOpen ? "rotate-180" : ""}`} />
								</button>
								<p className="text-[10px] uppercase font-bold tracking-widest text-gray-400 mt-0.5">
									Select Habit History
								</p>
							</div>

							{/* Dropdown Menu Overlay */}
							<AnimatePresence>
								{isDropdownOpen && (
									<>
										{/* Backdrop to capture clicks outside */}
										<div className="fixed inset-0 z-20" onClick={() => setIsDropdownOpen(false)} />
										
										{/* Dropdown Grid Container */}
										<motion.div
											initial={{ opacity: 0, y: 8, scale: 0.95 }}
											animate={{ opacity: 1, y: 0, scale: 1 }}
											exit={{ opacity: 0, y: 8, scale: 0.95 }}
											transition={{ duration: 0.15, ease: "easeOut" }}
											className={`absolute top-full left-0 right-0 mt-2 p-3 rounded-3xl border shadow-2xl z-30 max-h-64 overflow-y-auto no-scrollbar ${
												darkMode ? "bg-gray-950 border-gray-800" : "bg-white border-gray-150"
											}`}
										>
											<div className="grid grid-cols-3 gap-2">
												{habits.map((h) => {
													const hColor = h.recurringColor || "#FF6B35";
													const isSelected = h.id === activeHabitId;
													return (
														<motion.button
															key={h.id}
															whileHover={{ scale: 1.03 }}
															whileTap={{ scale: 0.97 }}
															onClick={() => {
																setActiveHabitId(h.id);
																setIsDropdownOpen(false);
															}}
															className={`flex flex-col items-center justify-center p-2 rounded-2xl border text-center transition-all cursor-pointer ${
																isSelected
																	? "shadow-md"
																	: darkMode
																		? "border-gray-800 hover:border-gray-700"
																		: "border-gray-100 hover:border-gray-200"
															}`}
															style={{
																backgroundColor: isSelected ? `${hColor}20` : `${hColor}08`,
																borderColor: isSelected ? hColor : undefined,
																boxShadow: isSelected ? `0 4px 12px ${hColor}20` : "none",
															}}
														>
															<div
																className="w-7 h-7 rounded-xl flex items-center justify-center text-white mb-1.5 shrink-0 shadow-sm"
																style={{ backgroundColor: hColor }}
															>
																<CategoryIcon name={h.recurringIcon} className="w-3.5 h-3.5" />
															</div>
															<span
																className="text-[9px] font-black line-clamp-2 w-full leading-tight break-words"
																style={{ color: isSelected ? hColor : darkMode ? "#9CA3AF" : "#4B5563" }}
															>
																{h.name}
															</span>
														</motion.button>
													);
												})}
											</div>
										</motion.div>
									</>
								)}
							</AnimatePresence>
						</div>

						{/* Quick Statistics Banner */}
						<div className="grid grid-cols-3 gap-2 mb-6">
							<div className={`p-3 rounded-2xl text-center ${darkMode ? "bg-gray-800/40" : "bg-gray-50"}`}>
								<Zap className="w-4 h-4 mx-auto mb-1 text-orange-500 fill-orange-500" />
								<p className="text-[9px] font-bold text-gray-400 uppercase tracking-tight">Streak</p>
								<p className="text-sm font-black">{streak} days</p>
							</div>
							<div className={`p-3 rounded-2xl text-center ${darkMode ? "bg-gray-800/40" : "bg-gray-50"}`}>
								<Calendar className="w-4 h-4 mx-auto mb-1 text-blue-500" />
								<p className="text-[9px] font-bold text-gray-400 uppercase tracking-tight">This Month</p>
								<p className="text-sm font-black">{monthCompletionsCount} days</p>
							</div>
							<div className={`p-3 rounded-2xl text-center ${darkMode ? "bg-gray-800/40" : "bg-gray-50"}`}>
								<Award className="w-4 h-4 mx-auto mb-1 text-purple-500" />
								<p className="text-[9px] font-bold text-gray-400 uppercase tracking-tight">Total</p>
								<p className="text-sm font-black">{(activeHabit.completedDates || []).length} times</p>
							</div>
						</div>

						{/* Month Navigation */}
						<div className="flex items-center justify-between mb-4 px-1">
							<span className="text-sm font-black uppercase tracking-wider">{monthName}</span>
							<div className="flex items-center gap-1">
								<button
									onClick={handlePrevMonth}
									className="p-1.5 rounded-xl hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
								>
									<ChevronLeft className="w-4 h-4" />
								</button>
								<button
									onClick={handleNextMonth}
									className="p-1.5 rounded-xl hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
								>
									<ChevronRight className="w-4 h-4" />
								</button>
							</div>
						</div>

						{/* Weekdays Labels */}
						<div className="grid grid-cols-7 gap-1 text-center mb-2">
							{weekdays.map((day) => (
								<span key={day} className="text-[10px] font-bold text-gray-400 uppercase py-1">
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

								const dateStr = day.toISOString().split("T")[0];
								const isCompleted = activeHabit.completedDates?.includes(dateStr);
								const isToday = dateStr === today.toISOString().split("T")[0];

								return (
									<div
										key={dateStr}
										className={`aspect-square rounded-full flex flex-col items-center justify-center text-xs font-bold transition-all relative ${
											isCompleted
												? "text-white scale-105"
												: isToday
													? "ring-2 ring-blue-500/50"
													: darkMode
														? "text-gray-300 hover:bg-gray-800"
														: "text-gray-700 hover:bg-gray-100"
										}`}
										style={
											isCompleted
												? {
														backgroundColor: habitColor,
														boxShadow: `0 4px 12px ${habitColor}35`,
													}
												: {}
										}
										title={dateStr}
									>
										<span>{day.getDate()}</span>
										{isToday && !isCompleted && (
											<span className="absolute bottom-1 w-1 h-1 rounded-full bg-blue-500" />
										)}
									</div>
								);
							})}
						</div>
					</motion.div>
				</>
			)}
		</AnimatePresence>
	);
};
