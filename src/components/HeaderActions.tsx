import React, { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import { AlignLeft, Sun, Moon, ChevronDown } from "lucide-react";
import { ViewMode } from "../types";

interface HeaderActionsProps {
	viewMode: ViewMode;
	darkMode: boolean;
	darkModeShade: "warm" | "medium" | "deep" | "black";
	onToggleViewMode: () => void;
	onToggleDarkMode: () => void;
	onChangeShade: (shade: "warm" | "medium" | "deep" | "black") => void;
}

export const HeaderActions: React.FC<HeaderActionsProps> = ({
	viewMode,
	darkMode,
	darkModeShade,
	onToggleViewMode,
	onToggleDarkMode,
	onChangeShade,
}) => {
	const [isOpen, setIsOpen] = useState(false);
	const containerRef = useRef<HTMLDivElement>(null);

	useEffect(() => {
		if (!isOpen) return;
		const handleClickOutside = (e: MouseEvent) => {
			if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
				setIsOpen(false);
			}
		};
		document.addEventListener("mousedown", handleClickOutside);
		return () => document.removeEventListener("mousedown", handleClickOutside);
	}, [isOpen]);

	return (
		<div className="relative" ref={containerRef}>
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

						</div>

						{/* Dark Mode Shade Picker — only when dark mode is active */}
						{darkMode && (
							<div className="px-3 py-2">
								<p className="text-[10px] font-black uppercase tracking-widest text-gray-500 mb-2">
									Dark Shade
								</p>
								<div className="grid grid-cols-4 gap-1.5">
									{[
										{ value: "warm", color: "#2a2722", label: "Warm" },
										{ value: "medium", color: "#1c1a18", label: "Medium" },
										{ value: "deep", color: "#0f0e0d", label: "Deep" },
										{ value: "black", color: "#000000", label: "Black" },
									].map((s) => (
										<button
											key={s.value}
											type="button"
											onClick={() => {
												onChangeShade(s.value as "warm" | "medium" | "deep" | "black");
												setIsOpen(false);
											}}
											className="flex flex-col items-center gap-1"
										>
											<div
												className={`w-8 h-8 rounded-xl border-2 transition-all ${
													darkModeShade === s.value
														? "border-blue-500 ring-2 ring-blue-500/30"
														: "border-gray-700"
												}`}
												style={{ backgroundColor: s.color }}
											>
												{darkModeShade === s.value && (
													<div className="w-full h-full flex items-center justify-center">
														<div className="w-1.5 h-1.5 bg-white rounded-full" />
													</div>
												)}
											</div>
											<span className="text-[8px] font-bold uppercase tracking-wide text-gray-500">
												{s.label}
											</span>
										</button>
									))}
								</div>
							</div>
						)}

					</motion.div>
				)}
			</AnimatePresence>
		</div>
	);
};
