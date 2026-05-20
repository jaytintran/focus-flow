import React, { useState, useEffect, useMemo } from "react";
import { motion, AnimatePresence, Reorder } from "motion/react";
import {
	Plus,
	Search,
	Inbox,
	Target,
	ChevronDown,
	CheckCircle2,
} from "lucide-react";
import * as Icons from "lucide-react";

import { Task, Category, JournalEntry, ViewMode, LayoutType } from "./types";
import { DEFAULT_CATEGORIES } from "./constants";
import {
	generateId,
	parseSmartInput,
	formatDateToInput,
	formatDueDate,
} from "./utils";
import { TaskRow } from "./components/TaskRow";
import { TaskTable, TaskGallery } from "./components/TaskLayouts";
import { LayoutSwitcher } from "@/src/components/LayoutSwitcher";
import { CategorySwitcher } from "./components/CategorySwitcher";
import TaskForm from "./components/TaskForm";
import JournalView from "./components/JournalView";
import WorkingBar from "./components/WorkingBar";
import CategoryManager from "./components/CategoryManager";

import { HeaderActions } from "./components/HeaderActions";
import * as db from "./db";
import { HabitRow } from "./components/HabitRow";

export default function App() {
	// State
	const [tasks, setTasks] = useState<Task[]>([]);
	const [categories, setCategories] = useState<Category[]>(DEFAULT_CATEGORIES);
	const [journalEntries, setJournalEntries] = useState<JournalEntry[]>([]);
	const [darkMode, setDarkMode] = useState(false);
	const [viewMode, setViewMode] = useState<ViewMode>("normal");
	const [layoutType, setLayoutType] = useState<LayoutType>("list");
	const [showAllTasks, setShowAllTasks] = useState<boolean>(true);
	const [isDataLoaded, setIsDataLoaded] = useState(false);
	const [activeTaskId, setActiveTaskId] = useState<string | null>(null);
	const [timerActive, setTimerActive] = useState(false);
	const [searchQuery, setSearchQuery] = useState("");
	const [selectedCategoryId, setSelectedCategoryId] = useState<string | "all">(
		() => {
			const defaultCat = categories.find((c) => c.isDefault) || categories[0];
			return defaultCat?.id || "all";
		},
	);
	const [quickAddValue, setQuickAddValue] = useState("");
	const [quickAddRecurring, setQuickAddRecurring] = useState(false);
	const [quickAddRecurringIcon, setQuickAddRecurringIcon] = useState("Flame");
	const [showIconPicker, setShowIconPicker] = useState(false);
	const [inputMode, setInputMode] = useState<"search" | "quickadd">("quickadd");

	const [showCompleted, setShowCompleted] = useState<boolean>(() => {
		const saved = localStorage.getItem("focusflow_showcompleted");
		return saved ? JSON.parse(saved) : true; // default to showing completed
	});

	// Modals/View state
	const [isTaskModalOpen, setIsTaskModalOpen] = useState(false);
	const [isJournalOpen, setIsJournalOpen] = useState(false);
	const [isCategoryModalOpen, setIsCategoryModalOpen] = useState(false);
	const [editingTask, setEditingTask] = useState<Task | null>(null);
	const [taskModalDefaultRecurring, setTaskModalDefaultRecurring] =
		useState(false); // Add this

	// Refs for robust background timer persistence
	const timerStartTimeRef = React.useRef<number | null>(null);
	const initialSpentTimeRef = React.useRef<number>(0);
	const isTimerTickRef = React.useRef<boolean>(false);

	const parsedQuickAdd = useMemo(() => {
		if (!quickAddValue.trim()) return null;
		return parseSmartInput(quickAddValue);
	}, [quickAddValue]);

	// Load data from IndexedDB on mount
	useEffect(() => {
		async function loadData() {
			try {
				// Migrate from localStorage if needed
				await db.migrateFromLocalStorage();

				const [
					savedTasks,
					savedCategories,
					savedJournal,
					savedDarkMode,
					savedViewMode,
					savedLayoutType,
					savedShowAllTasks,
					savedShowCompleted,
					savedActiveTaskId,
					savedTimerActive,
					savedTimerLastTick,
					savedTimerStartTime,
					savedInitialSpentTime,
				] = await Promise.all([
					db.getItem("focusflow_tasks"),
					db.getItem("focusflow_categories"),
					db.getItem("focusflow_journal"),
					db.getItem("focusflow_darkmode"),
					db.getItem("focusflow_viewmode"),
					db.getItem("focusflow_layouttype"),
					db.getItem("focusflow_showalltasks"),
					db.getItem("focusflow_showcompleted"),
					db.getItem("focusflow_activetaskid"),
					db.getItem("focusflow_timeractive"),
					db.getItem("focusflow_timerlasttick"),
					db.getItem("focusflow_timerstarttime"),
					db.getItem("focusflow_initialspenttime"),
				]);

				let tasksData: Task[] = [];
				if (savedTasks) tasksData = JSON.parse(savedTasks);

				if (savedCategories) setCategories(JSON.parse(savedCategories));
				if (savedJournal) setJournalEntries(JSON.parse(savedJournal));
				if (savedDarkMode) setDarkMode(savedDarkMode === "true");
				if (savedViewMode) setViewMode(savedViewMode as ViewMode);
				if (savedLayoutType) setLayoutType(savedLayoutType as LayoutType);
				if (savedShowAllTasks) setShowAllTasks(JSON.parse(savedShowAllTasks));
				if (savedShowCompleted)
					setShowCompleted(JSON.parse(savedShowCompleted));

				if (savedActiveTaskId && savedTimerActive === "true") {
					let startTimeValue = savedTimerStartTime ? parseInt(savedTimerStartTime) : null;
					let initialSpentValue = savedInitialSpentTime ? parseInt(savedInitialSpentTime) : 0;
					let elapsed = 0;
					const matchingTask = tasksData.find(t => t.id === savedActiveTaskId);
					
					if (matchingTask) {
						if (startTimeValue !== null) {
							elapsed = Date.now() - startTimeValue;
							tasksData = tasksData.map(t =>
								t.id === savedActiveTaskId ? { ...t, spentTime: initialSpentValue + Math.max(0, elapsed) } : t
							);
						} else if (savedTimerLastTick) {
							const lastTick = parseInt(savedTimerLastTick);
							elapsed = Date.now() - lastTick;
							tasksData = tasksData.map(t =>
								t.id === savedActiveTaskId ? { ...t, spentTime: t.spentTime + Math.max(0, elapsed) } : t
							);
							const updatedTask = tasksData.find(t => t.id === savedActiveTaskId);
							startTimeValue = Date.now();
							initialSpentValue = updatedTask ? updatedTask.spentTime : 0;
							db.setItem("focusflow_timerstarttime", startTimeValue.toString());
							db.setItem("focusflow_initialspenttime", initialSpentValue.toString());
						}
					}
					
					timerStartTimeRef.current = startTimeValue;
					initialSpentTimeRef.current = initialSpentValue;

					setActiveTaskId(savedActiveTaskId);
					setTimerActive(true);
				} else if (savedActiveTaskId) {
					setActiveTaskId(savedActiveTaskId);
					setTimerActive(false);
				}

				setTasks(tasksData);

				setIsDataLoaded(true);
			} catch (error) {
				console.error("Failed to load data from IndexedDB:", error);
				setIsDataLoaded(true);
			}
		}

		loadData();
	}, []);

	// Persist to IndexedDB
	useEffect(() => {
		if (!isDataLoaded) return;
		if (isTimerTickRef.current) {
			isTimerTickRef.current = false;
			return;
		}
		db.setItem("focusflow_tasks", JSON.stringify(tasks));
	}, [tasks, isDataLoaded]);

	useEffect(() => {
		if (!isDataLoaded) return;
		db.setItem("focusflow_categories", JSON.stringify(categories));
	}, [categories, isDataLoaded]);

	useEffect(() => {
		if (!isDataLoaded) return;
		db.setItem("focusflow_showalltasks", JSON.stringify(showAllTasks));
	}, [showAllTasks, isDataLoaded]);

	useEffect(() => {
		if (!isDataLoaded) return;
		db.setItem("focusflow_showcompleted", JSON.stringify(showCompleted));
	}, [showCompleted, isDataLoaded]);

	useEffect(() => {
		if (!isDataLoaded) return;
		db.setItem("focusflow_journal", JSON.stringify(journalEntries));
	}, [journalEntries, isDataLoaded]);

	useEffect(() => {
		if (!isDataLoaded) return;
		db.setItem("focusflow_darkmode", darkMode.toString());
		if (darkMode) {
			document.documentElement.classList.add("dark");
		} else {
			document.documentElement.classList.remove("dark");
		}
	}, [darkMode, isDataLoaded]);

	useEffect(() => {
		if (!isDataLoaded) return;
		db.setItem("focusflow_viewmode", viewMode);
	}, [viewMode, isDataLoaded]);

	useEffect(() => {
		if (!isDataLoaded) return;
		db.setItem("focusflow_layouttype", layoutType);
	}, [layoutType, isDataLoaded]);

	useEffect(() => {
		if (!isDataLoaded) return;
		db.setItem("focusflow_activetaskid", activeTaskId || "");
	}, [activeTaskId, isDataLoaded]);

	useEffect(() => {
		if (!isDataLoaded) return;
		db.setItem("focusflow_timeractive", timerActive.toString());
	}, [timerActive, isDataLoaded]);

	// Daily habit reset
	useEffect(() => {
		if (!isDataLoaded) return;

		const today = new Date().toISOString().split("T")[0];
		const needsReset = tasks.some(
			(t) => t.isRecurring && t.completed && !t.completedDates?.includes(today),
		);

		if (needsReset) {
			setTasks((prev) =>
				prev.map((t) => {
					if (
						t.isRecurring &&
						t.completed &&
						!t.completedDates?.includes(today)
					) {
						return {
							...t,
							completed: false,
							completedAt: undefined,
						};
					}
					return t;
				}),
			);
		}
	}, [isDataLoaded, tasks]);

	// Timer & Background visibility logic
	useEffect(() => {
		let interval: NodeJS.Timeout;
		if (timerActive && activeTaskId && isDataLoaded) {
			if (timerStartTimeRef.current === null) {
				const task = tasks.find((t) => t.id === activeTaskId);
				const currentSpent = task ? task.spentTime : 0;
				const now = Date.now();
				timerStartTimeRef.current = now;
				initialSpentTimeRef.current = currentSpent;
				db.setItem("focusflow_timerstarttime", now.toString());
				db.setItem("focusflow_initialspenttime", currentSpent.toString());
			}

			// Tick every second using elapsed time calculation (stale-closure proof)
			interval = setInterval(() => {
				const now = Date.now();
				const startTime = timerStartTimeRef.current || now;
				const initialSpent = initialSpentTimeRef.current;
				const elapsed = now - startTime;
				
				isTimerTickRef.current = true;
				setTasks((prevTasks) =>
					prevTasks.map((t) =>
						t.id === activeTaskId ? { ...t, spentTime: initialSpent + Math.max(0, elapsed) } : t,
					),
				);
				db.setItem("focusflow_timerlasttick", now.toString());
			}, 1000);
		} else {
			if (timerStartTimeRef.current !== null && isDataLoaded) {
				const elapsed = Date.now() - timerStartTimeRef.current;
				const finalTime = initialSpentTimeRef.current + Math.max(0, elapsed);
				
				timerStartTimeRef.current = null;
				initialSpentTimeRef.current = 0;
				
				db.removeItem("focusflow_timerstarttime");
				db.removeItem("focusflow_initialspenttime");

				setTasks((prevTasks) => {
					const updated = prevTasks.map((t) =>
						t.id === activeTaskId ? { ...t, spentTime: finalTime } : t,
					);
					db.setItem("focusflow_tasks", JSON.stringify(updated));
					return updated;
				});
			}
		}
		return () => clearInterval(interval);
	}, [timerActive, activeTaskId, isDataLoaded]);

	// Listen to pause/resume events (app switching / locking screen)
	useEffect(() => {
		const handleVisibilityChange = () => {
			if (document.visibilityState === "hidden" && timerActive && activeTaskId && timerStartTimeRef.current !== null) {
				const now = Date.now();
				const elapsed = now - timerStartTimeRef.current;
				const finalTime = initialSpentTimeRef.current + Math.max(0, elapsed);

				// Directly update the DB on visibility hide (synchronous hook call context safety)
				setTasks((prevTasks) => {
					const updated = prevTasks.map((t) =>
						t.id === activeTaskId ? { ...t, spentTime: finalTime } : t,
					);
					db.setItem("focusflow_tasks", JSON.stringify(updated));
					return updated;
				});
			} else if (document.visibilityState === "visible" && timerActive && activeTaskId && timerStartTimeRef.current !== null) {
				// Instant update on resume to avoid 1s tick visual delay
				const now = Date.now();
				const elapsed = now - timerStartTimeRef.current;
				const finalTime = initialSpentTimeRef.current + Math.max(0, elapsed);
				setTasks((prevTasks) =>
					prevTasks.map((t) =>
						t.id === activeTaskId ? { ...t, spentTime: finalTime } : t,
					),
				);
			}
		};

		document.addEventListener("visibilitychange", handleVisibilityChange);
		window.addEventListener("focus", handleVisibilityChange);
		return () => {
			document.removeEventListener("visibilitychange", handleVisibilityChange);
			window.removeEventListener("focus", handleVisibilityChange);
		};
	}, [timerActive, activeTaskId]);

	// Handlers
	const handleAddTask = (taskData: Partial<Task>) => {
		const defaultCat = categories.find((c) => c.isDefault) || categories[0];
		const initialCatId =
			selectedCategoryId === "all" ? defaultCat?.id || "1" : selectedCategoryId;

		const newTask: Task = {
			id: generateId(),
			name: taskData.name || "New Task",
			description: taskData.description,
			categoryId: taskData.categoryId || initialCatId,
			priority: taskData.priority || "Medium",
			spentTime: 0,
			dueDate: taskData.dueDate,
			completed: false,
			createdAt: Date.now(),
			isRecurring: taskData.isRecurring,
			recurringIcon: taskData.recurringIcon,
			completedDates: [],
		};
		setTasks([newTask, ...tasks]);
	};

	const handleQuickAdd = (e: React.FormEvent) => {
		e.preventDefault();
		if (!quickAddValue.trim()) return;

		const parsed = parseSmartInput(quickAddValue);

		// Determine category
		let catId = categories[0]?.id || "1";
		if (parsed.categoryName) {
			const found = categories.find(
				(c) => c.name.toLowerCase() === parsed?.categoryName?.toLowerCase(),
			);
			if (found) catId = found.id;
		}

		// Check if recurring from toggle OR parsed pattern
		const isRecurring = quickAddRecurring || parsed.isRecurring;

		const newTask: Task = {
			id: generateId(),
			name: parsed.cleanName,
			categoryId: catId,
			priority: parsed.priority || "Medium",
			spentTime: 0,
			dueDate: parsed.relativeDate
				? formatDateToInput(parsed.relativeDate)
				: undefined,
			completed: false,
			createdAt: Date.now(),
			isRecurring: isRecurring,
			recurringIcon: isRecurring ? quickAddRecurringIcon : undefined,
			completedDates: isRecurring ? [] : undefined,
		};

		setTasks([newTask, ...tasks]);
		setQuickAddValue("");
		setQuickAddRecurring(false); // Reset toggle
		setQuickAddRecurringIcon("Flame"); // Reset to default
	};

	const handleUpdateTask = (taskData: Partial<Task>) => {
		if (!editingTask) return;
		setTasks(
			tasks.map((t) => (t.id === editingTask.id ? { ...t, ...taskData } : t)),
		);
		// If converting to recurring, stop any active timer
		if (taskData.isRecurring && activeTaskId === editingTask.id) {
			setActiveTaskId(null);
			setTimerActive(false);
		}
		setEditingTask(null);
	};

	const handleDeleteTask = (id: string) => {
		setTasks(tasks.filter((t) => t.id !== id));
		if (activeTaskId === id) {
			setActiveTaskId(null);
			setTimerActive(false);
		}
	};

	const handleToggleComplete = (id: string) => {
		setTasks(
			tasks.map((t) => {
				if (t.id === id) {
					const completed = !t.completed;
					if (completed && activeTaskId === id) {
						setTimerActive(false);
					}
					return {
						...t,
						completed,
						completedAt: completed ? Date.now() : undefined,
					};
				}
				return t;
			}),
		);
	};

	const handleTogglePlay = (id: string) => {
		if (activeTaskId === id) {
			setTimerActive(!timerActive);
		} else {
			setActiveTaskId(id);
			setTimerActive(true);
		}
	};

	const handleResetTimer = () => {
		if (activeTaskId) {
			if (timerActive) {
				const now = Date.now();
				timerStartTimeRef.current = now;
				initialSpentTimeRef.current = 0;
				db.setItem("focusflow_timerstarttime", now.toString());
				db.setItem("focusflow_initialspenttime", "0");
			}
			setTasks(
				tasks.map((t) => (t.id === activeTaskId ? { ...t, spentTime: 0 } : t)),
			);
		}
	};

	const handleStopWorking = () => {
		setActiveTaskId(null);
		setTimerActive(false);
	};

	const handleFinishWorking = (id: string) => {
		handleToggleComplete(id);
		setActiveTaskId(null);
		setTimerActive(false);
	};

	const handleReenterTask = (id: string) => {
		const taskToReenter = tasks.find((t) => t.id === id);
		if (!taskToReenter) return;

		// 1. Mark original as completed if it's not already
		let updatedTasks = tasks;
		if (!taskToReenter.completed) {
			updatedTasks = tasks.map((t) => {
				if (t.id === id) {
					return {
						...t,
						completed: true,
						completedAt: Date.now(),
					};
				}
				return t;
			});
		}

		// 2. Create duplicate
		const newId = generateId();
		const newTask: Task = {
			...taskToReenter,
			id: newId,
			spentTime: 0,
			completed: false,
			completedAt: undefined,
			createdAt: Date.now(),
		};

		// 3. Update state (new task at the top)
		setTasks([newTask, ...updatedTasks]);

		// 4. Start timer for new task
		setActiveTaskId(newId);
		setTimerActive(true);
	};

	const handleAddJournalEntry = (entryData: Partial<JournalEntry>) => {
		const newEntry: JournalEntry = {
			id: generateId(),
			content: entryData.content || "",
			type: entryData.type || "Event",
			timestamp: entryData.timestamp || Date.now(),
			categoryId: entryData.categoryId,
		};
		setJournalEntries([newEntry, ...journalEntries]);
	};

	const handleUpdateJournalEntry = (id: string, content: string) => {
		setJournalEntries(
			journalEntries.map((e) => (e.id === id ? { ...e, content } : e)),
		);
	};

	const handleDeleteJournalEntry = (id: string) => {
		setJournalEntries(journalEntries.filter((e) => e.id !== id));
	};

	const handleToggleHabit = (id: string) => {
		const today = new Date().toISOString().split("T")[0];
		setTasks((prev) =>
			prev.map((t) => {
				if (t.id === id) {
					const currentDates = t.completedDates || [];
					const isCompletedToday = currentDates.includes(today);

					if (isCompletedToday) {
						// Uncompleting today - remove date and mark as incomplete
						return {
							...t,
							completedDates: currentDates.filter((d) => d !== today),
							completed: false, // Add this
							completedAt: undefined, // Add this
						};
					} else {
						// Completing today - add date and mark as complete
						return {
							...t,
							completedDates: [...currentDates, today],
							completed: true, // Add this
							completedAt: Date.now(), // Add this
						};
					}
				}
				return t;
			}),
		);
	};

	// Derived state
	const habits = useMemo(() => tasks.filter((t) => t.isRecurring), [tasks]);

	const { activeTasks, completedTasks } = useMemo(() => {
		const filtered = tasks
			.filter((t) => {
				const matchesSearch = t.name
					.toLowerCase()
					.includes(searchQuery.toLowerCase());
				const matchesCategory =
					selectedCategoryId === "all" || t.categoryId === selectedCategoryId;
				return matchesSearch && matchesCategory;
			})
			.sort((a, b) => {
				// Prioritize default category among non-completed tasks
				if (!a.completed && !b.completed) {
					const catA = categories.find((c) => c.id === a.categoryId);
					const catB = categories.find((c) => c.id === b.categoryId);
					if (catA?.isDefault && !catB?.isDefault) return -1;
					if (!catA?.isDefault && catB?.isDefault) return 1;
				}
				return 0;
			});

		return {
			activeTasks: filtered.filter((t) => !t.completed),
			completedTasks: filtered.filter((t) => t.completed),
		};
	}, [tasks, searchQuery, selectedCategoryId, categories]);

	const activeTask = tasks.find((t) => t.id === activeTaskId) || null;
	const stats = useMemo(() => {
		const totalSpent = tasks.reduce((acc, t) => acc + t.spentTime, 0);
		const completedCount = tasks.filter((t) => t.completed).length;
		return {
			totalSpent,
			completedCount,
			activeCount: tasks.length - completedCount,
		};
	}, [tasks]);

	const handleReorder = (newActiveTasks: Task[]) => {
		const updatedTasks = [...tasks];

		// Find all indices of the current filtered tasks in the original array
		const activeIds = new Set(activeTasks.map((t) => t.id));
		const targetIndices: number[] = [];
		tasks.forEach((task, idx) => {
			if (activeIds.has(task.id)) {
				targetIndices.push(idx);
			}
		});

		// Replace the tasks at those target indices with the new order from newFilteredTasks
		newActiveTasks.forEach((reorderedTask, i) => {
			if (i < targetIndices.length) {
				updatedTasks[targetIndices[i]] = reorderedTask;
			}
		});

		setTasks(updatedTasks);
	};

	const toggleViewMode = () => {
		const modes: ViewMode[] = ["compact", "normal", "detailed"];
		const currentIndex = modes.indexOf(viewMode);
		const nextIndex = (currentIndex + 1) % modes.length;
		setViewMode(modes[nextIndex]);
	};

	return (
		<div
			className={`min-h-screen transition-colors duration-300 ${darkMode ? "bg-gray-950 text-white" : "bg-[#F8F9FE] text-gray-900"} font-sans pb-24 sm:pb-32 overflow-x-hidden`}
		>
			{/* Header */}
			<header
				className={`sticky top-0 z-40 ${darkMode ? "bg-gray-950/80 border-gray-800" : "bg-[#F8F9FE]/80 border-gray-100"} backdrop-blur-md px-4 sm:px-6 py-3 sm:py-4 mb-4 sm:mb-5 border-b`}
			>
				<div className="w-full mx-auto flex items-center justify-between gap-4">
					<WorkingBar
						tasks={tasks}
						categories={categories}
						activeTask={activeTask}
						timerActive={timerActive}
						onSelectTask={handleTogglePlay}
						onAddTask={(name, catId) => {
							const { cleanName, relativeDate } = parseSmartInput(name);
							const id = generateId();

							const defaultCat =
								categories.find((c) => c.isDefault) || categories[0];
							const finalCatId =
								selectedCategoryId !== "all"
									? selectedCategoryId
									: catId || defaultCat?.id || "1";

							const newTask: Task = {
								id,
								name: cleanName,
								categoryId: finalCatId,
								priority: "Medium",
								spentTime: 0,
								dueDate: relativeDate
									? formatDateToInput(relativeDate)
									: undefined,
								completed: false,
								createdAt: Date.now(),
							};
							setTasks([newTask, ...tasks]);
							setActiveTaskId(id);
							setTimerActive(true);
						}}
						onToggleTimer={() => setTimerActive(!timerActive)}
						onStopTimer={handleStopWorking}
						onFinishTask={handleFinishWorking}
						onDeleteTask={handleDeleteTask}
						onReenterTask={handleReenterTask}
						darkMode={darkMode}
					/>

					{!activeTask && (
						<div className="flex items-center gap-3 shrink-0">
							<AnimatePresence>
								<motion.div
									initial={{ opacity: 0, width: 0 }}
									animate={{ opacity: 1, width: "auto" }}
									exit={{ opacity: 0, width: 0 }}
									transition={{ duration: 0.2 }}
								>
									<HeaderActions
										viewMode={viewMode}
										darkMode={darkMode}
										onToggleViewMode={toggleViewMode}
										onToggleDarkMode={() => setDarkMode(!darkMode)}
										onOpenJournal={() => setIsJournalOpen(true)}
									/>
								</motion.div>
							</AnimatePresence>
						</div>
					)}
				</div>
			</header>

			<main className="max-w-5xl mx-auto px-4 sm:px-6 space-y-4 sm:space-y-8">
				{/* Stats Section */}
				<section className="grid grid-cols-4 gap-3 sm:gap-4">
					<div
						className={`${darkMode ? "bg-gray-900 border-gray-800" : "bg-white border-gray-100"} p-4 py-2 rounded-xl border shadow-sm`}
					>
						<p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1">
							Total Focus
						</p>
						<p className="text-xl font-bold font-mono">
							{(stats.totalSpent / 3600000).toFixed(1)}h
						</p>
					</div>
					<div
						className={`${darkMode ? "bg-gray-900 border-gray-800" : "bg-white border-gray-100"} p-4 py-2 rounded-xl border shadow-sm`}
					>
						<p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1">
							Tasks Done
						</p>
						<p className="text-xl font-bold">{stats.completedCount}</p>
					</div>
					<div
						className={`${darkMode ? "bg-gray-900 border-gray-800" : "bg-white border-gray-100"} p-4 py-2 rounded-xl border shadow-sm`}
					>
						<p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1">
							To Do
						</p>
						<p className="text-xl font-bold">{stats.activeCount}</p>
					</div>
					<div
						className={`${darkMode ? "bg-blue-700" : "bg-blue-600"} p-4 py-2 rounded-xl text-white shadow-lg shadow-blue-500/20`}
					>
						<div className="flex items-center justify-between mb-1">
							<p className="text-[10px] font-bold text-blue-100 uppercase tracking-wider">
								Efficiency
							</p>
							<Target className="w-3 h-3 text-blue-200" />
						</div>
						<p className="text-xl font-bold">
							{tasks.length > 0
								? Math.round((stats.completedCount / tasks.length) * 100)
								: 0}
							%
						</p>
					</div>
				</section>

				{/* Filters, Search, Quick Add, Habits */}
				<section className="space-y-2">
					<div className="grid grid-cols-1 md:grid-cols-2 gap-2 sm:gap-3 items-center">
						{/* Unified Input with Mode Toggle */}
						<div className="relative">
							<form onSubmit={handleQuickAdd} className="relative group">
								<div
									className={`p-1 rounded-[24px] border transition-all flex items-center gap-2 shadow-sm ${darkMode ? "bg-gray-900 border-gray-800" : "bg-white border-gray-100"} focus-within:ring-2 focus-within:ring-blue-500/20 focus-within:border-blue-500`}
								>
									{/* Mode Toggle Button */}
									<button
										type="button"
										onClick={() =>
											setInputMode(
												inputMode === "search" ? "quickadd" : "search",
											)
										}
										className={`w-9 h-9 rounded-[20px] flex items-center justify-center shrink-0 transition-all ${
											darkMode
												? "bg-gray-800 hover:bg-gray-700"
												: "bg-gray-50 hover:bg-gray-100"
										}`}
										title={
											inputMode === "search"
												? "Switch to Quick Add"
												: "Switch to Search"
										}
									>
										{inputMode === "search" ? (
											<Search className="w-4 h-4 text-gray-400" />
										) : (
											<Plus className="w-4 h-4 text-blue-500" />
										)}
									</button>

									<input
										type="text"
										value={inputMode === "search" ? searchQuery : quickAddValue}
										onChange={(e) =>
											inputMode === "search"
												? setSearchQuery(e.target.value)
												: setQuickAddValue(e.target.value)
										}
										placeholder={
											inputMode === "search"
												? "Search tasks..."
												: "Quick add: #tag !high !tomorrow"
										}
										className="flex-1 bg-transparent px-2 py-2 text-xs font-bold outline-none border-none placeholder-gray-400 tracking-tight"
									/>
								</div>

								{/* Parsed Chips - Absolutely Positioned at top-right */}
								{inputMode === "quickadd" &&
									parsedQuickAdd &&
									(parsedQuickAdd.categoryName ||
										parsedQuickAdd.isRecurring ||
										parsedQuickAdd.priority ||
										parsedQuickAdd.relativeDate) && (
										<div className="absolute right-0 top-0 -translate-y-1/2 flex items-center gap-1.5 pointer-events-none">
											{parsedQuickAdd.categoryName && (
												<span className="text-[9px] px-2 py-0.5 rounded-full bg-purple-500 text-white font-bold uppercase tracking-wide whitespace-nowrap shadow-md">
													#{parsedQuickAdd.categoryName}
												</span>
											)}
											{parsedQuickAdd.isRecurring && (
												<span className="text-[9px] px-2 py-0.5 rounded-full bg-green-500 text-white font-bold uppercase tracking-wide whitespace-nowrap shadow-md">
													@{parsedQuickAdd.recurringPattern || "recurring"}
												</span>
											)}
											{parsedQuickAdd.priority && (
												<span className="text-[9px] px-2 py-0.5 rounded-full bg-orange-500 text-white font-bold uppercase tracking-wide whitespace-nowrap shadow-md">
													!{parsedQuickAdd.priority.toLowerCase()}
												</span>
											)}
											{parsedQuickAdd.relativeDate && (
												<span className="text-[9px] px-2 py-0.5 rounded-full bg-blue-500 text-white font-bold uppercase tracking-wide flex items-center gap-1 whitespace-nowrap shadow-md">
													<Icons.Calendar className="w-2.5 h-2.5" />
													{formatDueDate(
														formatDateToInput(parsedQuickAdd.relativeDate),
													)}
												</span>
											)}
										</div>
									)}
							</form>
						</div>
					</div>

					<HabitRow
						habits={habits}
						onToggleHabit={handleToggleHabit}
						onAddHabit={() => {
							setEditingTask(null);
							setTaskModalDefaultRecurring(true);
							setIsTaskModalOpen(true);
						}}
						onEditHabit={(habit) => {
							setEditingTask(habit);
							setIsTaskModalOpen(true);
						}}
						darkMode={darkMode}
					/>

					<div className="flex items-center justify-between gap-3 sm:gap-4 overflow-x-auto pb-0">
						<CategorySwitcher
							categories={categories}
							selectedId={selectedCategoryId}
							onSelect={setSelectedCategoryId}
							onManage={() => setIsCategoryModalOpen(true)}
							darkMode={darkMode}
							showAllTasks={showAllTasks}
						/>

						<LayoutSwitcher
							current={layoutType}
							onChange={setLayoutType}
							darkMode={darkMode}
						/>
					</div>
				</section>

				{/* Task List */}
				<section className="space-y-3">
					{/* Active Tasks */}
					{activeTasks.length > 0 && layoutType === "list" ? (
						<Reorder.Group
							axis="y"
							values={activeTasks}
							onReorder={handleReorder}
							className="space-y-3"
						>
							<AnimatePresence initial={false}>
								{activeTasks.map((task) => (
									<Reorder.Item
										key={task.id}
										value={task}
										initial={{ opacity: 0, y: 10 }}
										animate={{ opacity: 1, y: 0 }}
										exit={{ opacity: 0, scale: 0.95 }}
									>
										<TaskRow
											task={task}
											category={categories.find(
												(c) => c.id === task.categoryId,
											)}
											isActive={activeTaskId === task.id && timerActive}
											viewMode={viewMode}
											onTogglePlay={handleTogglePlay}
											onDelete={handleDeleteTask}
											onToggleComplete={handleToggleComplete}
											onEdit={(t) => {
												setEditingTask(t);
												setIsTaskModalOpen(true);
											}}
											onReenter={handleReenterTask}
										/>
									</Reorder.Item>
								))}
							</AnimatePresence>
						</Reorder.Group>
					) : activeTasks.length > 0 && layoutType === "gallery" ? (
						<TaskGallery
							tasks={activeTasks}
							categories={categories}
							activeTaskId={activeTaskId}
							timerActive={timerActive}
							onTogglePlay={handleTogglePlay}
							onDelete={handleDeleteTask}
							onToggleComplete={handleToggleComplete}
							onEdit={(t) => {
								setEditingTask(t);
								setIsTaskModalOpen(true);
							}}
							onReenter={handleReenterTask}
							darkMode={darkMode}
						/>
					) : activeTasks.length > 0 && layoutType === "table" ? (
						<TaskTable
							tasks={activeTasks}
							categories={categories}
							activeTaskId={activeTaskId}
							timerActive={timerActive}
							onTogglePlay={handleTogglePlay}
							onDelete={handleDeleteTask}
							onToggleComplete={handleToggleComplete}
							onEdit={(t) => {
								setEditingTask(t);
								setIsTaskModalOpen(true);
							}}
							onReenter={handleReenterTask}
							darkMode={darkMode}
						/>
					) : null}

					{/* Completed Section Toggle */}
					{completedTasks.length > 0 && (
						<div className="pt-4">
							<button
								onClick={() => setShowCompleted(!showCompleted)}
								className={`w-full flex items-center justify-between px-2 py-2 text-sm font-semibold transition-all ${
									darkMode
										? "text-gray-400 hover:text-gray-300"
										: "text-gray-500 hover:text-gray-700"
								}`}
							>
								<div className="flex items-center gap-2">
									<CheckCircle2 className="w-4 h-4" />
									<span>Completed ({completedTasks.length})</span>
								</div>
								<motion.div
									animate={{ rotate: showCompleted ? 180 : 0 }}
									transition={{ duration: 0.2 }}
								>
									<ChevronDown className="w-4 h-4" />
								</motion.div>
							</button>

							<AnimatePresence>
								{showCompleted && (
									<motion.div
										initial={{ height: 0, opacity: 0 }}
										animate={{ height: "auto", opacity: 1 }}
										exit={{ height: 0, opacity: 0 }}
										transition={{ duration: 0.2 }}
										className="overflow-hidden"
									>
										<div className="pt-3 space-y-3">
											{layoutType === "list" ? (
												<div className="space-y-3">
													{completedTasks.map((task) => (
														<motion.div
															key={task.id}
															initial={{ opacity: 0 }}
															animate={{ opacity: 1 }}
														>
															<TaskRow
																task={task}
																category={categories.find(
																	(c) => c.id === task.categoryId,
																)}
																isActive={false}
																viewMode={viewMode}
																onTogglePlay={handleTogglePlay}
																onDelete={handleDeleteTask}
																onToggleComplete={handleToggleComplete}
																onEdit={(t) => {
																	setEditingTask(t);
																	setIsTaskModalOpen(true);
																}}
																onReenter={handleReenterTask}
															/>
														</motion.div>
													))}
												</div>
											) : layoutType === "gallery" ? (
												<TaskGallery
													tasks={completedTasks}
													categories={categories}
													activeTaskId={activeTaskId}
													timerActive={timerActive}
													onTogglePlay={handleTogglePlay}
													onDelete={handleDeleteTask}
													onToggleComplete={handleToggleComplete}
													onEdit={(t) => {
														setEditingTask(t);
														setIsTaskModalOpen(true);
													}}
													onReenter={handleReenterTask}
													darkMode={darkMode}
												/>
											) : (
												<TaskTable
													tasks={completedTasks}
													categories={categories}
													activeTaskId={activeTaskId}
													timerActive={timerActive}
													onTogglePlay={handleTogglePlay}
													onDelete={handleDeleteTask}
													onToggleComplete={handleToggleComplete}
													onEdit={(t) => {
														setEditingTask(t);
														setIsTaskModalOpen(true);
													}}
													onReenter={handleReenterTask}
													darkMode={darkMode}
												/>
											)}
										</div>
									</motion.div>
								)}
							</AnimatePresence>
						</div>
					)}

					{/* Empty State */}
					{activeTasks.length === 0 && completedTasks.length === 0 && (
						<AnimatePresence>
							<motion.div
								initial={{ opacity: 0 }}
								animate={{ opacity: 1 }}
								className={`text-center py-12 sm:py-20 rounded-3xl sm:rounded-[40px] border border-dashed ${
									darkMode
										? "bg-gray-900/50 border-gray-800"
										: "bg-white border-gray-200"
								}`}
							>
								<div
									className={`w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4 ${
										darkMode ? "bg-blue-500/10" : "bg-blue-50"
									}`}
								>
									<Inbox className="w-8 h-8 text-blue-500" />
								</div>
								<h3
									className={`text-lg font-bold mb-1 ${
										darkMode ? "text-white" : "text-gray-900"
									}`}
								>
									Clear as crystal
								</h3>
								<p className="text-gray-400 text-sm">
									No tasks found. Time to relax or add one!
								</p>
							</motion.div>
						</AnimatePresence>
					)}
				</section>
			</main>

			{/* Floating Action Button */}
			<button
				onClick={() => {
					setEditingTask(null);
					setIsTaskModalOpen(true);
				}}
				className="fixed right-4 bottom-20 sm:right-6 sm:bottom-12 md:right-12 md:bottom-12 w-14 h-14 sm:w-16 sm:h-16
						bg-blue-600 hover:bg-blue-700 text-white rounded-[24px] shadow-2xl shadow-blue-500/40 flex items-center justify-center transition-all hover:scale-110 active:scale-95 z-50 group"
			>
				<Plus className="w-8 h-8 group-hover:rotate-90 transition-transform duration-300" />
			</button>

			{/* Modals */}
			<TaskForm
				isOpen={isTaskModalOpen}
				onClose={() => {
					setIsTaskModalOpen(false);
					setEditingTask(null);
					setTaskModalDefaultRecurring(false);
				}}
				onSubmit={editingTask ? handleUpdateTask : handleAddTask}
				initialTask={editingTask || undefined}
				categories={categories}
				selectedCategoryId={selectedCategoryId}
				defaultRecurring={taskModalDefaultRecurring}
				darkMode={darkMode}
			/>

			<CategoryManager
				isOpen={isCategoryModalOpen}
				onClose={() => setIsCategoryModalOpen(false)}
				categories={categories}
				onUpdate={(newCategories) => {
					setCategories(newCategories);
					
					const newCategoryIds = new Set(newCategories.map((c) => c.id));
					if (selectedCategoryId !== "all" && !newCategoryIds.has(selectedCategoryId)) {
						setSelectedCategoryId("all");
					}

					setTasks((prevTasks) =>
						prevTasks.map((t) => {
							if (t.categoryId && !newCategoryIds.has(t.categoryId)) {
								return { ...t, categoryId: "" };
							}
							return t;
						})
					);
				}}
				darkMode={darkMode}
				showAllTasks={showAllTasks}
				onToggleShowAllTasks={setShowAllTasks}
			/>

			<AnimatePresence>
				{isJournalOpen && (
					<JournalView
						onClose={() => setIsJournalOpen(false)}
						tasks={tasks}
						categories={categories}
						journalEntries={journalEntries}
						onAddEntry={handleAddJournalEntry}
						onUpdateEntry={handleUpdateJournalEntry}
						onDeleteEntry={handleDeleteJournalEntry}
						darkMode={darkMode}
					/>
				)}
			</AnimatePresence>
		</div>
	);
}

// Footer helper components or functions can go here
