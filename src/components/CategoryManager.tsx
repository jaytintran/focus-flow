import React, { useState } from "react";
import { motion, AnimatePresence, Reorder } from "motion/react";
import {
	X,
	Plus,
	Trash2,
	Check,
	Star,
	Eye,
	EyeOff,
	GripVertical,
} from "lucide-react";
import { Category } from "../types";
import { generateId } from "../utils";
import { CATEGORY_ICONS, CategoryIcon, IconName } from "./CategoryIcon";

interface CategoryManagerProps {
	isOpen: boolean;
	onClose: () => void;
	categories: Category[];
	onUpdate: (categories: Category[]) => void;
	darkMode: boolean;
	showAllTasks: boolean;
	onToggleShowAllTasks: (show: boolean) => void;
}

const COLORS = [
	"#3b82f6",
	"#10b981",
	"#ef4444",
	"#f59e0b",
	"#8b5cf6",
	"#ec4899",
	"#06b6d4",
	"#f97316",
	"#6366f1",
	"#14b8a6",
];

export default function CategoryManager({
	isOpen,
	onClose,
	categories,
	onUpdate,
	darkMode,
	showAllTasks,
	onToggleShowAllTasks,
}: CategoryManagerProps) {
	const [isAdding, setIsAdding] = useState(false);
	const [newName, setNewName] = useState("");
	const [newColor, setNewColor] = useState(COLORS[0]);
	const [newIcon, setNewIcon] = useState<IconName>("Tag");
	const [editingId, setEditingId] = useState<string | null>(null);
	const [renamingId, setRenamingId] = useState<string | null>(null);
	const [renameValue, setRenameValue] = useState("");

	const handleAdd = () => {
		if (!newName.trim()) return;
		const newCat: Category = {
			id: generateId(),
			name: newName.trim(),
			color: newColor,
			iconName: newIcon,
			isDefault: categories.length === 0,
			isHidden: false,
		};
		onUpdate([...categories, newCat]);
		setNewName("");
		setIsAdding(false);
	};

	const handleUpdate = (id: string, updates: Partial<Category>) => {
		onUpdate(categories.map((c) => (c.id === id ? { ...c, ...updates } : c)));
	};

	const handleSetDefault = (id: string) => {
		onUpdate(
			categories.map((c) => ({
				...c,
				isDefault: c.id === id,
				isHidden: c.id === id ? false : c.isHidden, // Cannot be hidden if default
			})),
		);
	};

	const handleDelete = (id: string) => {
		if (categories.length <= 1) return;
		const categoryToDelete = categories.find((c) => c.id === id);
		let newCategories = categories.filter((c) => c.id !== id);

		if (categoryToDelete?.isDefault && newCategories.length > 0) {
			newCategories[0].isDefault = true;
			newCategories[0].isHidden = false;
		}

		onUpdate(newCategories);
	};

	const handleReorder = (newOrder: Category[]) => {
		onUpdate(newOrder);
	};

	const handleStartRename = (cat: Category) => {
		setRenamingId(cat.id);
		setRenameValue(cat.name);
	};

	const handleConfirmRename = (id: string) => {
		if (renameValue.trim()) {
			handleUpdate(id, { name: renameValue.trim() });
		}
		setRenamingId(null);
		setRenameValue("");
	};

	const handleCancelRename = () => {
		setRenamingId(null);
		setRenameValue("");
	};

	return (
		<AnimatePresence>
			{isOpen && (
				<>
					<motion.div
						initial={{ opacity: 0 }}
						animate={{ opacity: 1 }}
						exit={{ opacity: 0 }}
						className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[80]"
						onClick={onClose}
					/>
					<motion.div
						initial={{ scale: 0.9, opacity: 0 }}
						animate={{ scale: 1, opacity: 1 }}
						exit={{ scale: 0.9, opacity: 0 }}
						className={`fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-lg p-8 rounded-[40px] shadow-2xl z-[90] ${
							darkMode ? "bg-gray-900 text-white" : "bg-white text-gray-900"
						}`}
					>
						<div className="flex items-center justify-between mb-8">
							<h2 className="text-2xl font-black">Manage Categories</h2>
							<button
								onClick={onClose}
								className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-2xl"
							>
								<X className="w-6 h-6 text-gray-400" />
							</button>
						</div>

						<div className="space-y-4 mb-8 max-h-[400px] overflow-y-auto pr-2 no-scrollbar">
							{/* All Tasks Toggle */}
							<div
								className={`p-4 rounded-3xl border flex items-center gap-4 ${darkMode ? "border-gray-800 bg-gray-800/30" : "border-gray-100 bg-gray-50/50"}`}
							>
								<div className="p-3 rounded-2xl bg-blue-500/10 text-blue-500">
									<Check className="w-5 h-5" />
								</div>
								<div className="flex-1">
									<p className="font-bold text-sm">All Tasks</p>
								</div>
								<button
									onClick={() => onToggleShowAllTasks(!showAllTasks)}
									className={`p-2 transition-colors ${showAllTasks ? (darkMode ? "text-blue-400" : "text-blue-500") : "text-gray-400"}`}
									title={
										showAllTasks
											? "Hide All Tasks from switcher"
											: "Show All Tasks in switcher"
									}
								>
									{showAllTasks ? (
										<Eye className="w-5 h-5" />
									) : (
										<EyeOff className="w-5 h-5" />
									)}
								</button>
							</div>

							<Reorder.Group
								axis="y"
								values={categories}
								onReorder={handleReorder}
								className="space-y-3"
							>
								{categories.map((cat) => (
									<Reorder.Item key={cat.id} value={cat} dragListener={false}>
										<div
											className={`p-4 rounded-3xl border ${darkMode ? "border-gray-800 bg-gray-800/50" : "border-gray-100 bg-gray-50"} ${cat.isHidden ? "opacity-50" : ""}`}
										>
											{editingId === cat.id ? (
												<div className="space-y-4">
													<input
														className="w-full bg-transparent border-b border-blue-500 pb-1 font-bold outline-none"
														value={cat.name}
														onChange={(e) =>
															handleUpdate(cat.id, { name: e.target.value })
														}
														autoFocus
													/>
													<div className="flex flex-wrap gap-2">
														{COLORS.map((c) => (
															<button
																key={c}
																onClick={() =>
																	handleUpdate(cat.id, { color: c })
																}
																className={`w-6 h-6 rounded-full transition-transform ${cat.color === c ? "scale-125 ring-2 ring-blue-500" : ""}`}
																style={{ backgroundColor: c }}
															/>
														))}
													</div>
													<div className="flex flex-wrap gap-3 overflow-x-auto pb-2 no-scrollbar">
														{(Object.keys(CATEGORY_ICONS) as IconName[]).map(
															(icon) => (
																<button
																	key={icon}
																	onClick={() =>
																		handleUpdate(cat.id, { iconName: icon })
																	}
																	className={`p-2 rounded-xl transition-all ${cat.iconName === icon ? (darkMode ? "bg-gray-700" : "bg-gray-200") : "opacity-40 hover:opacity-100"}`}
																>
																	<CategoryIcon
																		name={icon}
																		className="w-4 h-4"
																	/>
																</button>
															),
														)}
													</div>
													<button
														onClick={() => setEditingId(null)}
														className="w-full py-2 bg-blue-600 text-white rounded-xl text-xs font-bold"
													>
														Done
													</button>
												</div>
											) : (
												<div className="flex items-center gap-3">
													{/* Drag Handle */}
													<Reorder.Item
														value={cat}
														as="div"
														className="cursor-grab active:cursor-grabbing text-gray-300 dark:text-gray-700 hover:text-gray-400 transition-colors"
													>
														<GripVertical className="w-5 h-5" />
													</Reorder.Item>

													{/* Icon - Clickable to edit */}
													<button
														onClick={() => setEditingId(cat.id)}
														className="p-3 rounded-2xl shrink-0 hover:opacity-80 transition-opacity"
														style={{ backgroundColor: `${cat.color}20` }}
														title="Edit icon and color"
													>
														<CategoryIcon
															name={cat.iconName}
															className="w-5 h-5"
															style={{ color: cat.color }}
														/>
													</button>

													{/* Category Name - Editable */}
													<div className="flex-1 min-w-0">
														{renamingId === cat.id ? (
															<input
																type="text"
																value={renameValue}
																onChange={(e) => setRenameValue(e.target.value)}
																onKeyDown={(e) => {
																	if (e.key === "Enter")
																		handleConfirmRename(cat.id);
																	if (e.key === "Escape") handleCancelRename();
																}}
																onBlur={() => handleConfirmRename(cat.id)}
																className="w-full bg-transparent border-b border-blue-500 font-bold text-sm outline-none"
																autoFocus
															/>
														) : (
															<button
																onClick={() => handleStartRename(cat)}
																className="font-bold text-sm flex items-center gap-2 hover:text-blue-500 transition-colors text-left w-full"
															>
																{cat.name}
																{cat.isDefault && (
																	<Star className="w-3 h-3 fill-yellow-400 text-yellow-400" />
																)}
															</button>
														)}
													</div>

													{/* Action Buttons */}
													<button
														onClick={() =>
															handleUpdate(cat.id, { isHidden: !cat.isHidden })
														}
														className={`p-2 transition-colors shrink-0 ${!cat.isHidden ? (darkMode ? "text-blue-400" : "text-blue-500") : "text-gray-400"}`}
														disabled={cat.isDefault}
														title={cat.isHidden ? "Unhide" : "Hide"}
													>
														{cat.isHidden ? (
															<EyeOff className="w-5 h-5" />
														) : (
															<Eye className="w-5 h-5" />
														)}
													</button>
													<button
														onClick={() => handleSetDefault(cat.id)}
														className={`p-2 transition-colors shrink-0 ${cat.isDefault ? "text-yellow-500" : "text-gray-400 hover:text-yellow-500"}`}
														title="Set as default"
													>
														<Star
															className={`w-4 h-4 ${cat.isDefault ? "fill-current" : ""}`}
														/>
													</button>
													<button
														onClick={() => handleDelete(cat.id)}
														className="p-2 text-gray-400 hover:text-red-500 shrink-0"
														title="Delete category"
													>
														<Trash2 className="w-4 h-4" />
													</button>
												</div>
											)}
										</div>
									</Reorder.Item>
								))}
							</Reorder.Group>
						</div>

						{isAdding ? (
							<div
								className={`p-6 rounded-3xl border-2 border-dashed ${darkMode ? "border-gray-800" : "border-gray-100"}`}
							>
								<input
									placeholder="Category name..."
									className="w-full bg-transparent border-b border-gray-100 dark:border-gray-800 pb-2 mb-4 font-bold outline-none"
									value={newName}
									onChange={(e) => setNewName(e.target.value)}
									autoFocus
								/>
								<div className="flex flex-wrap gap-2 mb-4">
									{COLORS.map((c) => (
										<button
											key={c}
											onClick={() => setNewColor(c)}
											className={`w-6 h-6 rounded-full transition-transform ${newColor === c ? "scale-125 ring-2 ring-blue-500" : ""}`}
											style={{ backgroundColor: c }}
										/>
									))}
								</div>
								<div className="flex flex-wrap gap-3 mb-6 max-h-[100px] overflow-y-auto no-scrollbar">
									{(Object.keys(CATEGORY_ICONS) as IconName[]).map((icon) => (
										<button
											key={icon}
											onClick={() => setNewIcon(icon)}
											className={`p-2 rounded-xl transition-all ${newIcon === icon ? (darkMode ? "bg-gray-700" : "bg-gray-200") : "opacity-40 hover:opacity-100"}`}
										>
											<CategoryIcon name={icon} className="w-4 h-4" />
										</button>
									))}
								</div>
								<div className="flex gap-2">
									<button
										onClick={() => setIsAdding(false)}
										className="flex-1 py-3 bg-gray-100 dark:bg-gray-800 rounded-2xl font-bold text-xs"
									>
										Cancel
									</button>
									<button
										onClick={handleAdd}
										className="flex-1 py-3 bg-blue-600 text-white rounded-2xl font-bold text-xs"
									>
										Add Category
									</button>
								</div>
							</div>
						) : (
							<button
								onClick={() => setIsAdding(true)}
								className="w-full py-4 border-2 border-dashed border-gray-100 dark:border-gray-800 rounded-[24px] text-gray-400 hover:text-blue-500 hover:border-blue-500 transition-all flex items-center justify-center gap-2 font-bold"
							>
								<Plus className="w-5 h-5" />
								Add New Category
							</button>
						)}
					</motion.div>
				</>
			)}
		</AnimatePresence>
	);
}
