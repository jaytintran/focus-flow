import React, { useState, useEffect } from "react";
import { motion, useAnimation } from "motion/react";
import {
	Play,
	Trash2,
	CheckCircle2,
	Circle,
	Calendar,
	AlignLeft,
	RotateCcw,
	GripVertical,
	Clock,
} from "lucide-react";
import { Task, Category, ViewMode } from "../types";
import {
	formatDuration,
	formatDueDate,
	formatScheduledTime,
	formatScheduledDate,
} from "../utils";
import { PRIORITIES } from "../constants";
import { CategoryIcon } from "./CategoryIcon";

const triggerHaptic = () => {
	if (typeof navigator !== "undefined" && navigator.vibrate) {
		navigator.vibrate(12);
	}
};

interface TaskRowProps {
	task: Task;
	category: Category | undefined;
	isActive: boolean;
	viewMode: ViewMode;
	onTogglePlay: (id: string) => void;
	onDelete: (id: string) => void;
	onToggleComplete: (id: string) => void;
	onEdit: (task: Task) => void;
	onReenter?: (id: string) => void;
	onDragStart?: (e: React.PointerEvent) => void;
}

export const TaskRow: React.FC<TaskRowProps> = ({
	task,
	category,
	isActive,
	viewMode,
	onTogglePlay,
	onDelete,
	onToggleComplete,
	onEdit,
	onReenter,
	onDragStart,
}) => {
	const priorityInfo = PRIORITIES.find((p) => p.label === task.priority);

	const hasPlay = !task.completed;
	const hasReenter = !!onReenter;
	const buttonCount = 1 + (hasReenter ? 1 : 0) + (hasPlay ? 1 : 0);

	const isCompact = viewMode === "compact";
	const isMini = viewMode === "mini";
	const buttonWidth = isCompact ? 44 : 48;
	const gap = isCompact ? 8 : 10;
	const padding = isCompact ? 10 : 16;
	// Disable swipe when task is active - only show border indicator
	const dragLimit = isActive
		? 0
		: -(buttonCount * buttonWidth + (buttonCount - 1) * gap + padding);

	const [isSwipeOpen, setIsSwipeOpen] = useState(false);
	const controls = useAnimation();

	// Close swipe panel whenever this task becomes the active working task
	useEffect(() => {
		if (isActive && isSwipeOpen) {
			closeSwipe();
		}
	}, [isActive]); // eslint-disable-line react-hooks/exhaustive-deps

	const handleDragEnd = (event: any, info: any) => {
		// Prevent swipe actions on active task
		if (isActive) {
			controls.start({
				x: 0,
				transition: {
					type: "spring",
					stiffness: 550,
					damping: 38,
					restDelta: 0.5,
				},
			});
			return;
		}

		const threshold = dragLimit * 0.35;
		const springConfig = {
			type: "spring" as const,
			stiffness: 550,
			damping: 38,
			restDelta: 0.5,
		};
		if (info.offset.x < threshold || info.velocity.x < -150) {
			if (!isSwipeOpen) triggerHaptic();
			setIsSwipeOpen(true);
			controls.start({ x: dragLimit, transition: springConfig });
		} else {
			setIsSwipeOpen(false);
			controls.start({ x: 0, transition: springConfig });
		}
	};

	const closeSwipe = () => {
		setIsSwipeOpen(false);
		controls.start({
			x: 0,
			transition: {
				type: "spring",
				stiffness: 550,
				damping: 38,
				restDelta: 0.5,
			},
		});
	};

	const handleCardClick = (e: React.MouseEvent) => {
		if (isSwipeOpen) {
			e.stopPropagation();
			closeSwipe();
		} else {
			onEdit(task);
		}
	};

	return (
		<div
			className={`relative rounded-xl w-full select-none ${isMini ? "overflow-visible" : "overflow-hidden"} ${task.completed ? "bg-gray-50 dark:bg-gray-900/30" : "bg-gray-50 dark:bg-gray-900/30"}`}
		>
			{/* Background Actions (Swipe to Reveal) - Hidden when active */}
			{!isActive && (
				<div
					className={`absolute inset-y-0 right-0 flex items-center justify-end ${
						isCompact ? "px-2.5 gap-2" : "px-4 gap-2.5"
					} z-0 transition-opacity duration-200 ${isSwipeOpen ? "opacity-100" : "opacity-0"}`}
					style={{ width: `${Math.abs(dragLimit) + 20}px` }}
				>
					<button
						onClick={(e) => {
							e.stopPropagation();
							triggerHaptic();
							onDelete(task.id);
							closeSwipe();
						}}
						className={`flex items-center justify-center text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30 transition-all ${
							isCompact ? "w-11 h-11 rounded-xl" : "w-12 h-12 rounded-2xl"
						}`}
						title="Delete task"
					>
						<Trash2 className={isCompact ? "w-4.5 h-4.5" : "w-5 h-5"} />
					</button>

					{onReenter && (
						<button
							onClick={(e) => {
								e.stopPropagation();
								triggerHaptic();
								onReenter(task.id);
								closeSwipe();
							}}
							className={`flex items-center justify-center text-gray-400 hover:text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-950/30 transition-all ${
								isCompact ? "w-11 h-11 rounded-xl" : "w-12 h-12 rounded-2xl"
							}`}
							title="Re-enter task"
						>
							<RotateCcw className={isCompact ? "w-4.5 h-4.5" : "w-5 h-5"} />
						</button>
					)}

					{!task.completed && (
						<button
							onClick={(e) => {
								e.stopPropagation();
								triggerHaptic();
								onTogglePlay(task.id);
								closeSwipe();
							}}
							className={`flex items-center justify-center transition-all shadow-sm ${
								isCompact ? "w-11 h-11 rounded-xl" : "w-12 h-12 rounded-2xl"
							} bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 hover:bg-blue-100 dark:hover:bg-blue-900/40 border border-blue-100 dark:border-blue-900/50`}
						>
							<Play
								className={
									isCompact
										? "w-4.5 h-4.5 fill-current"
										: "w-5 h-5 fill-current"
								}
							/>
						</button>
					)}
				</div>
			)}

			{/* Foreground Sliding Task Row Content */}
			<motion.div
				drag={isActive ? false : "x"}
				dragDirectionLock
				dragConstraints={{ left: dragLimit, right: 0 }}
				dragElastic={{ left: 0.25, right: 0.1 }}
				animate={controls}
				onDragEnd={handleDragEnd}
				onClick={handleCardClick}
				className={`relative z-10 group flex items-center transition-colors duration-200 border shadow-sm cursor-pointer ${
					isCompact
						? "p-2 rounded-none gap-2"
						: isMini
							? "p-2 rounded-xl gap-2"
							: "p-2.5 rounded-xl gap-3"
				} ${
					isActive
						? "ring-2 ring-blue-500 bg-blue-50 dark:bg-blue-950 border-blue-200 dark:border-blue-500/30"
						: task.completed
							? "bg-white dark:bg-gray-900 border-gray-100 dark:border-gray-800 hover:border-blue-100 dark:hover:border-blue-900"
							: "bg-white dark:bg-gray-900 border-gray-100 dark:border-gray-800 hover:border-blue-100 dark:hover:border-blue-900"
				} ${task.completed ? "opacity-50 grayscale-[0.5]" : ""}`}
			>
				{onDragStart && (
					<div
						onPointerDown={(e) => {
							// If swipe menu is open, close it first and prevent vertical dragging
							if (isSwipeOpen) {
								e.stopPropagation();
								closeSwipe();
							} else {
								onDragStart(e);
							}
						}}
						className="cursor-grab active:cursor-grabbing text-gray-300 hover:text-gray-500 dark:text-gray-700 dark:hover:text-gray-500 p-1 shrink-0 transition-colors"
						style={{ touchAction: "none" }}
						title="Drag to reorder"
					>
						<GripVertical className="w-4 h-4" />
					</div>
				)}
				<div className="flex-1 min-w-0">
					<div className="flex items-center justify-between gap-3 mb-1">
						<div className="flex items-center gap-2.5 flex-1 min-w-0">
							<button
								onClick={(e) => {
									e.stopPropagation();
									triggerHaptic();
									onToggleComplete(task.id);
								}}
								className="shrink-0 text-gray-400 hover:text-blue-500 transition-colors cursor-pointer p-1"
							>
								{task.completed ? (
									<CheckCircle2
										className={
											isCompact
												? "w-5.5 h-5.5 text-green-500"
												: "w-6 h-6 text-green-500"
										}
									/>
								) : (
									<Circle className={isCompact ? "w-5.5 h-5.5" : "w-6 h-6"} />
								)}
							</button>

							<div className="flex-1 min-w-0" onClick={handleCardClick}>
								<div className="flex items-center gap-1.5">
									<h3
										className={`${isCompact ? "text-xs" : "text-sm"} font-bold truncate ${task.completed ? "line-through text-gray-400" : "text-gray-900 dark:text-white"}`}
									>
										{task.name}
									</h3>
									{task.description && !isCompact && (
										<AlignLeft className="w-3.5 h-3.5 text-gray-400 shrink-0" />
									)}
								</div>
							</div>
						</div>
					</div>

					{!isCompact && !isMini && (
						<div className="flex flex-col gap-2">
							<div
								className="flex flex-wrap items-center gap-2 text-[9px] font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider"
								onClick={handleCardClick}
							>
								{/* PRIORITY CHIP */}
								{priorityInfo && (
									<span
										className={`text-[8px] px-1 py-0.5 rounded-full font-black uppercase tracking-wider shrink-0 ${
											task.completed
												? "bg-gray-100 text-gray-400 dark:bg-gray-800 dark:text-gray-500"
												: ""
										}`}
										style={
											task.completed
												? {}
												: {
														backgroundColor: `${priorityInfo.color}20`,
														color: priorityInfo.color,
													}
										}
									>
										{task.priority}
									</span>
								)}

								{/* CATEGORY CHIP */}
								{category && (
									<div className="flex items-center gap-1.5 bg-gray-50 dark:bg-gray-800 px-1 py-0.25 rounded-lg border border-gray-100 dark:border-gray-700">
										<CategoryIcon
											name={category.iconName}
											className="w-2.5 h-2.5"
											style={{
												color: task.completed ? "#9ca3af" : category.color,
											}}
										/>
										{category.name}
									</div>
								)}

								{/* SCHEDULED / DUE DATE CHIP */}
								{task.startAt ? (
									<div className="flex items-center gap-1 bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 px-2 py-0.5 rounded-lg border border-blue-100 dark:border-blue-900/40 shadow-sm">
										<Calendar className="w-2.5 h-2.5" />
										<span>
											{task.dueDate
												? formatScheduledDate(task.dueDate)
												: "Scheduled"}
											:{" "}
											{formatScheduledTime(
												task.startAt,
												task.endAt,
												task.duration,
											)}
										</span>
									</div>
								) : task.dueDate ? (
									<div
										className={`flex items-center gap-1 ${new Date(task.dueDate) < new Date() && !task.completed ? "text-red-500 font-bold" : ""}`}
									>
										<Calendar className="w-2.5 h-2.5" />
										{formatDueDate(task.dueDate)}
									</div>
								) : null}

								{/* SPENT TIME CHIP */}
								<div
									className={`flex items-center gap-1.5 font-mono px-1 py-0.25 rounded-lg border transition-all ${
										isActive
											? "bg-orange-500/10 border-orange-500/30 text-orange-600 dark:text-orange-400 font-bold"
											: "bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 border-blue-100 dark:border-blue-900/50"
									}`}
								>
									<motion.div
										animate={isActive ? { rotate: 360 } : { rotate: 0 }}
										transition={
											isActive
												? { repeat: Infinity, duration: 8, ease: "linear" }
												: {}
										}
										className="flex items-center justify-center shrink-0"
									>
										<Clock className="w-2.5 h-2.5" />
									</motion.div>
									{formatDuration(task.spentTime)}
								</div>
							</div>

							{/* TASK DESCRIPTION */}
							{task.description && viewMode === "detailed" && (
								<p className="text-xs text-gray-500 dark:text-gray-400 line-clamp-2 w-full mt-1">
									{task.description}
								</p>
							)}
						</div>
					)}
				</div>

				{/* MINI MODE: Floating chips on top-right border */}
				{isMini && (
					<>
						<div className="absolute -top-2 right-0 z-30 flex flex-row-reverse flex-wrap items-start gap-1 justify-end max-w-full pl-8">
							{/* SPENT TIME CHIP */}
							<div
								className={`flex items-center gap-1 font-mono px-1.5 py-0.5 rounded-md border text-[8px] shadow-sm backdrop-blur-sm ${
									isActive
										? "bg-orange-500/90 border-orange-400 text-white font-bold"
										: "bg-blue-600/90 border-blue-500 text-white"
								}`}
							>
								<Clock className="w-2 h-2" />
								{formatDuration(task.spentTime)}
							</div>

							{/* SCHEDULED / DUE DATE CHIP */}
							{task.startAt && (
								<div className="flex items-center gap-1 bg-blue-50/90 dark:bg-blue-950/90 backdrop-blur-sm text-blue-600 dark:text-blue-400 px-1.5 py-0.5 rounded-md border border-blue-100 dark:border-blue-900/40 shadow-sm text-[8px]">
									<Calendar className="w-2 h-2" />
									<span>
										{task.dueDate ? formatScheduledDate(task.dueDate) : "S"}:{" "}
										{formatScheduledTime(task.startAt, task.endAt, task.duration)}
									</span>
								</div>
							)}
							{!task.startAt && task.dueDate && (
								<div
									className={`flex items-center gap-1 px-1.5 py-0.5 rounded-md border shadow-sm text-[8px] backdrop-blur-sm ${
										new Date(task.dueDate) < new Date() && !task.completed
											? "bg-red-500/90 border-red-400 text-white font-bold"
											: "bg-gray-100/90 dark:bg-gray-800/90 border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400"
									}`}
								>
									<Calendar className="w-2 h-2" />
									{formatDueDate(task.dueDate)}
								</div>
							)}

							{/* CATEGORY CHIP */}
							{category && (
								<div
									className="flex items-center gap-1 px-1.5 py-0.5 rounded-md border shadow-sm text-[8px] backdrop-blur-sm uppercase"
									style={{
										backgroundColor: task.completed
											? "rgba(156, 163, 175, 0.9)"
											: `${category.color}90`,
										borderColor: task.completed
											? "rgba(156, 163, 175, 0.5)"
											: `${category.color}`,
										color: "#fff",
									}}
								>
									<CategoryIcon name={category.iconName} className="w-2 h-2" />
									{category.name}
								</div>
							)}

							{/* PRIORITY CHIP */}
							{priorityInfo && (
								<span
									className="px-1.5 py-0.5 rounded-md font-black uppercase tracking-wider shrink-0 text-[8px] shadow-sm backdrop-blur-sm"
									style={{
										backgroundColor: task.completed
											? "rgba(156, 163, 175, 0.9)"
											: `${priorityInfo.color}90`,
										color: "#fff",
										border: `1px solid ${task.completed ? "rgba(156, 163, 175, 0.5)" : `${priorityInfo.color}`}`,
									}}
								>
									{task.priority}
								</span>
							)}
						</div>

						{/* Compact content */}
						<div className="flex items-center gap-2 min-w-0 flex-1">
							<button
								onClick={(e) => {
									e.stopPropagation();
									triggerHaptic();
									onToggleComplete(task.id);
								}}
								className="shrink-0 text-gray-400 hover:text-blue-500 transition-colors cursor-pointer"
							>
								{task.completed ? (
									<CheckCircle2 className="w-3.5 h-3.5 text-green-500" />
								) : (
									<Circle className="w-3.5 h-3.5" />
								)}
							</button>

							{category && (
								<div
									className="flex items-center justify-center p-0.5 rounded shrink-0"
									style={{
										color: task.completed ? "#9ca3af" : category.color,
										backgroundColor: task.completed
											? "rgba(156, 163, 175, 0.15)"
											: `${category.color}15`,
									}}
								>
									<CategoryIcon name={category.iconName} className="w-3 h-3" />
								</div>
							)}

							<div className="flex-1 min-w-0" onClick={handleCardClick}>
								<h3
									className={`text-xs font-bold truncate ${task.completed ? "line-through text-gray-400" : "text-gray-900 dark:text-white"}`}
								>
									{task.name}
								</h3>
							</div>
						</div>
					</>
				)}
			</motion.div>
		</div>
	);
};
