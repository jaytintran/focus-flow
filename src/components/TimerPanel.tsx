import { motion, AnimatePresence } from "motion/react";
import { Play, Pause, RotateCcw, Target, X } from "lucide-react";
import { Task } from "../types";
import { formatTimer } from "../utils";

interface TimerPanelProps {
	activeTask: Task | null;
	isActive: boolean;
	onToggle: () => void;
	onReset: () => void;
}

export default function TimerPanel({
	activeTask,
	isActive,
	onToggle,
	onReset,
}: TimerPanelProps) {
	return (
		<AnimatePresence>
			{activeTask && (
				<motion.div
					initial={{ y: 100, opacity: 0 }}
					animate={{ y: 0, opacity: 1 }}
					exit={{ y: 100, opacity: 0 }}
					className="fixed bottom-6 left-1/2 -translate-x-1/2 w-[90%] max-w-lg z-50"
				>
					<div className="bg-gray-900 text-white rounded-3xl shadow-2xl p-6 border border-gray-800 backdrop-blur-xl bg-opacity-95">
						<div className="flex items-center justify-between mb-4">
							<div className="flex items-center gap-3">
								<div className="p-2 bg-blue-500 bg-opacity-20 rounded-xl">
									<Target className="w-5 h-5 text-blue-400" />
								</div>
								<div>
									<p className="text-[10px] uppercase tracking-[0.2em] text-gray-500 font-bold">
										Focusing On
									</p>
									<h4 className="font-medium text-sm truncate max-w-[200px]">
										{activeTask.name}
									</h4>
								</div>
							</div>

							<div className="text-right">
								<p className="font-mono text-3xl font-light tracking-wider">
									{formatTimer(activeTask.spentTime)}
								</p>
							</div>
						</div>

						<div className="flex items-center gap-4">
							<button
								onClick={onToggle}
								className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-2xl font-bold transition-all ${
									isActive
										? "bg-orange-500 hover:bg-orange-600"
										: "bg-blue-500 hover:bg-blue-600 shadow-lg shadow-blue-500/20"
								}`}
							>
								{isActive ? (
									<>
										<Pause className="w-5 h-5" /> Pause
									</>
								) : (
									<>
										<Play className="w-5 h-5 fill-current" /> Resume
									</>
								)}
							</button>

							<button
								onClick={onReset}
								className="p-3 bg-gray-800 hover:bg-gray-700 rounded-2xl transition-all"
								title="Reset timer"
							>
								<RotateCcw className="w-6 h-6 text-gray-400" />
							</button>
						</div>
					</div>
				</motion.div>
			)}
		</AnimatePresence>
	);
}
