import React, { useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { AlignLeft, Sun, Moon, History, ChevronDown } from "lucide-react";
import { ViewMode } from "../types";

interface HeaderActionsProps {
	viewMode: ViewMode;
	darkMode: boolean;
	onToggleViewMode: () => void;
	onToggleDarkMode: () => void;
	onOpenJournal: () => void;
}

export const HeaderActions: React.FC<HeaderActionsProps> = ({
	viewMode,
	darkMode,
	onToggleViewMode,
	onToggleDarkMode,
	onOpenJournal,
}) => {
	const [isOpen, setIsOpen] = useState(false);

	return (
		<div className="relative">
			<button
				onClick={() => setIsOpen(!isOpen)}
				className={`p-2.5 py-3 rounded-xl shadow-sm transition-all border flex items-center gap-2 ${
					darkMode
						? "bg-gray-900 border-gray-800 text-gray-400"
						: "bg-white border-gray-100 text-gray-500 hover:bg-gray-50"
				}`}
			>
				<AlignLeft className="w-5 h-5" />
				<ChevronDown
					className={`w-4 h-4 transition-transform ${isOpen ? "rotate-180" : ""}`}
				/>
			</button>

			<AnimatePresence>
				{isOpen && (
					<>
						<div
							className="fixed inset-0 z-40"
							onClick={() => setIsOpen(false)}
						/>
						<motion.div
							initial={{ opacity: 0, y: -10, scale: 0.95 }}
							animate={{ opacity: 1, y: 0, scale: 1 }}
							exit={{ opacity: 0, y: -10, scale: 0.95 }}
							className={`fixed right-4 top-20 p-4 rounded-xl border shadow-2xl z-50 w-56 ${
								darkMode
									? "bg-gray-900 border-gray-800"
									: "bg-white border-gray-100"
							}`}
						>
							<div className="space-y-1">
								{/* View Mode */}
								<button
									onClick={() => {
										onToggleViewMode();
										setIsOpen(false);
									}}
									className={`w-full flex items-center justify-between px-3 py-2.5 rounded-2xl transition-colors ${
										darkMode
											? "hover:bg-gray-800 text-gray-400"
											: "hover:bg-gray-50 text-gray-600"
									}`}
								>
									<div className="flex items-center gap-3">
										<AlignLeft className="w-4 h-4" />
										<span className="text-sm font-bold">View Mode</span>
									</div>
									<span className="text-xs font-black uppercase text-blue-500">
										{viewMode}
									</span>
								</button>

								{/* Dark Mode Toggle */}
								<button
									onClick={() => {
										onToggleDarkMode();
										setIsOpen(false);
									}}
									className={`w-full flex items-center justify-between px-3 py-2.5 rounded-2xl transition-colors ${
										darkMode
											? "hover:bg-gray-800 text-gray-400"
											: "hover:bg-gray-50 text-gray-600"
									}`}
								>
									<div className="flex items-center gap-3">
										{darkMode ? (
											<Sun className="w-4 h-4 text-yellow-400" />
										) : (
											<Moon className="w-4 h-4" />
										)}
										<span className="text-sm font-bold">
											{darkMode ? "Light Mode" : "Dark Mode"}
										</span>
									</div>
								</button>

								<div className="h-px bg-gray-100 dark:bg-gray-800 my-1 mx-2" />

								{/* Journal */}
								<button
									onClick={() => {
										onOpenJournal();
										setIsOpen(false);
									}}
									className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-2xl transition-colors ${
										darkMode
											? "hover:bg-gray-800 text-gray-400"
											: "hover:bg-gray-50 text-gray-600"
									}`}
								>
									<History className="w-4 h-4" />
									<span className="text-sm font-bold">Journal</span>
								</button>
							</div>
						</motion.div>
					</>
				)}
			</AnimatePresence>
		</div>
	);
};
