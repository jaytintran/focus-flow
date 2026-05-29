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
  formatDurationShort,
  combineDateAndTime,
} from "./utils";
import { TaskRow } from "./components/TaskRow";
import { ReorderableTaskRow } from "./components/ReorderableTaskRow";
import { TaskTable } from "./components/TaskLayouts";
import { LayoutSwitcher } from "@/src/components/LayoutSwitcher";
import { CategorySwitcher } from "./components/CategorySwitcher";
import TaskForm from "./components/TaskForm";
import JournalView from "./components/JournalView";
import InboxView from "./components/InboxView";
import WorkingBar from "./components/WorkingBar";
import CategoryManager from "./components/CategoryManager";

import { HeaderActions } from "./components/HeaderActions";
import * as db from "./db";
import { HabitRow } from "./components/HabitRow";
import { Capacitor } from "@capacitor/core";

type ActiveView = "main" | "journal" | "inbox";
const ARCHIVE_COMPLETED_AFTER_DAYS = 90;
const ARCHIVE_COMPLETED_AFTER_MS =
  ARCHIVE_COMPLETED_AFTER_DAYS * 24 * 60 * 60 * 1000;

export default function App() {
  // State
  const [tasks, setTasks] = useState<Task[]>([]);
  const [archivedTasks, setArchivedTasks] = useState<Task[]>([]);
  const [categories, setCategories] = useState<Category[]>(DEFAULT_CATEGORIES);
  const [journalEntries, setJournalEntries] = useState<JournalEntry[]>([]);
  const [darkMode, setDarkMode] = useState(false);
  const [viewMode, setViewMode] = useState<ViewMode>("normal");
  const [layoutType, setLayoutType] = useState<LayoutType>("list");
  const [activeView, setActiveView] = useState<ActiveView>("main");
  const [showAllTasks, setShowAllTasks] = useState<boolean>(true);
  const [isDataLoaded, setIsDataLoaded] = useState(false);
  const [activeTaskId, setActiveTaskId] = useState<string | null>(null);
  const [activeSessionTaskIds, setActiveSessionTaskIds] = useState<string[]>(
    [],
  );
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

  const [showCompleted, setShowCompleted] = useState<boolean>(true);
  const [showScheduled, setShowScheduled] = useState<boolean>(true);

  const [currentTaskPage, setCurrentTaskPage] = useState<number>(1);
  const TASKS_PER_PAGE = 10;

  // Modals/View state
  const [isTaskModalOpen, setIsTaskModalOpen] = useState(false);
  const [isCategoryModalOpen, setIsCategoryModalOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [taskModalDefaultRecurring, setTaskModalDefaultRecurring] =
    useState(false); // Add this

  // Refs for robust background timer persistence
  const timerStartTimeRef = React.useRef<number | null>(null);
  const initialSpentTimesRef = React.useRef<Record<string, number>>({});
  const isTimerTickRef = React.useRef<boolean>(false);
  const activeSessionTaskIdsRef = React.useRef<string[]>([]);

  const parsedQuickAdd = useMemo(() => {
    if (!quickAddValue.trim()) return null;
    return parseSmartInput(quickAddValue);
  }, [quickAddValue]);

  const getWorkingTaskIds = React.useCallback(
    (
      primaryId = activeTaskId,
      sessionIds = activeSessionTaskIdsRef.current,
    ) => {
      const ids = new Set<string>();
      if (primaryId) ids.add(primaryId);
      sessionIds.forEach((id) => ids.add(id));
      return Array.from(ids);
    },
    [activeTaskId],
  );

  const resetTimerAnchorForSession = React.useCallback(
    (taskIds: string[], sourceTasks: Task[]) => {
      if (taskIds.length === 0) return;
      const now = Date.now();
      timerStartTimeRef.current = now;
      initialSpentTimesRef.current = Object.fromEntries(
        taskIds.map((id) => [
          id,
          sourceTasks.find((task) => task.id === id)?.spentTime || 0,
        ]),
      );
      db.setSetting("focusflow_timerstarttime", now.toString());
      db.setSetting(
        "focusflow_initialspenttimes",
        JSON.stringify(initialSpentTimesRef.current),
      );
    },
    [],
  );

  const clearTimerAnchor = React.useCallback(() => {
    timerStartTimeRef.current = null;
    initialSpentTimesRef.current = {};
    db.removeSetting("focusflow_timerstarttime");
    db.removeSetting("focusflow_initialspenttime");
    db.removeSetting("focusflow_initialspenttimes");
  }, []);

  const finalizeCurrentSession = React.useCallback(
    (taskIds = getWorkingTaskIds()) => {
      if (timerStartTimeRef.current === null || taskIds.length === 0) {
        clearTimerAnchor();
        return;
      }

      const elapsed = Date.now() - timerStartTimeRef.current;
      const initialSpentTimes = initialSpentTimesRef.current;
      const taskIdSet = new Set(taskIds);

      setTasks((prevTasks) => {
        const updated = prevTasks.map((task) =>
          taskIdSet.has(task.id)
            ? {
                ...task,
                spentTime:
                  (initialSpentTimes[task.id] ?? task.spentTime) +
                  Math.max(0, elapsed),
              }
            : task,
        );
        updated
          .filter((task) => taskIdSet.has(task.id))
          .forEach((task) => db.putTask(task));
        return updated;
      });
      clearTimerAnchor();
    },
    [clearTimerAnchor, getWorkingTaskIds],
  );

  // Load data from IndexedDB on mount
  useEffect(() => {
    // Detect and register platform classes for native devices
    if (Capacitor.isNativePlatform()) {
      document.documentElement.classList.add("plt-native");
      document.documentElement.classList.add(`plt-${Capacitor.getPlatform()}`);
    }

    async function loadData() {
      try {
        // Migrate from localStorage if needed
        await db.migrateFromLocalStorage();

        const [
          savedTasks,
          savedArchivedTasks,
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
          savedInitialSpentTimes,
          savedActiveSessionTaskIds,
        ] = await Promise.all([
          db.getTasks(),
          db.getArchivedTasks(),
          db.getCategories(),
          db.getJournalEntries(),
          db.getSetting("focusflow_darkmode"),
          db.getSetting("focusflow_viewmode"),
          db.getSetting("focusflow_layouttype"),
          db.getSetting("focusflow_showalltasks"),
          db.getSetting("focusflow_showcompleted"),
          db.getSetting("focusflow_activetaskid"),
          db.getSetting("focusflow_timeractive"),
          db.getSetting("focusflow_timerlasttick"),
          db.getSetting("focusflow_timerstarttime"),
          db.getSetting("focusflow_initialspenttime"),
          db.getSetting("focusflow_initialspenttimes"),
          db.getSetting("focusflow_activesessiontaskids"),
        ]);

        let tasksData = savedTasks;

        if (savedArchivedTasks.length > 0) setArchivedTasks(savedArchivedTasks);
        if (savedCategories.length > 0) setCategories(savedCategories);
        if (savedJournal.length > 0) setJournalEntries(savedJournal);
        if (savedDarkMode) setDarkMode(savedDarkMode === "true");
        if (savedViewMode) setViewMode(savedViewMode as ViewMode);
        if (savedLayoutType && ["list", "table"].includes(savedLayoutType))
          setLayoutType(savedLayoutType as LayoutType);
        if (savedShowAllTasks) setShowAllTasks(JSON.parse(savedShowAllTasks));
        if (savedShowCompleted)
          setShowCompleted(JSON.parse(savedShowCompleted));

        const savedSessionIds: string[] = savedActiveSessionTaskIds
          ? JSON.parse(savedActiveSessionTaskIds)
          : [];
        const validSessionIds = Array.from(
          new Set([savedActiveTaskId, ...savedSessionIds].filter(Boolean)),
        ).filter((id) => tasksData.some((task) => task.id === id));

        if (savedActiveTaskId && savedTimerActive === "true") {
          let startTimeValue = savedTimerStartTime
            ? parseInt(savedTimerStartTime)
            : null;
          let initialSpentValues: Record<string, number> = {};
          if (savedInitialSpentTimes) {
            initialSpentValues = JSON.parse(savedInitialSpentTimes);
          } else if (savedInitialSpentTime) {
            initialSpentValues[savedActiveTaskId] = parseInt(
              savedInitialSpentTime,
            );
          }
          let elapsed = 0;

          if (validSessionIds.length > 0) {
            if (startTimeValue !== null) {
              elapsed = Date.now() - startTimeValue;
              tasksData = tasksData.map((t) =>
                validSessionIds.includes(t.id)
                  ? {
                      ...t,
                      spentTime:
                        (initialSpentValues[t.id] ?? t.spentTime) +
                        Math.max(0, elapsed),
                    }
                  : t,
              );
            } else if (savedTimerLastTick) {
              const lastTick = parseInt(savedTimerLastTick);
              elapsed = Date.now() - lastTick;
              tasksData = tasksData.map((t) =>
                validSessionIds.includes(t.id)
                  ? { ...t, spentTime: t.spentTime + Math.max(0, elapsed) }
                  : t,
              );
              initialSpentValues = Object.fromEntries(
                validSessionIds.map((id) => [
                  id,
                  tasksData.find((task) => task.id === id)?.spentTime || 0,
                ]),
              );
              startTimeValue = Date.now();
              db.setSetting(
                "focusflow_timerstarttime",
                startTimeValue.toString(),
              );
              db.setSetting(
                "focusflow_initialspenttimes",
                JSON.stringify(initialSpentValues),
              );
            }
          }

          timerStartTimeRef.current = startTimeValue;
          initialSpentTimesRef.current = initialSpentValues;

          setActiveTaskId(savedActiveTaskId);
          setActiveSessionTaskIds(validSessionIds);
          activeSessionTaskIdsRef.current = validSessionIds;
          setTimerActive(true);
        } else if (savedActiveTaskId) {
          setActiveTaskId(savedActiveTaskId);
          setActiveSessionTaskIds(validSessionIds);
          activeSessionTaskIdsRef.current = validSessionIds;
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
    db.syncTasks(tasks);
  }, [tasks, isDataLoaded]);

  useEffect(() => {
    if (!isDataLoaded) return;
    db.syncArchivedTasks(archivedTasks);
  }, [archivedTasks, isDataLoaded]);

  useEffect(() => {
    if (!isDataLoaded) return;
    db.syncCategories(categories);
  }, [categories, isDataLoaded]);

  useEffect(() => {
    if (!isDataLoaded) return;
    db.setSetting("focusflow_showalltasks", JSON.stringify(showAllTasks));
  }, [showAllTasks, isDataLoaded]);

  useEffect(() => {
    if (!isDataLoaded) return;
    db.setSetting("focusflow_showcompleted", JSON.stringify(showCompleted));
  }, [showCompleted, isDataLoaded]);

  useEffect(() => {
    if (!isDataLoaded) return;
    db.syncJournalEntries(journalEntries);
  }, [journalEntries, isDataLoaded]);

  useEffect(() => {
    if (!isDataLoaded) return;
    db.setSetting("focusflow_darkmode", darkMode.toString());
    if (darkMode) {
      document.documentElement.classList.add("dark");
    } else {
      document.documentElement.classList.remove("dark");
    }
  }, [darkMode, isDataLoaded]);

  useEffect(() => {
    if (!isDataLoaded) return;
    db.setSetting("focusflow_viewmode", viewMode);
  }, [viewMode, isDataLoaded]);

  useEffect(() => {
    if (!isDataLoaded) return;
    db.setSetting("focusflow_layouttype", layoutType);
  }, [layoutType, isDataLoaded]);

  useEffect(() => {
    if (!isDataLoaded) return;
    db.setSetting("focusflow_activetaskid", activeTaskId || "");
  }, [activeTaskId, isDataLoaded]);

  useEffect(() => {
    activeSessionTaskIdsRef.current = activeSessionTaskIds;
    if (!isDataLoaded) return;
    db.setSetting(
      "focusflow_activesessiontaskids",
      JSON.stringify(activeSessionTaskIds),
    );
  }, [activeSessionTaskIds, isDataLoaded]);

  useEffect(() => {
    if (!isDataLoaded) return;
    db.setSetting("focusflow_timeractive", timerActive.toString());
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

  useEffect(() => {
    if (!isDataLoaded) return;

    const archiveBefore = Date.now() - ARCHIVE_COMPLETED_AFTER_MS;
    const shouldArchive = (task: Task) =>
      task.completed &&
      !task.isRecurring &&
      !!task.completedAt &&
      task.completedAt < archiveBefore;

    const tasksToArchive = tasks.filter(shouldArchive);
    if (tasksToArchive.length === 0) return;

    setTasks((prev) => prev.filter((task) => !shouldArchive(task)));
    setArchivedTasks((prev) => {
      const archivedById = new Map(prev.map((task) => [task.id, task]));
      for (const task of tasksToArchive) {
        archivedById.set(task.id, task);
      }
      return Array.from(archivedById.values()).sort(
        (a, b) => (b.completedAt ?? 0) - (a.completedAt ?? 0),
      );
    });
  }, [isDataLoaded, tasks]);

  // Timer & Background visibility logic
  useEffect(() => {
    let interval: NodeJS.Timeout;
    const workingTaskIds = getWorkingTaskIds();
    if (timerActive && workingTaskIds.length > 0 && isDataLoaded) {
      if (timerStartTimeRef.current === null) {
        resetTimerAnchorForSession(workingTaskIds, tasks);
      }

      // Tick every second using elapsed time calculation (stale-closure proof)
      interval = setInterval(() => {
        const now = Date.now();
        const startTime = timerStartTimeRef.current || now;
        const initialSpentTimes = initialSpentTimesRef.current;
        const elapsed = now - startTime;
        const activeIds = new Set(activeSessionTaskIdsRef.current);

        isTimerTickRef.current = true;
        setTasks((prevTasks) =>
          prevTasks.map((t) =>
            activeIds.has(t.id)
              ? {
                  ...t,
                  spentTime:
                    (initialSpentTimes[t.id] ?? t.spentTime) +
                    Math.max(0, elapsed),
                }
              : t,
          ),
        );
        db.setSetting("focusflow_timerlasttick", now.toString());
      }, 1000);
    } else {
      if (timerStartTimeRef.current !== null && isDataLoaded)
        finalizeCurrentSession();
    }
    return () => clearInterval(interval);
  }, [
    timerActive,
    activeTaskId,
    activeSessionTaskIds,
    isDataLoaded,
    getWorkingTaskIds,
    resetTimerAnchorForSession,
    finalizeCurrentSession,
  ]);

  // Listen to pause/resume events (app switching / locking screen)
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (
        document.visibilityState === "hidden" &&
        timerActive &&
        activeSessionTaskIdsRef.current.length > 0 &&
        timerStartTimeRef.current !== null
      ) {
        const now = Date.now();
        const elapsed = now - timerStartTimeRef.current;
        const initialSpentTimes = initialSpentTimesRef.current;
        const activeIds = new Set(activeSessionTaskIdsRef.current);

        // Directly update the DB on visibility hide (synchronous hook call context safety)
        setTasks((prevTasks) => {
          const updated = prevTasks.map((t) =>
            activeIds.has(t.id)
              ? {
                  ...t,
                  spentTime:
                    (initialSpentTimes[t.id] ?? t.spentTime) +
                    Math.max(0, elapsed),
                }
              : t,
          );
          updated
            .filter((task) => activeIds.has(task.id))
            .forEach((task) => db.putTask(task));
          return updated;
        });
      } else if (
        document.visibilityState === "visible" &&
        timerActive &&
        activeSessionTaskIdsRef.current.length > 0 &&
        timerStartTimeRef.current !== null
      ) {
        // Instant update on resume to avoid 1s tick visual delay
        const now = Date.now();
        const elapsed = now - timerStartTimeRef.current;
        const initialSpentTimes = initialSpentTimesRef.current;
        const activeIds = new Set(activeSessionTaskIdsRef.current);
        setTasks((prevTasks) =>
          prevTasks.map((t) =>
            activeIds.has(t.id)
              ? {
                  ...t,
                  spentTime:
                    (initialSpentTimes[t.id] ?? t.spentTime) +
                    Math.max(0, elapsed),
                }
              : t,
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
  }, [timerActive]);

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
      tag: taskData.tag || "explore",
      spentTime: 0,
      dueDate: taskData.dueDate,
      completed: false,
      createdAt: Date.now(),
      isRecurring: taskData.isRecurring,
      recurringIcon: taskData.recurringIcon,
      recurringColor: taskData.recurringColor,
      completedDates: [],
      startAt: taskData.startAt,
      duration: taskData.duration,
      endAt: taskData.endAt,
    };
    const nextTasks = [...tasks, newTask];
    setTasks(nextTasks);

    // Auto-navigate to the last page if it's active and unscheduled
    if (
      !newTask.inbox &&
      !newTask.completed &&
      !newTask.startAt &&
      !newTask.dueDate
    ) {
      const nextActiveTasksCount = nextTasks.filter(
        (t) =>
          !t.inbox &&
          !t.completed &&
          !t.startAt &&
          !t.dueDate &&
          (selectedCategoryId === "all" ||
            t.categoryId === selectedCategoryId) &&
          t.name.toLowerCase().includes(searchQuery.toLowerCase()),
      ).length;
      const nextLastPage = Math.max(
        1,
        Math.ceil(nextActiveTasksCount / TASKS_PER_PAGE),
      );
      setCurrentTaskPage(nextLastPage);
    }
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

    let startAt: number | undefined;
    let durationVal: number | undefined;
    let endAt: number | undefined;

    const dateStr = parsed.relativeDate
      ? formatDateToInput(parsed.relativeDate)
      : parsed.startTimeStr
        ? formatDateToInput(new Date())
        : undefined;

    if (parsed.startTimeStr) {
      startAt = combineDateAndTime(
        dateStr || formatDateToInput(new Date()),
        parsed.startTimeStr,
      );
      if (parsed.durationMs) {
        durationVal = parsed.durationMs;
        endAt = startAt + durationVal;
      }
    }

    const newTask: Task = {
      id: generateId(),
      name: parsed.cleanName,
      categoryId: catId,
      tag: parsed.tag || "explore",
      spentTime: 0,
      dueDate: dateStr,
      completed: false,
      createdAt: Date.now(),
      isRecurring: isRecurring,
      recurringIcon: isRecurring ? quickAddRecurringIcon : undefined,
      completedDates: isRecurring ? [] : undefined,
      startAt,
      duration: durationVal,
      endAt,
    };

    const nextTasks = [...tasks, newTask];
    setTasks(nextTasks);
    setQuickAddValue("");
    setQuickAddRecurring(false); // Reset toggle
    setQuickAddRecurringIcon("Flame"); // Reset to default

    // Auto-navigate to the last page if it's active and unscheduled
    if (
      !newTask.inbox &&
      !newTask.completed &&
      !newTask.startAt &&
      !newTask.dueDate
    ) {
      const nextActiveTasksCount = nextTasks.filter(
        (t) =>
          !t.inbox &&
          !t.completed &&
          !t.startAt &&
          !t.dueDate &&
          (selectedCategoryId === "all" ||
            t.categoryId === selectedCategoryId) &&
          t.name.toLowerCase().includes(searchQuery.toLowerCase()),
      ).length;
      const nextLastPage = Math.max(
        1,
        Math.ceil(nextActiveTasksCount / TASKS_PER_PAGE),
      );
      setCurrentTaskPage(nextLastPage);
    }
  };

  const handleUpdateTask = (taskData: Partial<Task>) => {
    if (!editingTask) return;
    const isArchivedTask = archivedTasks.some((t) => t.id === editingTask.id);
    const updatedTask = { ...editingTask, ...taskData };

    if (isArchivedTask) {
      if (updatedTask.completed === false) {
        setArchivedTasks((prev) => prev.filter((t) => t.id !== editingTask.id));
        setTasks((prev) => [...prev, updatedTask]);
      } else {
        setArchivedTasks((prev) =>
          prev.map((t) => (t.id === editingTask.id ? updatedTask : t)),
        );
      }
    } else {
      setTasks(tasks.map((t) => (t.id === editingTask.id ? updatedTask : t)));
    }
    // If converting to recurring, stop any active timer
    if (taskData.isRecurring && activeSessionTaskIds.includes(editingTask.id)) {
      finalizeCurrentSession();
      setActiveTaskId(null);
      setActiveSessionTaskIds([]);
      setTimerActive(false);
    }
    setEditingTask(null);
  };

  const handleDeleteTask = (id: string) => {
    if (activeSessionTaskIds.includes(id)) {
      finalizeCurrentSession();
      const remainingIds = activeSessionTaskIds.filter(
        (taskId) => taskId !== id,
      );
      setActiveSessionTaskIds(remainingIds);
      setActiveTaskId(remainingIds[0] || null);
      setTimerActive(remainingIds.length > 0 && timerActive);
    }
    setTasks((prev) => prev.filter((t) => t.id !== id));
    setArchivedTasks((prev) => prev.filter((t) => t.id !== id));
  };

  const handleAddInboxTask = (name: string) => {
    const parsed = parseSmartInput(name);
    const { cleanName, relativeDate, tag, startTimeStr, durationMs } = parsed;

    let startAt: number | undefined;
    let durationVal: number | undefined;
    let endAt: number | undefined;

    if (startTimeStr) {
      const dateStr = relativeDate
        ? formatDateToInput(relativeDate)
        : formatDateToInput(new Date());
      startAt = combineDateAndTime(dateStr, startTimeStr);

      if (durationMs) {
        durationVal = durationMs;
        endAt = startAt + durationVal;
      }
    }

    const newTask: Task = {
      id: generateId(),
      name: cleanName,
      categoryId: "", // Empty for inbox
      tag: tag || "explore",
      spentTime: 0,
      dueDate: relativeDate ? formatDateToInput(relativeDate) : undefined,
      completed: false,
      createdAt: Date.now(),
      inbox: true,
      startAt,
      duration: durationVal,
      endAt,
    };
    setTasks([newTask, ...tasks]);
  };

  const handleAssignCategory = (taskId: string, categoryId: string) => {
    setTasks(
      tasks.map((t) =>
        t.id === taskId ? { ...t, categoryId, inbox: false } : t,
      ),
    );
  };

  const handleUpdateInboxTask = (taskId: string, updates: Partial<Task>) => {
    setTasks(tasks.map((t) => (t.id === taskId ? { ...t, ...updates } : t)));
  };

  const handleToggleComplete = (id: string) => {
    const archivedTask = archivedTasks.find((t) => t.id === id);
    if (archivedTask) {
      const restoredTask = {
        ...archivedTask,
        completed: false,
        completedAt: undefined,
      };
      setArchivedTasks((prev) => prev.filter((t) => t.id !== id));
      setTasks((prev) => [...prev, restoredTask]);
      return;
    }

    if (activeSessionTaskIds.includes(id)) {
      finalizeCurrentSession();
    }

    setTasks((prevTasks) =>
      prevTasks.map((t) => {
        if (t.id === id) {
          const completed = !t.completed;
          if (completed && activeSessionTaskIds.includes(id)) {
            const remainingIds = activeSessionTaskIds.filter(
              (taskId) => taskId !== id,
            );
            setActiveSessionTaskIds(remainingIds);
            setActiveTaskId(remainingIds[0] || null);
            setTimerActive(remainingIds.length > 0 && timerActive);
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
    if (activeSessionTaskIds.includes(id)) {
      setTimerActive(!timerActive);
    } else {
      if (timerActive) finalizeCurrentSession();
      setActiveTaskId(id);
      setActiveSessionTaskIds([id]);
      setTimerActive(true);
    }
  };

  const handleResetTimer = () => {
    if (activeSessionTaskIds.length > 0) {
      if (timerActive) {
        const now = Date.now();
        timerStartTimeRef.current = now;
        initialSpentTimesRef.current = Object.fromEntries(
          activeSessionTaskIds.map((id) => [id, 0]),
        );
        db.setSetting("focusflow_timerstarttime", now.toString());
        db.setSetting(
          "focusflow_initialspenttimes",
          JSON.stringify(initialSpentTimesRef.current),
        );
      }
      setTasks(
        tasks.map((t) =>
          activeSessionTaskIds.includes(t.id) ? { ...t, spentTime: 0 } : t,
        ),
      );
    }
  };

  const handleStopWorking = () => {
    finalizeCurrentSession();
    setActiveTaskId(null);
    setActiveSessionTaskIds([]);
    setTimerActive(false);
  };

  const handleFinishWorking = (id: string) => {
    finalizeCurrentSession();
    handleToggleComplete(id);
    const remainingIds = activeSessionTaskIds.filter((taskId) => taskId !== id);
    setActiveSessionTaskIds(remainingIds);
    setActiveTaskId(remainingIds[0] || null);
    setTimerActive(remainingIds.length > 0 && timerActive);
  };

  const handleReenterTask = (id: string) => {
    const wasActiveSession = activeSessionTaskIds.includes(id);
    const finalSpentTimes: Record<string, number> = {};
    if (wasActiveSession && timerStartTimeRef.current !== null) {
      const elapsed = Date.now() - timerStartTimeRef.current;
      activeSessionTaskIds.forEach((taskId) => {
        const task = tasks.find((t) => t.id === taskId);
        if (task) {
          finalSpentTimes[taskId] =
            (initialSpentTimesRef.current[taskId] ?? task.spentTime) +
            Math.max(0, elapsed);
        }
      });
      clearTimerAnchor();
    }
    const taskToReenterBase =
      tasks.find((t) => t.id === id) || archivedTasks.find((t) => t.id === id);
    const taskToReenter = taskToReenterBase
      ? {
          ...taskToReenterBase,
          spentTime:
            finalSpentTimes[taskToReenterBase.id] ??
            taskToReenterBase.spentTime,
        }
      : undefined;
    if (!taskToReenter) return;

    // 1. Mark original as completed if it's not already
    let updatedTasks = tasks.map((t) =>
      finalSpentTimes[t.id] !== undefined
        ? { ...t, spentTime: finalSpentTimes[t.id] }
        : t,
    );
    if (!taskToReenter.completed) {
      updatedTasks = updatedTasks.map((t) => {
        if (t.id === id) {
          return {
            ...t,
            spentTime: finalSpentTimes[id] ?? t.spentTime,
            completed: true,
            completedAt: Date.now(),
          };
        }
        return t;
      });
    }

    // 2. Create duplicate - reset date to today
    const newId = generateId();
    const today = new Date();
    const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;

    const newTask: Task = {
      ...taskToReenter,
      id: newId,
      spentTime: 0,
      completed: false,
      completedAt: undefined,
      createdAt: Date.now(),
      // Reset scheduling to today's date
      dueDate: taskToReenter.dueDate ? todayStr : undefined,
      startAt: undefined,
      endAt: undefined,
      duration: taskToReenter.duration,
    };

    // 3. Update state (new task at the bottom)
    const nextTasks = [...updatedTasks, newTask];
    setTasks(nextTasks);

    // Calculate the new page index for the reentered task and navigate to it
    if (
      !newTask.inbox &&
      !newTask.completed &&
      !newTask.startAt &&
      !newTask.dueDate
    ) {
      const nextActiveTasksCount = nextTasks.filter(
        (t) =>
          !t.inbox &&
          !t.completed &&
          !t.startAt &&
          !t.dueDate &&
          (selectedCategoryId === "all" ||
            t.categoryId === selectedCategoryId) &&
          t.name.toLowerCase().includes(searchQuery.toLowerCase()),
      ).length;
      const nextLastPage = Math.max(
        1,
        Math.ceil(nextActiveTasksCount / TASKS_PER_PAGE),
      );
      setCurrentTaskPage(nextLastPage);
    }

    // 4. Start timer for new task
    setActiveTaskId(newId);
    setActiveSessionTaskIds([newId]);
    setTimerActive(true);
  };

  const handleAddJournalEntry = (entryData: Partial<JournalEntry>) => {
    const newEntry: JournalEntry = {
      id: generateId(),
      content: entryData.content || "",
      type: entryData.type || "Event",
      timestamp: entryData.timestamp || Date.now(),
      categoryId: entryData.categoryId,
      linkedTaskId: entryData.linkedTaskId,
      linkedTaskName: entryData.linkedTaskName,
      linkedTaskIds: entryData.linkedTaskIds,
      linkedTaskNames: entryData.linkedTaskNames,
    };
    setJournalEntries([newEntry, ...journalEntries]);
  };

  const handleAddSessionLog = (
    content: string,
    type: "SessionLog" | "Achievement",
  ) => {
    const sessionTasks = activeSessionTaskIds
      .map((id) => tasks.find((task) => task.id === id))
      .filter(Boolean) as Task[];
    const primaryTask = sessionTasks[0];
    const newEntry: JournalEntry = {
      id: generateId(),
      content,
      type,
      timestamp: Date.now(),
      categoryId: primaryTask?.categoryId,
      linkedTaskId: primaryTask?.id,
      linkedTaskName: primaryTask?.name,
      linkedTaskIds: sessionTasks.map((task) => task.id),
      linkedTaskNames: sessionTasks.map((task) => task.name),
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
  const journalTasks = useMemo(
    () => [...tasks, ...archivedTasks],
    [tasks, archivedTasks],
  );

  const { activeTasks, scheduledTasks, completedTasks } = useMemo(() => {
    const filtered = tasks.filter((t) => {
      // Exclude inbox tasks from main view
      if (t.inbox) return false;

      const matchesSearch = t.name
        .toLowerCase()
        .includes(searchQuery.toLowerCase());
      const matchesCategory =
        selectedCategoryId === "all" || t.categoryId === selectedCategoryId;
      return matchesSearch && matchesCategory;
    });

    // Sort active unscheduled tasks: preserve chronological/stored order
    const activeUnscheduled = filtered.filter(
      (t) => !t.completed && !t.startAt && !t.dueDate,
    );

    // Sort active scheduled tasks: chronologically earliest to latest
    const getTaskSortTimestamp = (task: Task): number => {
      if (task.startAt) return task.startAt;
      if (task.dueDate) {
        const [year, month, day] = task.dueDate.split("-").map(Number);
        return new Date(year, month - 1, day, 0, 0, 0, 0).getTime();
      }
      return Infinity;
    };

    const activeScheduled = filtered
      .filter((t) => !t.completed && (t.startAt || t.dueDate))
      .sort((a, b) => getTaskSortTimestamp(a) - getTaskSortTimestamp(b));

    const completed = filtered.filter((t) => t.completed);

    return {
      activeTasks: activeUnscheduled,
      scheduledTasks: activeScheduled,
      completedTasks: completed,
    };
  }, [tasks, searchQuery, selectedCategoryId, categories]);

  const totalPages = Math.max(
    1,
    Math.ceil(activeTasks.length / TASKS_PER_PAGE),
  );

  useEffect(() => {
    if (currentTaskPage > totalPages) {
      setCurrentTaskPage(totalPages);
    }
  }, [activeTasks.length, totalPages, currentTaskPage]);

  const paginatedActiveTasks = useMemo(() => {
    const startIndex = (currentTaskPage - 1) * TASKS_PER_PAGE;
    return activeTasks.slice(startIndex, startIndex + TASKS_PER_PAGE);
  }, [activeTasks, currentTaskPage]);

  const activeTask = tasks.find((t) => t.id === activeTaskId) || null;
  const activeSessionTasks = activeSessionTaskIds
    .map((id) => tasks.find((task) => task.id === id))
    .filter(Boolean) as Task[];

  const handleAddTaskToSession = (id: string) => {
    if (activeSessionTaskIds.includes(id)) return;
    const nextIds = Array.from(
      new Set([activeTaskId, ...activeSessionTaskIds, id].filter(Boolean)),
    ) as string[];
    if (timerActive) finalizeCurrentSession();
    setActiveSessionTaskIds(nextIds);
    if (!activeTaskId) setActiveTaskId(id);
  };

  const handleRemoveTaskFromSession = (id: string) => {
    if (!activeSessionTaskIds.includes(id)) return;
    if (timerActive) finalizeCurrentSession();
    const nextIds = activeSessionTaskIds.filter((taskId) => taskId !== id);
    setActiveSessionTaskIds(nextIds);
    setActiveTaskId((current) =>
      current === id ? nextIds[0] || null : current,
    );
    setTimerActive(nextIds.length > 0 && timerActive);
  };
  const stats = useMemo(() => {
    const allTasks = [...tasks, ...archivedTasks];
    const totalSpent = allTasks.reduce((acc, t) => acc + t.spentTime, 0);
    const completedCount = allTasks.filter((t) => t.completed).length;
    return {
      totalSpent,
      completedCount,
      activeCount: tasks.filter((t) => !t.completed).length,
      totalCount: allTasks.length,
    };
  }, [tasks, archivedTasks]);

  const handleReorder = (newActiveTasks: Task[]) => {
    const updatedTasks = [...tasks];

    // Find all indices of the current paginated active tasks in the original array
    const paginatedIds = new Set(paginatedActiveTasks.map((t) => t.id));
    const targetIndices: number[] = [];
    tasks.forEach((task, idx) => {
      if (paginatedIds.has(task.id)) {
        targetIndices.push(idx);
      }
    });

    // Replace the tasks at those target indices with the new order from newActiveTasks
    newActiveTasks.forEach((reorderedTask, i) => {
      if (i < targetIndices.length) {
        updatedTasks[targetIndices[i]] = reorderedTask;
      }
    });

    setTasks(updatedTasks);
  };

  const toggleViewMode = () => {
    const modes: ViewMode[] = ["compact", "normal", "mini"];
    const currentIndex = modes.indexOf(viewMode);
    const nextIndex = (currentIndex + 1) % modes.length;
    setViewMode(modes[nextIndex]);
  };

  // Derive view mode
  const isCompact = viewMode === "compact";
  const isMini = viewMode === "mini";

  return (
    <div
      className={`h-screen flex flex-col transition-colors duration-300 ${darkMode ? "bg-gray-950 text-white" : "bg-[#F8F9FE] text-gray-900"} font-sans overflow-hidden`}
    >
      {/* Header */}
      <header
        className={`app-header sticky top-0 z-40 ${darkMode ? "bg-gray-950/80 border-gray-800" : "bg-[#F8F9FE]/80 border-gray-100"} backdrop-blur-md px-4 sm:px-6 pt-[calc(env(safe-area-inset-top,0px)+12px)] pb-3 sm:py-4 border-b`}
      >
        <div className="w-full mx-auto flex items-center justify-between gap-4">
          <WorkingBar
            tasks={tasks}
            categories={categories}
            activeTask={activeTask}
            activeSessionTasks={activeSessionTasks}
            timerActive={timerActive}
            onSelectTask={handleTogglePlay}
            onAddTaskToSession={handleAddTaskToSession}
            onRemoveTaskFromSession={handleRemoveTaskFromSession}
            onAddTask={(name, catId) => {
              const parsed = parseSmartInput(name);
              const { cleanName, relativeDate, startTimeStr, durationMs, tag } =
                parsed;
              const id = generateId();

              const defaultCat =
                categories.find((c) => c.isDefault) || categories[0];
              const finalCatId =
                selectedCategoryId !== "all"
                  ? selectedCategoryId
                  : catId || defaultCat?.id || "1";

              let startAt: number | undefined;
              let durationVal: number | undefined;
              let endAt: number | undefined;

              const dateStr = relativeDate
                ? formatDateToInput(relativeDate)
                : startTimeStr
                  ? formatDateToInput(new Date())
                  : undefined;

              if (startTimeStr) {
                startAt = combineDateAndTime(
                  dateStr || formatDateToInput(new Date()),
                  startTimeStr,
                );
                if (durationMs) {
                  durationVal = durationMs;
                  endAt = startAt + durationVal;
                }
              }

              const newTask: Task = {
                id,
                name: cleanName,
                categoryId: finalCatId,
                tag: tag || "explore",
                spentTime: 0,
                dueDate: dateStr,
                completed: false,
                createdAt: Date.now(),
                startAt,
                duration: durationVal,
                endAt,
              };
              const nextTasks = [...tasks, newTask];
              setTasks(nextTasks);
              setActiveTaskId(id);
              setActiveSessionTaskIds([id]);
              setTimerActive(true);

              // Auto-navigate to the last page if it's active and unscheduled
              if (
                !newTask.inbox &&
                !newTask.completed &&
                !newTask.startAt &&
                !newTask.dueDate
              ) {
                const nextActiveTasksCount = nextTasks.filter(
                  (t) =>
                    !t.inbox &&
                    !t.completed &&
                    !t.startAt &&
                    !t.dueDate &&
                    (selectedCategoryId === "all" ||
                      t.categoryId === selectedCategoryId) &&
                    t.name.toLowerCase().includes(searchQuery.toLowerCase()),
                ).length;
                const nextLastPage = Math.max(
                  1,
                  Math.ceil(nextActiveTasksCount / TASKS_PER_PAGE),
                );
                setCurrentTaskPage(nextLastPage);
              }
            }}
            onToggleTimer={() => setTimerActive(!timerActive)}
            onStopTimer={handleStopWorking}
            onFinishTask={handleFinishWorking}
            onDeleteTask={handleDeleteTask}
            onReenterTask={handleReenterTask}
            onAddSessionLog={handleAddSessionLog}
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
                  />
                </motion.div>
              </AnimatePresence>
            </div>
          )}
        </div>
      </header>

      <nav className="px-4 py-2 shrink-0">
        <div
          className={`grid grid-cols-3 gap-1 p-1 rounded-2xl border shadow-sm ${
            darkMode
              ? "bg-gray-900 border-gray-800"
              : "bg-white border-gray-100"
          }`}
        >
          {(
            [
              ["main", "Main"],
              ["journal", "Journal"],
              ["inbox", "Inbox"],
            ] as const
          ).map(([value, label]) => (
            <button
              key={value}
              type="button"
              onClick={() => setActiveView(value)}
              className={`py-2 rounded-xl text-[11px] font-black uppercase tracking-widest transition-all ${
                activeView === value
                  ? "bg-blue-600 text-white shadow-lg shadow-blue-500/20"
                  : darkMode
                    ? "text-gray-500 hover:text-gray-300"
                    : "text-gray-400 hover:text-gray-700"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </nav>

      <main
        className={`flex-1 max-w-5xl w-full mx-auto px-4 sm:px-6 flex flex-col overflow-hidden min-h-0 ${
          activeView === "main" ? "space-y-4 sm:space-y-6" : "space-y-2"
        }`}
      >
        {activeView === "main" ? (
          <>
            {/* Stats Section */}
            <section className="grid grid-cols-4 gap-3 sm:gap-4 shrink-0">
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
                  {stats.totalCount > 0
                    ? Math.round(
                        (stats.completedCount / stats.totalCount) * 100,
                      )
                    : 0}
                  %
                </p>
              </div>
            </section>

            {/* Filters, Search, Quick Add, Habits */}
            <section className="space-y-2 shrink-0">
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
                        value={
                          inputMode === "search" ? searchQuery : quickAddValue
                        }
                        onChange={(e) =>
                          inputMode === "search"
                            ? setSearchQuery(e.target.value)
                            : setQuickAddValue(e.target.value)
                        }
                        placeholder={
                          inputMode === "search"
                            ? "Search tasks..."
                            : "Quick add: ?work !today at1pm for30m"
                        }
                        className="flex-1 bg-transparent px-2 py-2 text-xs font-bold outline-none border-none placeholder-gray-400 tracking-tight"
                      />
                    </div>

                    {/* Parsed Chips - Absolutely Positioned at top-right */}
                    {inputMode === "quickadd" &&
                      parsedQuickAdd &&
                      (parsedQuickAdd.categoryName ||
                        parsedQuickAdd.isRecurring ||
                        parsedQuickAdd.tag ||
                        parsedQuickAdd.relativeDate ||
                        parsedQuickAdd.startTimeStr ||
                        parsedQuickAdd.durationMs) && (
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
                          {parsedQuickAdd.tag && (
                            <span className="text-[9px] px-2 py-0.5 rounded-full bg-orange-500 text-white font-bold uppercase tracking-wide whitespace-nowrap shadow-md">
                              !{parsedQuickAdd.tag.toLowerCase()}
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
                          {parsedQuickAdd.startTimeStr && (
                            <span className="text-[9px] px-2 py-0.5 rounded-full bg-emerald-500 text-white font-bold uppercase tracking-wide flex items-center gap-1 whitespace-nowrap shadow-md">
                              <Icons.Clock className="w-2.5 h-2.5" />
                              {parsedQuickAdd.startTimeStr}
                            </span>
                          )}
                          {parsedQuickAdd.durationMs && (
                            <span className="text-[9px] px-2 py-0.5 rounded-full bg-amber-500 text-white font-bold uppercase tracking-wide whitespace-nowrap shadow-md">
                              {formatDurationShort(parsedQuickAdd.durationMs)}
                            </span>
                          )}
                        </div>
                      )}
                  </form>
                </div>
              </div>

              <div className="mt-2">
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
              </div>

              <div className="flex items-center justify-between gap-3 sm:gap-4 overflow-x-auto pb-0">
                <CategorySwitcher
                  categories={categories}
                  selectedId={selectedCategoryId}
                  onSelect={setSelectedCategoryId}
                  onManage={() => setIsCategoryModalOpen(true)}
                  darkMode={darkMode}
                  showAllTasks={showAllTasks}
                />

                {/* Pagination Controls */}
                {totalPages > 1 && (
                  <div className="flex items-center justify-center gap-2 shrink-0">
                    <button
                      type="button"
                      onClick={() =>
                        setCurrentTaskPage((prev) => Math.max(1, prev - 1))
                      }
                      disabled={currentTaskPage === 1}
                      className={`p-2 rounded-xl transition-all border ${
                        currentTaskPage === 1
                          ? "opacity-40 cursor-not-allowed border-transparent text-gray-400"
                          : darkMode
                            ? "border-gray-800 bg-gray-900 text-white hover:bg-gray-850 hover:border-gray-700"
                            : "border-gray-150 bg-white text-gray-750 hover:bg-gray-50 hover:border-gray-250 shadow-sm"
                      }`}
                      title="Previous Page"
                    >
                      <Icons.ChevronLeft className="w-4 h-4" />
                    </button>
                    <span
                      className={`text-xs font-bold px-4 py-1.5 rounded-full border shadow-sm ${
                        darkMode
                          ? "bg-gray-900 border-gray-800 text-gray-300"
                          : "bg-white border-gray-100 text-gray-600"
                      }`}
                    >
                      {currentTaskPage} / {totalPages}
                    </span>
                    <button
                      type="button"
                      onClick={() =>
                        setCurrentTaskPage((prev) =>
                          Math.min(totalPages, prev + 1),
                        )
                      }
                      disabled={currentTaskPage === totalPages}
                      className={`p-2 rounded-xl transition-all border ${
                        currentTaskPage === totalPages
                          ? "opacity-40 cursor-not-allowed border-transparent text-gray-400"
                          : darkMode
                            ? "border-gray-800 bg-gray-900 text-white hover:bg-gray-850 hover:border-gray-700"
                            : "border-gray-150 bg-white text-gray-750 hover:bg-gray-50 hover:border-gray-250 shadow-sm"
                      }`}
                      title="Next Page"
                    >
                      <Icons.ChevronRight className="w-4 h-4" />
                    </button>
                  </div>
                )}

                <LayoutSwitcher
                  current={layoutType}
                  onChange={setLayoutType}
                  darkMode={darkMode}
                />
              </div>
            </section>

            {/* Task List */}
            <section className="task-list-container flex-1 overflow-y-auto no-scrollbar space-y-3 min-h-0 pt-2!">
              {/* Active Tasks */}
              {paginatedActiveTasks.length > 0 && layoutType === "list" ? (
                <Reorder.Group
                  axis="y"
                  values={paginatedActiveTasks}
                  onReorder={handleReorder}
                  className={`space-y-3`}
                >
                  {paginatedActiveTasks.map((task) => (
                    <ReorderableTaskRow
                      key={task.id}
                      task={task}
                      category={categories.find(
                        (c) => c.id === task.categoryId,
                      )}
                      isActive={
                        activeSessionTaskIds.includes(task.id) && timerActive
                      }
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
                  ))}
                </Reorder.Group>
              ) : paginatedActiveTasks.length > 0 && layoutType === "table" ? (
                <TaskTable
                  tasks={paginatedActiveTasks}
                  categories={categories}
                  activeTaskId={activeTaskId}
                  activeTaskIds={activeSessionTaskIds}
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

              {/* Scheduled Section Toggle */}
              {scheduledTasks.length > 0 && (
                <div className="pt-2">
                  <button
                    onClick={() => setShowScheduled(!showScheduled)}
                    className={`w-full flex items-center justify-between px-2 py-2 text-sm font-semibold transition-all ${
                      darkMode
                        ? "text-gray-400 hover:text-gray-300"
                        : "text-gray-500 hover:text-gray-700"
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <Icons.Calendar className="w-4 h-4 text-blue-500" />
                      <span>Scheduled ({scheduledTasks.length})</span>
                    </div>
                    <motion.div
                      animate={{ rotate: showScheduled ? 180 : 0 }}
                      transition={{ duration: 0.2 }}
                    >
                      <ChevronDown className="w-4 h-4" />
                    </motion.div>
                  </button>

                  <AnimatePresence>
                    {showScheduled && (
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
                              {scheduledTasks.map((task) => (
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
                                    isActive={
                                      activeSessionTaskIds.includes(task.id) &&
                                      timerActive
                                    }
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
                          ) : (
                            <TaskTable
                              tasks={scheduledTasks}
                              categories={categories}
                              activeTaskId={activeTaskId}
                              activeTaskIds={activeSessionTaskIds}
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
                          ) : (
                            <TaskTable
                              tasks={completedTasks}
                              categories={categories}
                              activeTaskId={activeTaskId}
                              activeTaskIds={activeSessionTaskIds}
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
              {activeTasks.length === 0 &&
                scheduledTasks.length === 0 &&
                completedTasks.length === 0 && (
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
          </>
        ) : activeView === "journal" ? (
          <JournalView
            tasks={journalTasks}
            categories={categories}
            journalEntries={journalEntries}
            onAddEntry={handleAddJournalEntry}
            onUpdateEntry={handleUpdateJournalEntry}
            onDeleteEntry={handleDeleteJournalEntry}
            onToggleCompleteTask={handleToggleComplete}
            onDeleteTask={handleDeleteTask}
            onEditTask={(t) => {
              setEditingTask(t);
              setIsTaskModalOpen(true);
            }}
            darkMode={darkMode}
          />
        ) : (
          <InboxView
            tasks={tasks}
            categories={categories}
            onAddTask={handleAddInboxTask}
            onAssignCategory={handleAssignCategory}
            onUpdateTask={handleUpdateInboxTask}
            onDeleteTask={handleDeleteTask}
            darkMode={darkMode}
          />
        )}
      </main>

      {/* Floating Action Buttons */}
      {activeView === "main" && (
        <div className="fixed right-4 bottom-6 flex items-center gap-3 z-50">
          <motion.button
            whileTap={{ scale: 0.95 }}
            onClick={() => {
              setEditingTask(null);
              setIsTaskModalOpen(true);
            }}
            className="w-14 h-14 bg-blue-600 hover:bg-blue-700 text-white rounded-[24px] shadow-2xl shadow-blue-500/40 flex items-center justify-center transition-all hover:scale-110 active:scale-95 group"
          >
            <Plus className="w-8 h-8 group-hover:rotate-90 transition-transform duration-300" />
          </motion.button>
        </div>
      )}

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
          if (
            selectedCategoryId !== "all" &&
            !newCategoryIds.has(selectedCategoryId)
          ) {
            setSelectedCategoryId("all");
          }

          setTasks((prevTasks) =>
            prevTasks.map((t) => {
              if (t.categoryId && !newCategoryIds.has(t.categoryId)) {
                return { ...t, categoryId: "" };
              }
              return t;
            }),
          );
          setArchivedTasks((prevTasks) =>
            prevTasks.map((t) => {
              if (t.categoryId && !newCategoryIds.has(t.categoryId)) {
                return { ...t, categoryId: "" };
              }
              return t;
            }),
          );
        }}
        darkMode={darkMode}
        showAllTasks={showAllTasks}
        onToggleShowAllTasks={setShowAllTasks}
      />
    </div>
  );
}

// Footer helper components or functions can go here
