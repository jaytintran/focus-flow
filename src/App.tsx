import React, { useState, useEffect, useMemo } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  DndContext,
  closestCenter,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  verticalListSortingStrategy,
  arrayMove,
} from "@dnd-kit/sortable";

import {
  Plus,
  Search,
  Inbox,
  Target,
  ChevronDown,
  CheckCircle2,
  X,
} from "lucide-react";
import * as Icons from "lucide-react";

import { Task, Category, JournalEntry, ViewMode, LayoutType } from "./types";
import { DEFAULT_CATEGORIES, TAGS } from "./constants";
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
import StatsSection from "./components/StatsSection";

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
  const [groupByTopic, setGroupByTopic] = useState<boolean>(false);
  const [collapsedTopics, setCollapsedTopics] = useState<Set<string>>(
    new Set(),
  );
  const [isDataLoaded, setIsDataLoaded] = useState(false);
  const [activeTaskId, setActiveTaskId] = useState<string | null>(null);
  const [activeSessionTaskIds, setActiveSessionTaskIds] = useState<string[]>(
    [],
  );
  const [isDragging, setIsDragging] = useState(false);

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

  // Inline autocomplete popover state for quick-add
  const [popoverQuery, setPopoverQuery] = useState<{
    trigger: "?" | "#" | "@" | "+";
    partial: string;
    start: number;
    end: number;
  } | null>(null);

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

  const allTopics = useMemo(() => {
    return Array.from(new Set(tasks.flatMap((t) => t.topics || [])));
  }, [tasks]);

  // Inline autocomplete suggestions for quick-add
  const popoverSuggestions = useMemo(() => {
    if (!popoverQuery) return [];
    const q = popoverQuery.partial.toLowerCase();
    if (popoverQuery.trigger === "?") {
      return categories
        .filter((c) => c.name.toLowerCase().includes(q))
        .map((c) => ({ value: c.name, label: c.name, color: c.color }));
    }
    if (popoverQuery.trigger === "#") {
      return TAGS.filter((t) => t.label.toLowerCase().includes(q))
        .map((t) => ({ value: t.label, label: t.label, color: t.color }));
    }
    if (popoverQuery.trigger === "@") {
      const patterns = ["daily", "weekly"];
      return patterns
        .filter((p) => p.includes(q))
        .map((p) => ({ value: p, label: p, color: "#10b981" }));
    }
    if (popoverQuery.trigger === "+") {
      return allTopics
        .filter((t) => t.toLowerCase().includes(q))
        .slice(0, 8)
        .map((t) => ({ value: t, label: t, color: "#14b8a6" }));
    }
    return [];
  }, [popoverQuery, categories, allTopics]);

  // Validated chips — only show when the parsed value actually matches an existing entity
  const validCategoryChip = useMemo(() => {
    if (!parsedQuickAdd?.categoryName) return null;
    return categories.some(
      (c) => c.name.toLowerCase() === parsedQuickAdd.categoryName!.toLowerCase(),
    );
  }, [parsedQuickAdd?.categoryName, categories]);

  const validTagChip = useMemo(() => {
    if (!parsedQuickAdd?.tag) return null;
    return TAGS.some((t) => t.label === parsedQuickAdd.tag);
  }, [parsedQuickAdd?.tag]);

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
          savedGroupByTopic,
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
          db.getSetting("focusflow_groupbytopic"),
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
        if (savedGroupByTopic) setGroupByTopic(savedGroupByTopic === "true");

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
  // useEffect(() => {
  //   if (!isDataLoaded) return;
  //   if (isTimerTickRef.current) {
  //     isTimerTickRef.current = false;
  //     return;
  //   }
  //   db.syncTasks(tasks);
  // }, [tasks, isDataLoaded]);

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
    db.setSetting("focusflow_groupbytopic", groupByTopic.toString());
  }, [groupByTopic, isDataLoaded]);

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
    if (!isDataLoaded || isDragging) return;
    if (isTimerTickRef.current) {
      isTimerTickRef.current = false;
      return;
    }
    db.syncTasks(tasks);
  }, [tasks, isDataLoaded, isDragging]);

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

  const playCompleteSound = React.useCallback(() => {
    try {
      const ctx = new (
        window.AudioContext || (window as any).webkitAudioContext
      )();
      const now = ctx.currentTime;

      const osc1 = ctx.createOscillator();
      const osc2 = ctx.createOscillator();
      const gain = ctx.createGain();

      osc1.connect(gain);
      osc2.connect(gain);
      gain.connect(ctx.destination);

      osc1.type = "sine";
      osc2.type = "sine";

      // Two-note rising chime: E5 → G5
      osc1.frequency.setValueAtTime(659.25, now);
      osc1.frequency.setValueAtTime(0.001, now + 0.12);
      osc2.frequency.setValueAtTime(783.99, now + 0.1);
      osc2.frequency.setValueAtTime(0.001, now + 0.28);

      gain.gain.setValueAtTime(0, now);
      gain.gain.linearRampToValueAtTime(0.18, now + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.4);

      osc1.start(now);
      osc1.stop(now + 0.4);
      osc2.start(now + 0.1);
      osc2.stop(now + 0.4);

      setTimeout(() => ctx.close(), 500);
    } catch (_) {}
  }, []);

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
          if (completed) playCompleteSound();

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

  const handleUpdateJournalEntry = (
    id: string,
    content: string,
    updates?: Partial<JournalEntry>,
  ) => {
    setJournalEntries(
      journalEntries.map((e) =>
        e.id === id ? { ...e, content, ...updates } : e,
      ),
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

  const groupedActiveTasks = useMemo(() => {
    if (!groupByTopic) return null;

    const groups: Record<string, Task[]> = {};
    const unassigned: Task[] = [];

    activeTasks.forEach((task) => {
      if (task.topics && task.topics.length > 0) {
        task.topics.forEach((topic) => {
          const cleanTopic = topic.trim().toLowerCase();
          if (!groups[cleanTopic]) {
            groups[cleanTopic] = [];
          }
          groups[cleanTopic].push(task);
        });
      } else {
        unassigned.push(task);
      }
    });

    return { groups, unassigned };
  }, [activeTasks, groupByTopic]);

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

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8, // must move 8px before drag starts — prevents conflict with tap/swipe
      },
    }),
    useSensor(TouchSensor, {
      activationConstraint: {
        delay: 200, // hold 200ms on touch before drag activates
        tolerance: 8,
      },
    }),
  );

  const handleDragEnd = React.useCallback((event: DragEndEvent) => {
    const { active, over } = event;
    setIsDragging(false);

    if (!over || active.id === over.id) return;

    setTasks((prev) => {
      const activeIndex = prev.findIndex((t) => t.id === active.id);
      const overIndex = prev.findIndex((t) => t.id === over.id);
      if (activeIndex === -1 || overIndex === -1) return prev;
      return arrayMove(prev, activeIndex, overIndex);
    });
  }, []);

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
            {/* <StatsSection stats={stats} darkMode={darkMode} /> */}

            {/* Filters, Habits, Category Switcher */}
            <section className="space-y-2 shrink-0">

              <div className="mt-0">
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
                {totalPages > 1 && !groupByTopic && (
                  <div className="flex items-center justify-center gap-1 shrink-0">
                    <button
                      type="button"
                      onClick={() =>
                        setCurrentTaskPage((prev) => Math.max(1, prev - 1))
                      }
                      disabled={currentTaskPage === 1}
                      className={`p-1.5 rounded-lg transition-all ${
                        currentTaskPage === 1
                          ? "opacity-30 cursor-not-allowed text-gray-400"
                          : darkMode
                            ? "text-gray-400 hover:text-white hover:bg-white/5"
                            : "text-gray-400 hover:text-gray-700 hover:bg-black/5"
                      }`}
                      title="Previous Page"
                    >
                      <Icons.ChevronLeft className="w-4 h-4" />
                    </button>

                    <span
                      className={`text-xs font-bold px-2 tabular-nums ${
                        darkMode ? "text-gray-500" : "text-gray-400"
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
                      className={`p-1.5 rounded-lg transition-all ${
                        currentTaskPage === totalPages
                          ? "opacity-30 cursor-not-allowed text-gray-400"
                          : darkMode
                            ? "text-gray-400 hover:text-white hover:bg-white/5"
                            : "text-gray-400 hover:text-gray-700 hover:bg-black/5"
                      }`}
                      title="Next Page"
                    >
                      <Icons.ChevronRight className="w-4 h-4" />
                    </button>
                  </div>
                )}

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setGroupByTopic(!groupByTopic)}
                    className={`px-3 py-1.5 rounded-2xl border transition-all flex items-center gap-2 text-xs font-bold ${
                      groupByTopic
                        ? darkMode
                          ? "bg-blue-500/20 border-blue-500/30 text-blue-400 font-bold"
                          : "bg-blue-50 border-blue-100 text-blue-600 font-bold"
                        : darkMode
                          ? "bg-gray-900 border-gray-800 text-gray-400 hover:text-gray-300"
                          : "bg-white border-gray-100 text-gray-400 hover:text-gray-600"
                    }`}
                    title="Group by Topic"
                  >
                    <Icons.Layers className="w-4 h-4" />
                    <span className="hidden sm:inline">Group by Topic</span>
                  </button>

                  <LayoutSwitcher
                    current={layoutType}
                    onChange={setLayoutType}
                    darkMode={darkMode}
                  />
                </div>
              </div>
            </section>

            {/* Task List */}
            <section className="task-list-container flex-1 overflow-y-auto no-scrollbar space-y-3 min-h-0 pt-2!">
              {/* Active Tasks */}
              {groupByTopic && groupedActiveTasks ? (
                <div className="space-y-6">
                  {Object.entries(groupedActiveTasks.groups).map(
                    ([topic, groupTasks]) => {
                      const isCollapsed = collapsedTopics.has(topic);
                      return (
                        <div key={topic} className="space-y-2">
                          <button
                            type="button"
                            onClick={() =>
                              setCollapsedTopics((prev) => {
                                const next = new Set(prev);
                                if (next.has(topic)) next.delete(topic);
                                else next.add(topic);
                                return next;
                              })
                            }
                            className="flex items-center gap-2 px-2 w-full text-left"
                          >
                            <motion.div
                              animate={{ rotate: isCollapsed ? -90 : 0 }}
                              transition={{ duration: 0.15 }}
                            >
                              <ChevronDown className="w-3.5 h-3.5 text-gray-400" />
                            </motion.div>
                            <Icons.Tag className="w-3.5 h-3.5 text-teal-500" />
                            <h4 className="text-xs font-black uppercase tracking-wider text-gray-500 dark:text-gray-400">
                              {topic} ({groupTasks.length})
                            </h4>
                          </button>
                          <AnimatePresence initial={false}>
                            {!isCollapsed && (
                              <motion.div
                                initial={{ height: 0, opacity: 0 }}
                                animate={{ height: "auto", opacity: 1 }}
                                exit={{ height: 0, opacity: 0 }}
                                transition={{ duration: 0.2 }}
                                className="overflow-hidden"
                              >
                                {layoutType === "list" ? (
                                  <div className="space-y-3 pt-1">
                                    {groupTasks.map((task) => (
                                      <TaskRow
                                        key={`${topic}-${task.id}`}
                                        task={task}
                                        category={categories.find(
                                          (c) => c.id === task.categoryId,
                                        )}
                                        isActive={
                                          activeSessionTaskIds.includes(
                                            task.id,
                                          ) && timerActive
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
                                  </div>
                                ) : (
                                  <div className="pt-1">
                                    <TaskTable
                                      tasks={groupTasks}
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
                                  </div>
                                )}
                              </motion.div>
                            )}
                          </AnimatePresence>
                        </div>
                      );
                    },
                  )}

                  {groupedActiveTasks.unassigned.length > 0 && (
                    <div className="space-y-2">
                      <button
                        type="button"
                        onClick={() =>
                          setCollapsedTopics((prev) => {
                            const next = new Set(prev);
                            if (next.has("__unassigned"))
                              next.delete("__unassigned");
                            else next.add("__unassigned");
                            return next;
                          })
                        }
                        className="flex items-center gap-2 px-2 w-full text-left"
                      >
                        <motion.div
                          animate={{
                            rotate: collapsedTopics.has("__unassigned")
                              ? -90
                              : 0,
                          }}
                          transition={{ duration: 0.15 }}
                        >
                          <ChevronDown className="w-3.5 h-3.5 text-gray-400" />
                        </motion.div>
                        <Icons.HelpCircle className="w-3.5 h-3.5 text-gray-400" />
                        <h4 className="text-xs font-black uppercase tracking-wider text-gray-400">
                          Unassigned ({groupedActiveTasks.unassigned.length})
                        </h4>
                      </button>
                      <AnimatePresence initial={false}>
                        {!collapsedTopics.has("__unassigned") && (
                          <motion.div
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: "auto", opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            transition={{ duration: 0.2 }}
                            className="overflow-hidden"
                          >
                            {layoutType === "list" ? (
                              <div className="space-y-3 pt-1">
                                {groupedActiveTasks.unassigned.map((task) => (
                                  <TaskRow
                                    key={`unassigned-${task.id}`}
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
                                ))}
                              </div>
                            ) : (
                              <div className="pt-1">
                                <TaskTable
                                  tasks={groupedActiveTasks.unassigned}
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
                              </div>
                            )}
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>
                  )}
                </div>
              ) : paginatedActiveTasks.length > 0 && layoutType === "list" ? (
                <DndContext
                  sensors={sensors}
                  collisionDetection={closestCenter}
                  onDragStart={() => setIsDragging(true)}
                  onDragEnd={handleDragEnd}
                  onDragCancel={() => setIsDragging(false)}
                >
                  <SortableContext
                    items={paginatedActiveTasks.map((t) => t.id)}
                    strategy={verticalListSortingStrategy}
                  >
                    <div className="space-y-3">
                      {paginatedActiveTasks.map((task) => (
                        <ReorderableTaskRow
                          key={task.id}
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
                          onDraggingChange={setIsDragging}
                        />
                      ))}
                    </div>
                  </SortableContext>
                </DndContext>
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

      {/* Floating Bottom Bar: Quick Add / Search + FAB */}
      {activeView === "main" && (
        <div className="fixed bottom-6 left-4 right-4 z-50">
          <form onSubmit={handleQuickAdd} className="relative">
            {/* Inline autocomplete popover */}
            <AnimatePresence>
              {inputMode === "quickadd" && popoverSuggestions.length > 0 && (
                <motion.div
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 6 }}
                  transition={{ duration: 0.12 }}
                  className="absolute bottom-full left-0 mb-2 max-h-48 overflow-y-auto rounded-2xl border shadow-xl bg-white dark:bg-gray-900 border-gray-100 dark:border-gray-800 p-1.5 space-y-0.5 min-w-[160px]"
                >
                  {popoverSuggestions.map((s) => (
                    <button
                      key={s.value}
                      type="button"
                      onMouseDown={(e) => {
                        e.preventDefault();
                        setQuickAddValue(
                          quickAddValue.slice(0, popoverQuery!.start) +
                            popoverQuery!.trigger + s.value + " " +
                            quickAddValue.slice(popoverQuery!.end),
                        );
                        setPopoverQuery(null);
                        // Focus stays on input after click
                      }}
                      className="w-full text-left px-3 py-2 rounded-xl text-[11px] font-bold text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 transition-all flex items-center gap-2"
                    >
                      <span
                        className="w-2.5 h-2.5 rounded-full shrink-0"
                        style={{ backgroundColor: s.color }}
                      />
                      {popoverQuery?.trigger}{s.value}
                    </button>
                  ))}
                </motion.div>
              )}
            </AnimatePresence>

            {/* Parsed Chips - outside the bar border, above right side */}
            {inputMode === "quickadd" &&
              parsedQuickAdd &&
              (validCategoryChip ||
                parsedQuickAdd.isRecurring ||
                parsedQuickAdd.tag ||
                parsedQuickAdd.relativeDate ||
                parsedQuickAdd.startTimeStr ||
                parsedQuickAdd.durationMs) && (
                <div className="absolute bottom-full right-0 mb-2 flex items-center gap-1.5 pointer-events-none">
                  {validCategoryChip && (
                    <span className="text-[9px] px-2 py-0.5 rounded-full bg-purple-500 text-white font-bold uppercase tracking-wide whitespace-nowrap shadow-md">
                      #{parsedQuickAdd.categoryName}
                    </span>
                  )}
                  {parsedQuickAdd.isRecurring && (
                    <span className="text-[9px] px-2 py-0.5 rounded-full bg-green-500 text-white font-bold uppercase tracking-wide whitespace-nowrap shadow-md">
                      @{parsedQuickAdd.recurringPattern || "recurring"}
                    </span>
                  )}
                  {validTagChip && (
                    <span className="text-[9px] px-2 py-0.5 rounded-full bg-orange-500 text-white font-bold uppercase tracking-wide whitespace-nowrap shadow-md">
                      !{parsedQuickAdd.tag!.toLowerCase()}
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

            {/* The bar itself */}
            <div
              className={`w-full p-1 rounded-[24px] border flex items-center gap-2 shadow-xl transition-all ${darkMode ? "bg-gray-900 border-gray-800" : "bg-white border-gray-100"}`}
            >
              {/* Mode Toggle Button (left end) */}
              <button
                type="button"
                onClick={() => {
                  setInputMode(
                    inputMode === "search" ? "quickadd" : "search",
                  );
                  setPopoverQuery(null);
                }}
                className={`w-10 h-10 rounded-[20px] flex items-center justify-center shrink-0 transition-all ${
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
                onChange={(e) => {
                  const val = e.target.value;
                  if (inputMode === "search") {
                    setSearchQuery(val);
                    return;
                  }
                  setQuickAddValue(val);

                  // Detect trigger character in the last word
                  const cursor = e.target.selectionStart ?? val.length;
                  const beforeCursor = val.slice(0, cursor).toLowerCase();
                  const triggerMatch = beforeCursor.match(
                    /([?#@+])(\w*)$/,
                  );
                  if (
                    triggerMatch &&
                    (
                      triggerMatch[1] === "?" ||
                      triggerMatch[1] === "#" ||
                      triggerMatch[1] === "@" ||
                      triggerMatch[1] === "+"
                    )
                  ) {
                    const fullTrigger = triggerMatch[1] as "?" | "#" | "@" | "+";
                    const start = triggerMatch.index!;
                    const end = start + triggerMatch[0].length;
                    setPopoverQuery({
                      trigger: fullTrigger,
                      partial: triggerMatch[2],
                      start,
                      end,
                    });
                  } else {
                    setPopoverQuery(null);
                  }
                }}
                onKeyDown={(e) => {
                  if (e.key === "Tab" && popoverSuggestions.length > 0 && popoverQuery) {
                    e.preventDefault();
                    const s = popoverSuggestions[0];
                    setQuickAddValue(
                      quickAddValue.slice(0, popoverQuery.start) +
                        popoverQuery.trigger + s.value + " " +
                        quickAddValue.slice(popoverQuery.end),
                    );
                    setPopoverQuery(null);
                  }
                  if (e.key === "Escape") {
                    setPopoverQuery(null);
                  }
                }}
                onBlur={() => setTimeout(() => setPopoverQuery(null), 180)}
                placeholder={
                  inputMode === "search"
                    ? "Search tasks..."
                    : 'e.g. "Read book ?work !today at3pm for1h30 #quick +topic"'
                }
                className="flex-1 bg-transparent px-2 py-2 text-xs font-bold outline-none border-none placeholder-gray-400 tracking-tight"
              />

              {/* Right-end button: Open modal (quickadd) or Clear (search) */}
              {inputMode === "quickadd" ? (
                <button
                  type="button"
                  onClick={() => {
                    setEditingTask(null);
                    setIsTaskModalOpen(true);
                  }}
                  className="w-10 h-10 bg-blue-600 hover:bg-blue-700 active:scale-95 text-white rounded-[20px] flex items-center justify-center shrink-0 transition-all shadow-lg shadow-blue-500/30"
                >
                  <Plus className="w-5 h-5" />
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => setSearchQuery("")}
                  className={`w-10 h-10 rounded-[20px] flex items-center justify-center shrink-0 transition-all ${
                    darkMode
                      ? "text-gray-500 hover:text-white hover:bg-gray-800"
                      : "text-gray-400 hover:text-gray-700 hover:bg-gray-100"
                  }`}
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>

            {/* Clickable syntax hint pills — tap to insert */}
            {inputMode === "quickadd" && (
              <div className="flex items-center gap-1.5 mt-2 overflow-x-auto no-scrollbar">
                {[
                  { label: "?category", hint: "Set category", color: "bg-purple-500" },
                  { label: "!today", hint: "Due date", color: "bg-blue-500" },
                  { label: "at2pm", hint: "Start time", color: "bg-emerald-500" },
                  { label: "for30m", hint: "Duration", color: "bg-amber-500" },
                  { label: "#quick", hint: "Tag", color: "bg-orange-500" },
                  { label: "+topic", hint: "Topic label", color: "bg-teal-500" },
                  { label: "@daily", hint: "Recurring", color: "bg-green-500" },
                ].map((syntax) => (
                  <button
                    key={syntax.label}
                    type="button"
                    onClick={() => {
                      setQuickAddValue((prev) => {
                        const space = prev && !prev.endsWith(" ") ? " " : "";
                        return prev + space + syntax.label + " ";
                      });
                    }}
                    className={`text-[9px] px-2 py-1 rounded-full font-black uppercase tracking-wide whitespace-nowrap shrink-0 transition-all hover:scale-105 active:scale-95 text-white shadow-sm ${syntax.color}`}
                    title={syntax.hint}
                  >
                    {syntax.label}
                  </button>
                ))}
              </div>
            )}
          </form>
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
        allTopics={allTopics}
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
