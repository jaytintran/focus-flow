import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
	X,
	Calendar,
	Flag,
	Tag,
	ChevronDown,
	AlignLeft,
	Wand2,
	RefreshCw,
} from "lucide-react";

import { Task, Category, Priority } from "../types";
import { PRIORITIES } from "../constants";
import { parseSmartInput, formatDateToInput } from "../utils";
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
	const [priority, setPriority] = useState<Priority>(
		initialTask?.priority || "Medium",
	);
	const [dueDate, setDueDate] = useState(initialTask?.dueDate || "");

	// Reset state when opening for a new task or editing a different one
	useEffect(() => {
		if (isOpen) {
			setName(initialTask?.name || "");
			setDescription(initialTask?.description || "");
			setCategoryId(initialTask?.categoryId || initialCatIdFromContext);
			setPriority(initialTask?.priority || "Medium");
			setDueDate(initialTask?.dueDate || "");
			setIsRecurring(initialTask?.isRecurring || defaultRecurring || false);
			setRecurringIcon(initialTask?.recurringIcon || "Flame");
			setRecurringColor(initialTask?.recurringColor || HABIT_COLORS[0].value);
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
		const { categoryName, relativeDate } = parseSmartInput(val);

		if (categoryName) {
			const found = categories.find(
				(c) => c.name.toLowerCase() === categoryName.toLowerCase(),
			);
			if (found) setCategoryId(found.id);
		}

		if (relativeDate) {
			setDueDate(formatDateToInput(relativeDate));
		}
	};

	const handleSubmit = (e: React.FormEvent) => {
		e.preventDefault();
		if (!name.trim()) return;

		// Clean name from tags/dates before final submit
		const { cleanName } = parseSmartInput(name);

		onSubmit({
			name: cleanName,
			description: description.trim() || undefined,
			categoryId,
			priority,
			dueDate: dueDate || undefined,
			isRecurring,
			recurringIcon: isRecurring ? recurringIcon : undefined,
			recurringColor: isRecurring ? recurringColor : undefined,
		});
		onClose();
	};

	return (
		<AnimatePresence>
			{isOpen && (
				<>
					<motion.div
						initial={{ opacity: 0 }}
						animate={{ opacity: 1 }}
						exit={{ opacity: 0 }}
						className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[60]"
						onClick={onClose}
					/>
					<motion.div
						initial={{ y: "100%" }}
						animate={{ y: 0 }}
						exit={{ y: "100%" }}
						transition={{ type: "spring", damping: 25, stiffness: 300 }}
						className="fixed inset-x-0 bottom-0 bg-white dark:bg-gray-900 rounded-t-[40px] z-[70] p-8 max-h-[90vh] overflow-y-auto shadow-2xl"
					>
						<div className="max-w-2xl mx-auto">
							<div className="flex items-center justify-between mb-8">
								<h2 className="text-2xl font-black text-gray-900 dark:text-white">
									{initialTask ? "Edit Task" : "Create Task"}
								</h2>
								<button
									onClick={onClose}
									className="p-2.5 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-2xl transition-colors"
								>
									<X className="w-6 h-6 text-gray-400" />
								</button>
							</div>

							<form onSubmit={handleSubmit} className="space-y-8">
								<div>
									<div className="flex items-center justify-between mb-2">
										<label className="block text-[10px] uppercase tracking-widest font-black text-gray-400 dark:text-gray-500">
											Task Name
										</label>
										<div
											className="flex items-center gap-1.5 opacity-40 hover:opacity-100 transition-opacity cursor-help"
											title="Use #tag for category and !1h/!30m/!2d for due date"
										>
											<Wand2 className="w-3 h-3 text-blue-500" />
											<span className="text-[9px] font-bold text-gray-400 uppercase tracking-tighter italic">
												Magic Input
											</span>
										</div>
									</div>
									<input
										autoFocus
										type="text"
										value={name}
										onChange={(e) => handleNameChange(e.target.value)}
										placeholder="Task name... #work !2h"
										className="w-full text-2xl font-bold bg-transparent border-b-2 border-gray-100 dark:border-gray-800 pb-2 focus:border-blue-500 outline-none transition-colors text-gray-900 dark:text-white placeholder-gray-300 dark:placeholder-gray-700"
									/>
								</div>

								<div>
									<label className="block text-[10px] uppercase tracking-widest font-black text-gray-400 dark:text-gray-500 mb-2">
										<div className="flex items-center gap-1">
											<AlignLeft className="w-3 h-3" /> Description (Optional)
										</div>
									</label>
									<textarea
										value={description}
										onChange={(e) => setDescription(e.target.value)}
										placeholder="Add more details about this task..."
										rows={3}
										className="w-full bg-gray-50 dark:bg-gray-800 border border-gray-100 dark:border-gray-700 rounded-2xl p-4 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all text-gray-700 dark:text-gray-300 placeholder-gray-400"
									/>
								</div>

								<div className="grid grid-cols-1 md:grid-cols-2 gap-8">
									<div>
										<label className="block text-[10px] uppercase tracking-widest font-black text-gray-400 dark:text-gray-500 mb-3">
											<div className="flex items-center gap-1">
												<Tag className="w-3 h-3" /> Category
											</div>
										</label>
										<div className="flex flex-wrap gap-2">
											{categories.map((cat) => (
												<button
													key={cat.id}
													type="button"
													onClick={() => setCategoryId(cat.id)}
													className={`px-4 py-2 rounded-2xl text-xs font-bold transition-all border ${
														categoryId === cat.id
															? "bg-blue-600 border-blue-600 text-white shadow-lg shadow-blue-500/20"
															: "bg-gray-50 dark:bg-gray-800 border-gray-100 dark:border-gray-700 text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700"
													}`}
												>
													<div className="flex items-center gap-2">
														<CategoryIcon
															name={cat.iconName}
															className={`w-3.5 h-3.5 ${categoryId === cat.id ? "text-white" : ""}`}
															style={
																categoryId !== cat.id
																	? { color: cat.color }
																	: {}
															}
														/>
														{cat.name}
													</div>
												</button>
											))}
										</div>
									</div>

									<div>
										<label className="block text-[10px] uppercase tracking-widest font-black text-gray-400 dark:text-gray-500 mb-3">
											<div className="flex items-center gap-1">
												<Flag className="w-3 h-3" /> Priority
											</div>
										</label>
										<div className="flex gap-2">
											{(["Low", "Medium", "High"] as Priority[]).map((p) => {
												const pInfo = PRIORITIES.find(
													(prev) => prev.label === p,
												);
												return (
													<button
														key={p}
														type="button"
														onClick={() => setPriority(p)}
														className={`flex-1 py-2 rounded-2xl text-xs font-bold transition-all border ${
															priority === p
																? "bg-white dark:bg-gray-800 shadow-xl ring-2"
																: "bg-gray-50 dark:bg-gray-800 border-transparent text-gray-500"
														}`}
														style={{
															borderColor:
																priority === p ? pInfo?.color : "transparent",
															color: priority === p ? pInfo?.color : undefined,
														}}
													>
														{p}
													</button>
												);
											})}
										</div>
									</div>
								</div>

								<div
									className={`p-5 rounded-3xl border transition-all ${
										isRecurring
											? darkMode
												? "bg-gray-900 border-gray-800"
												: "bg-white border-gray-100 shadow-sm"
											: darkMode
												? "bg-gray-900/60 border-gray-800"
												: "bg-gray-50 border-gray-100"
									}`}
								>
									<div className="flex items-center justify-between mb-4">
										<div className="flex items-center gap-3">
											<div
												className={`w-9 h-9 rounded-2xl flex items-center justify-center ${
													isRecurring
														? "bg-orange-500/10 text-orange-500"
														: "bg-gray-100 dark:bg-gray-800 text-gray-400"
												}`}
											>
												<RefreshCw className="w-4 h-4" />
											</div>
											<div>
												<p className="text-sm font-black text-gray-900 dark:text-white">
													Recurring Habit
												</p>
												<p className="text-[10px] text-gray-500 uppercase tracking-tight">
													Turn this task into a daily habit
												</p>
											</div>
										</div>
										<button
											type="button"
											onClick={() => setIsRecurring(!isRecurring)}
											className={`relative w-11 h-6 rounded-full transition-all ${
												isRecurring
													? "bg-orange-500"
													: "bg-gray-200 dark:bg-gray-700"
											}`}
										>
											<div
												className={`absolute top-1 left-1 w-5 h-5 bg-white rounded-full transition-transform ${isRecurring ? "translate-x-6" : ""}`}
											/>
										</button>
									</div>

									{isRecurring && (
										<motion.div
											initial={{ height: 0, opacity: 0 }}
											animate={{ height: "auto", opacity: 1 }}
											className="space-y-5 pt-4 border-t border-gray-100 dark:border-gray-800"
										>
											<div>
												<label className="block text-[10px] uppercase tracking-widest font-black text-gray-400 dark:text-gray-500 mb-3">
													Choose Icon
												</label>
												<div className="grid grid-cols-6 gap-2">
													{Object.keys(CATEGORY_ICONS).map((iconName) => (
														<button
															key={iconName}
															type="button"
															onClick={() => setRecurringIcon(iconName)}
															className={`aspect-square rounded-2xl flex items-center justify-center transition-all border ${
																recurringIcon === iconName
																	? "text-white border-transparent shadow-lg scale-105"
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
																className="w-4 h-4"
															/>
														</button>
													))}
												</div>
											</div>

											<div>
												<label className="block text-[10px] uppercase tracking-widest font-black text-gray-400 dark:text-gray-500 mb-3">
													Choose Color
												</label>
												<div className="grid grid-cols-7 gap-2 max-h-[200px] overflow-y-auto pr-2 custom-scrollbar">
													{HABIT_COLORS.map((color) => (
														<button
															key={color.value}
															type="button"
															onClick={() => setRecurringColor(color.value)}
															className={`aspect-square rounded-xl transition-all border-2 ${
																recurringColor === color.value
																	? "border-gray-900 dark:border-white scale-110 shadow-lg"
																	: "border-transparent hover:scale-105"
															}`}
															style={{ backgroundColor: color.value }}
															title={color.name}
														>
															{recurringColor === color.value && (
																<div className="w-full h-full flex items-center justify-center">
																	<div className="w-2 h-2 bg-white rounded-full shadow-md" />
																</div>
															)}
														</button>
													))}
												</div>
											</div>
										</motion.div>
									)}
								</div>

								<div>
									<label className="block text-[10px] uppercase tracking-widest font-black text-gray-400 dark:text-gray-500 mb-2">
										<div className="flex items-center gap-1">
											<Calendar className="w-3 h-3" /> Due Date (Optional)
										</div>
									</label>
									<input
										type="date"
										value={dueDate}
										onChange={(e) => setDueDate(e.target.value)}
										className="w-full bg-gray-50 dark:bg-gray-800 border border-gray-100 dark:border-gray-700 rounded-2xl p-4 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all font-bold text-gray-700 dark:text-gray-300"
									/>
								</div>

								<button
									type="submit"
									className="w-full py-5 bg-blue-600 text-white rounded-[24px] font-black text-lg hover:bg-blue-700 transition-all shadow-xl shadow-blue-500/30 active:scale-95"
								>
									{initialTask ? "Save Changes" : "Create Task"}
								</button>
							</form>
						</div>
					</motion.div>
				</>
			)}
		</AnimatePresence>
	);
}
