import React, { useState } from "react";
import { motion } from "motion/react";
import { Plus, Edit2, ChevronRight, Calendar } from "lucide-react";
import { Task } from "../types";
import { CategoryIcon } from "./CategoryIcon";
import { calculateStreak } from "../utils";
import { HabitCalendarModal } from "./HabitCalendarModal";

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

	return (
		<div className="flex items-center gap-3 w-full">
			{habits.length > 0 && (
				<>
					<motion.button
						whileHover={{ scale: 1.05 }}
						whileTap={{ scale: 0.95 }}
						onClick={() => {
							if (habits.length > 0) {
								setSelectedCalendarHabit(habits[0]);
							}
						}}
						className={`w-11 h-11 rounded-xl flex items-center justify-center shrink-0 border shadow-sm transition-all -translate-y-[3px] ${
							darkMode
								? "bg-gray-900 border-gray-800 text-blue-400 hover:border-blue-500/50 hover:bg-blue-500/10"
								: "bg-white border-gray-100 text-blue-600 hover:bg-blue-50 hover:border-blue-200"
						}`}
						title="Habit Calendar History"
					>
						<Calendar className="w-4 h-4" />
					</motion.button>

					<div className="w-px h-6 bg-gray-200 dark:bg-gray-800 self-center shrink-0 -translate-y-[3px]" />
				</>
			)}

			<div className="flex-1 min-w-0 relative">
				<div className="flex gap-4 overflow-x-auto pb-2 no-scrollbar snap-x snap-mandatory">
					{habits.map((habit) => {
						const isCompletedToday = habit.completedDates?.includes(today);
						const habitColor = habit.recurringColor || "#FF6B35";
						const streak = calculateStreak(habit.completedDates);

						return (
							<div
								key={habit.id}
								className="relative group shrink-0 w-[40%] min-w-[140px] snap-start"
							>
								<motion.button
									whileHover={{ y: -2 }}
									whileTap={{ scale: 0.97 }}
									onClick={() => onToggleHabit(habit.id)}
									className={`w-full rounded-2xl px-1.5 py-2 flex items-center gap-2 transition-all border relative ${
										isCompletedToday
											? "shadow-lg"
											: darkMode
												? "bg-gray-900 border-gray-800"
												: "bg-white border-gray-100 shadow-sm"
									}`}
									style={
										isCompletedToday
											? {
													backgroundColor: `${habitColor}15`,
													borderColor: `${habitColor}50`,
												}
											: {}
									}
								>
									<div
										className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 text-white ${
											!isCompletedToday &&
											(darkMode
												? "!bg-gray-800 !text-gray-400"
												: "!bg-gray-100 !text-gray-500")
										}`}
										style={
											isCompletedToday ? { backgroundColor: habitColor } : {}
										}
									>
										<CategoryIcon
											name={habit.recurringIcon}
											className="w-3.5 h-3.5"
										/>
									</div>

									<span
										className={`text-[11px] font-semibold truncate ${
											!isCompletedToday &&
											(darkMode ? "text-gray-200" : "text-gray-600")
										}`}
										style={isCompletedToday ? { color: habitColor } : {}}
									>
										{habit.name}
									</span>

									{streak > 0 && (
										<span
											className="absolute top-1 right-2.5 text-[8px] font-black flex items-center gap-0.5"
											style={{ color: habitColor }}
										>
											🔥{streak}
										</span>
									)}
								</motion.button>
								<button
									onClick={() => onEditHabit(habit)}
									className="absolute -top-1 -right-1 p-1 bg-white dark:bg-gray-800 rounded-full shadow-md border border-gray-100 dark:border-gray-700 opacity-0 group-hover:opacity-100 transition-opacity z-10 text-gray-400 hover:text-blue-500"
									title="Edit Habit"
								>
									<Edit2 className="w-3 h-3" />
								</button>
							</div>
						);
					})}
				</div>

				<div className="absolute right-0 top-0 h-full w-12 pointer-events-none flex items-center justify-end pr-2">
					<div
						className={`absolute inset-0 ${
							darkMode
								? "bg-gradient-to-l from-black via-black/70 to-transparent"
								: "bg-gradient-to-l from-white via-white/80 to-transparent"
						}`}
					/>

					<div className="relative z-10">
						<ChevronRight
							className={`w-5 h-5 animate-pulse ${
								darkMode ? "text-gray-500" : "text-gray-400"
							}`}
						/>
					</div>
				</div>
			</div>

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
