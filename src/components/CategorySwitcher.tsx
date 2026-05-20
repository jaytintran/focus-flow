import React, { useState } from "react";
import { ChevronDown, Settings, Check } from "lucide-react";
import { Category } from "../types";
import { CategoryIcon } from "./CategoryIcon";
import { motion, AnimatePresence } from "motion/react";

interface CategorySwitcherProps {
	categories: Category[];
	selectedId: string;
	onSelect: (id: string) => void;
	onManage: () => void;
	darkMode: boolean;
	showAllTasks: boolean;
}

export const CategorySwitcher: React.FC<CategorySwitcherProps> = ({
	categories,
	selectedId,
	onSelect,
	onManage,
	darkMode,
	showAllTasks,
}) => {
	const [isOpen, setIsOpen] = useState(false);
	const visibleCategories = categories.filter(
		(c) => !c.isHidden || c.id === selectedId,
	);
	const triggerRef = React.useRef<HTMLButtonElement>(null);
	const selectedCategory = categories.find((c) => c.id === selectedId);

	return (
		<div className="relative">
			{/* Desktop View: Horizontal List */}
			<div className="hidden md:flex items-center gap-2">
				{showAllTasks && (
					<button
						onClick={() => onSelect("all")}
						className={`px-3 py-1.5 rounded-full text-xs font-bold whitespace-nowrap transition-all ${
							selectedId === "all"
								? darkMode
									? "bg-blue-500/20 text-blue-400"
									: "bg-blue-50 text-blue-700"
								: darkMode
									? "text-gray-500 hover:text-gray-400"
									: "text-gray-500 hover:text-gray-600 hover:bg-gray-100/50"
						}`}
					>
						All Tasks
					</button>
				)}
				{visibleCategories.map((cat) => (
					<button
						key={cat.id}
						onClick={() => onSelect(cat.id)}
						className={`px-3 py-1.5 rounded-full text-xs font-bold whitespace-nowrap transition-all ${
							selectedId === cat.id
								? darkMode
									? "bg-blue-500/20 text-blue-400"
									: "bg-blue-50 text-blue-700"
								: darkMode
									? "text-gray-500 hover:text-gray-400"
									: "text-gray-500 hover:text-gray-600 hover:bg-gray-100/50"
						}`}
					>
						<div className="flex items-center gap-1.5">
							<CategoryIcon
								name={cat.iconName}
								className="w-3 h-3"
								style={{ color: cat.color }}
							/>
							{cat.name}
						</div>
					</button>
				))}
				<button
					onClick={onManage}
					className={`p-1.5 rounded-full text-xs font-bold whitespace-nowrap transition-all ${
						darkMode
							? "text-gray-500 hover:text-gray-400"
							: "text-gray-400 hover:text-blue-500 hover:bg-blue-50"
					}`}
					title="Manage Categories"
				>
					<Settings className="w-4 h-4" />
				</button>
			</div>

			{/* Mobile View: Dropdown */}
			<div className="md:hidden flex items-center gap-2">
				<button
					ref={triggerRef}
					onClick={() => {
						if (!isOpen && triggerRef.current) {
							const rect = triggerRef.current.getBoundingClientRect();
							document.documentElement.style.setProperty(
								"--trigger-top",
								`${rect.top}px`,
							);
							document.documentElement.style.setProperty(
								"--trigger-height",
								`${rect.height}px`,
							);
						}
						setIsOpen(!isOpen);
					}}
					className={`flex items-center gap-2 px-4 py-2 rounded-2xl border transition-all text-sm font-bold ${
						darkMode
							? "bg-gray-900 border-gray-800 text-white"
							: "bg-white border-gray-100 text-gray-900"
					}`}
				>
					{selectedId === "all" ? (
						"All Tasks"
					) : (
						<div className="flex items-center gap-2">
							<CategoryIcon
								name={selectedCategory?.iconName}
								className="w-4 h-4"
								style={{ color: selectedCategory?.color }}
							/>
							{selectedCategory?.name}
						</div>
					)}
					<ChevronDown
						className={`w-4 h-4 transition-transform ${isOpen ? "rotate-180" : ""}`}
					/>
				</button>

				<button
					onClick={onManage}
					className={`p-2 rounded-2xl border ${
						darkMode
							? "bg-gray-900 border-gray-800 text-gray-500"
							: "bg-white border-gray-100 text-gray-400"
					}`}
				>
					<Settings className="w-4 h-4" />
				</button>

				<AnimatePresence>
					{isOpen && (
						<>
							<div
								className="fixed inset-0 z-40"
								onClick={() => setIsOpen(false)}
							/>
							<motion.div
								initial={{ opacity: 0, y: 10, scale: 0.95 }}
								animate={{ opacity: 1, y: 0, scale: 1 }}
								exit={{ opacity: 0, y: 10, scale: 0.95 }}
								className={`fixed left-4 right-4 mt-2 p-2 rounded-3xl border shadow-2xl z-50 ${
									darkMode
										? "bg-gray-900 border-gray-800"
										: "bg-white border-gray-100"
								}`}
								style={{
									top: "calc(var(--trigger-top, 0px) + var(--trigger-height, 0px) + 8px)",
									maxWidth: "320px",
								}}
							>
								<div className="space-y-1">
									{showAllTasks && (
										<button
											onClick={() => {
												onSelect("all");
												setIsOpen(false);
											}}
											className={`w-full flex items-center justify-between px-3 py-2.5 rounded-2xl transition-colors ${
												selectedId === "all"
													? darkMode
														? "bg-blue-500/10 text-blue-400"
														: "bg-blue-50 text-blue-600"
													: darkMode
														? "hover:bg-gray-800 text-gray-400"
														: "hover:bg-gray-50 text-gray-600"
											}`}
										>
											<span className="text-sm font-bold">All Tasks</span>
											{selectedId === "all" && <Check className="w-4 h-4" />}
										</button>
									)}
									{showAllTasks && visibleCategories.length > 0 && (
										<div className="h-px bg-gray-100 dark:bg-gray-800 my-1 mx-2" />
									)}
									{visibleCategories.map((cat) => (
										<button
											key={cat.id}
											onClick={() => {
												onSelect(cat.id);
												setIsOpen(false);
											}}
											className={`w-full flex items-center justify-between px-3 py-2.5 rounded-2xl transition-colors ${
												selectedId === cat.id
													? darkMode
														? "bg-blue-500/10 text-blue-400"
														: "bg-blue-50 text-blue-600"
													: darkMode
														? "hover:bg-gray-800 text-gray-400"
														: "hover:bg-gray-50 text-gray-600"
											}`}
										>
											<div className="flex items-center gap-3">
												<CategoryIcon
													name={cat.iconName}
													className="w-4 h-4"
													style={{ color: cat.color }}
												/>
												<span className="text-sm font-bold">{cat.name}</span>
											</div>
											{selectedId === cat.id && <Check className="w-4 h-4" />}
										</button>
									))}
								</div>
							</motion.div>
						</>
					)}
				</AnimatePresence>
			</div>
		</div>
	);
};
