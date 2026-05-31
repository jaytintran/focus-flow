import React, { useState, useMemo } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  History,
  Send,
  Clock,
  CheckCircle2,
  Calendar as CalendarIcon,
  Zap,
  Circle,
  Trash2,
  Package,
  Pencil,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  Wand2,
  Link,
} from "lucide-react";
import { JournalEntry, Task, JournalType, Category } from "../types";
import { TAGS } from "../constants";
import { formatScheduledTime, formatScheduledDate } from "../utils";
import { CategoryIcon } from "./CategoryIcon";
import * as db from "../db";

interface JournalViewProps {
  tasks: Task[];
  categories: Category[];
  journalEntries: JournalEntry[];
  onAddEntry: (entry: Partial<JournalEntry>) => void;
  onUpdateEntry: (id: string, content: string) => void;
  onDeleteEntry: (id: string) => void;
  onToggleCompleteTask: (id: string) => void;
  onDeleteTask: (id: string) => void;
  onEditTask: (task: Task) => void;
  darkMode: boolean;
}

// ─── Types ────────────────────────────────────────────────────────────────────

type CombinedItem = {
  id: string;
  content: string;
  type: JournalType;
  timestamp: number;
  endAt?: number;
  categoryId?: string;
  linkedTaskId?: string;
  linkedTaskName?: string;
  linkedTaskIds?: string[];
  linkedTaskNames?: string[];
  originalId: string;
  isCompletedTask: boolean;
  isScheduledActiveTask: boolean;
  task?: Task;
};

type TreeNode =
  | { kind: "block"; block: CombinedItem; children: TreeNode[] }
  | { kind: "entry"; item: CombinedItem };

// ─── Tree builder ─────────────────────────────────────────────────────────────
//
// Rules:
//   • TimeBlocks sorted longest→shortest (longer = outer on partial overlap).
//   • An entry belongs to the SHORTEST block that contains its timestamp
//     (shortest = innermost).
//   • A child block is placed inside the shortest parent block that contains
//     the child's midpoint AND is longer than the child.
//   • Everything not claimed by a block floats to top-level.
//   • All sibling lists are sorted timestamp-descending (newest first).

function buildTree(items: CombinedItem[]): TreeNode[] {
  // Normalise endAt for every block
  const rawBlocks = items
    .filter((i) => i.type === "TimeBlock")
    .map((b) => ({ ...b, endAt: b.endAt ?? b.timestamp + 3_600_000 }));

  const entries = items.filter((i) => i.type !== "TimeBlock");

  // Map of id → mutable node (children filled below)
  const nodeMap = new Map<
    string,
    { kind: "block"; block: CombinedItem; children: TreeNode[] }
  >();
  rawBlocks.forEach((b) =>
    nodeMap.set(b.id, { kind: "block", block: b, children: [] }),
  );

  // Sorted by duration asc (shortest first) — used when searching for innermost
  const blocksByDurAsc = [...rawBlocks].sort(
    (a, b) => a.endAt! - a.timestamp - (b.endAt! - b.timestamp),
  );

  /**
   * Among the given candidate block ids, find the innermost (shortest duration)
   * block that contains `ts` (block.start <= ts < block.end).
   */
  const findInnermostBlock = (
    ts: number,
    candidateIds: string[],
  ): string | null => {
    // Walk shortest-first, return first match
    for (const b of blocksByDurAsc) {
      if (!candidateIds.includes(b.id)) continue;
      const bEnd = b.endAt!;
      if (b.timestamp <= ts && ts < bEnd) return b.id;
    }
    return null;
  };

  const allBlockIds = rawBlocks.map((b) => b.id);

  // 1. Assign regular entries to the innermost containing block
  const entryParent = new Map<string, string | null>();
  entries.forEach((e) => {
    entryParent.set(e.id, findInnermostBlock(e.timestamp, allBlockIds));
  });

  // 2. Assign child blocks to the innermost parent block that:
  //    • contains the child's midpoint
  //    • has a longer duration than the child
  const blockParent = new Map<string, string | null>();
  // Process shortest-first so a block attaches to its direct parent, not grandparent
  blocksByDurAsc.forEach((child) => {
    const mid = child.timestamp + (child.endAt! - child.timestamp) / 2;
    const longerBlockIds = rawBlocks
      .filter(
        (b) =>
          b.id !== child.id &&
          b.endAt! - b.timestamp > child.endAt! - child.timestamp,
      )
      .map((b) => b.id);
    blockParent.set(child.id, findInnermostBlock(mid, longerBlockIds));
  });

  // 3. Populate node children
  entries.forEach((e) => {
    const pid = entryParent.get(e.id);
    if (pid) nodeMap.get(pid)!.children.push({ kind: "entry", item: e });
  });

  rawBlocks.forEach((b) => {
    const pid = blockParent.get(b.id);
    if (pid) nodeMap.get(pid)!.children.push(nodeMap.get(b.id)!);
  });

  // 4. Top-level = blocks with no parent + entries with no parent
  const childBlockIds = new Set(
    [...blockParent.values()].filter(Boolean) as string[],
  );

  const topLevel: TreeNode[] = [];
  rawBlocks.forEach((b) => {
    if (!childBlockIds.has(b.id)) topLevel.push(nodeMap.get(b.id)!);
  });
  entries.forEach((e) => {
    if (!entryParent.get(e.id)) topLevel.push({ kind: "entry", item: e });
  });

  // 5. Sort all sibling lists timestamp-descending
  const sortDesc = (nodes: TreeNode[]) => {
    nodes.sort((a, b) => {
      const tsA = a.kind === "block" ? a.block.timestamp : a.item.timestamp;
      const tsB = b.kind === "block" ? b.block.timestamp : b.item.timestamp;
      return tsB - tsA;
    });
    nodes.forEach((n) => {
      if (n.kind === "block") sortDesc(n.children);
    });
  };
  sortDesc(topLevel);

  return topLevel;
}

// Color palette cycling by nesting depth
const BLOCK_BAR_COLORS = [
  "#8B5CF6", // purple  (depth 0)
  "#06B6D4", // cyan    (depth 1)
  "#F59E0B", // amber   (depth 2)
  "#EC4899", // pink    (depth 3)
  "#10B981", // emerald (depth 4)
];

// ─── Component ────────────────────────────────────────────────────────────────

export default function JournalView({
  tasks,
  categories,
  journalEntries,
  onAddEntry,
  onUpdateEntry,
  onDeleteEntry,
  onToggleCompleteTask,
  onDeleteTask,
  onEditTask,
  darkMode,
}: JournalViewProps) {
  const [content, setContent] = useState("");
  const [type, setType] = useState<JournalType>("Event");
  const [editingEntryId, setEditingEntryId] = useState<string | null>(null);
  const [editingContent, setEditingContent] = useState("");
  const [timeBlockStart, setTimeBlockStart] = useState("09:00");
  const [timeBlockEnd, setTimeBlockEnd] = useState("10:00");
  const [editingTimeBlockStart, setEditingTimeBlockStart] = useState("");
  const [editingTimeBlockEnd, setEditingTimeBlockEnd] = useState("");
  const [selectedCategoryId, setSelectedCategoryId] = useState<
    string | undefined
  >(undefined);
  const [journalMode, setJournalMode] = useState<"timeline" | "day">(
    "timeline",
  );
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [calendarViewDate, setCalendarViewDate] = useState<Date>(new Date());
  const [isCalendarOpen, setIsCalendarOpen] = useState(false);
  const [showTooltip, setShowTooltip] = useState(false);
  const [viewMode, setViewMode] = useState<"normal" | "mini">("normal");

  React.useEffect(() => {
    if (type === "TimeBlock") {
      const now = new Date();
      const startHrs = String(now.getHours()).padStart(2, "0");
      const startMins = String(now.getMinutes()).padStart(2, "0");
      const oneHourLater = new Date(now.getTime() + 60 * 60 * 1000);
      const endHrs = String(oneHourLater.getHours()).padStart(2, "0");
      const endMins = String(oneHourLater.getMinutes()).padStart(2, "0");
      setTimeBlockStart(`${startHrs}:${startMins}`);
      setTimeBlockEnd(`${endHrs}:${endMins}`);
    }
  }, [type]);

  React.useEffect(() => {
    db.getSetting("journalViewMode").then((saved) => {
      if (saved === "normal" || saved === "mini") setViewMode(saved);
    });
  }, []);

  React.useEffect(() => {
    db.setSetting("journalViewMode", viewMode);
  }, [viewMode]);

  // ─── Helpers ────────────────────────────────────────────────────────────────

  const getLocalDateStr = (dateOrTime: Date | number) => {
    const d =
      typeof dateOrTime === "number" ? new Date(dateOrTime) : dateOrTime;
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  };

  // ─── Derived data ────────────────────────────────────────────────────────────

  const combinedItems = useMemo((): CombinedItem[] => {
    const completedTasks = tasks
      .filter((t) => t.completed && t.completedAt)
      .map((t) => ({
        id: `task-${t.id}`,
        content: t.name,
        type: "Task" as JournalType,
        timestamp: t.completedAt!,
        endAt: undefined as number | undefined,
        categoryId: t.categoryId,
        linkedTaskId: undefined as string | undefined,
        linkedTaskName: undefined as string | undefined,
        linkedTaskIds: undefined as string[] | undefined,
        linkedTaskNames: undefined as string[] | undefined,
        originalId: t.id,
        isCompletedTask: true,
        isScheduledActiveTask: false,
        task: t,
      }));

    const activeScheduledTasks = tasks
      .filter((t) => !t.completed && (t.startAt || t.dueDate))
      .map((t) => {
        let timestamp = t.createdAt;
        if (t.startAt) {
          timestamp = t.startAt;
        } else if (t.dueDate) {
          const [year, month, day] = t.dueDate.split("-").map(Number);
          timestamp = new Date(year, month - 1, day, 0, 0, 0, 0).getTime();
        }
        return {
          id: `scheduled-task-${t.id}`,
          content: t.name,
          type: "Task" as JournalType,
          timestamp,
          endAt: (t.endAt ||
            (t.startAt && t.duration ? t.startAt + t.duration : undefined)) as
            | number
            | undefined,
          categoryId: t.categoryId,
          linkedTaskId: undefined as string | undefined,
          linkedTaskName: undefined as string | undefined,
          linkedTaskIds: undefined as string[] | undefined,
          linkedTaskNames: undefined as string[] | undefined,
          originalId: t.id,
          isCompletedTask: false,
          isScheduledActiveTask: true,
          task: t,
        };
      });

    const entries = journalEntries.map((e) => ({
      id: e.id,
      content: e.content,
      type: e.type,
      timestamp: e.timestamp,
      endAt: e.endAt,
      categoryId: e.categoryId,
      linkedTaskId: e.linkedTaskId,
      linkedTaskName: e.linkedTaskName,
      linkedTaskIds: e.linkedTaskIds,
      linkedTaskNames: e.linkedTaskNames,
      originalId: e.id,
      isCompletedTask: false,
      isScheduledActiveTask: false,
      task: undefined as Task | undefined,
    }));

    return [...completedTasks, ...activeScheduledTasks, ...entries].sort(
      (a, b) => b.timestamp - a.timestamp,
    );
  }, [tasks, journalEntries]);

  const activeDays = useMemo(() => {
    const days = new Set<string>();
    combinedItems.forEach((item) => days.add(getLocalDateStr(item.timestamp)));
    return days;
  }, [combinedItems]);

  const filteredItems = useMemo(() => {
    if (journalMode === "day") {
      const targetStr = getLocalDateStr(selectedDate);
      return combinedItems.filter(
        (item) => getLocalDateStr(item.timestamp) === targetStr,
      );
    }
    return combinedItems;
  }, [combinedItems, journalMode, selectedDate]);

  // ─── Input parsing ───────────────────────────────────────────────────────────

  const parseTimeFromContent = (
    text: string,
    baseDate: Date = new Date(),
  ): { content: string; timestamp?: number } => {
    const timePattern = /@(\d{1,2})(?::(\d{2}))?\s*(am|pm)?/i;
    const match = text.match(timePattern);
    if (!match) return { content: text };
    let hours = parseInt(match[1]);
    const minutes = match[2] ? parseInt(match[2]) : 0;
    const meridiem = match[3]?.toLowerCase();
    if (meridiem) {
      if (meridiem === "pm" && hours !== 12) hours += 12;
      else if (meridiem === "am" && hours === 12) hours = 0;
    }
    const timestamp = new Date(
      baseDate.getFullYear(),
      baseDate.getMonth(),
      baseDate.getDate(),
      hours,
      minutes,
    ).getTime();
    return { content: text.replace(timePattern, "").trim(), timestamp };
  };

  const parseCategoryFromContent = (
    text: string,
  ): { content: string; categoryId?: string } => {
    const match = text.match(/#(\w+)/);
    if (!match) return { content: text };
    const tagName = match[1].toLowerCase();
    const matchedCat = categories.find((c) => c.name.toLowerCase() === tagName);
    return {
      content: text.replace(/#\w+/g, "").replace(/\s+/g, " ").trim(),
      ...(matchedCat && { categoryId: matchedCat.id }),
    };
  };

  const handleContentChange = (val: string) => {
    setContent(val);
    const match = val.match(/#(\w+)/);
    if (match) {
      const matchedCat = categories.find(
        (c) => c.name.toLowerCase() === match[1].toLowerCase(),
      );
      if (matchedCat) setSelectedCategoryId(matchedCat.id);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!content.trim()) return;

    const baseDate = journalMode === "day" ? selectedDate : new Date();
    let finalTimestamp: number | undefined;
    let endAt: number | undefined;
    let cleanContent = content;

    const rangePattern =
      /@(\d{1,2})(?::(\d{2}))?\s*(am|pm)?\s*->\s*@(\d{1,2})(?::(\d{2}))?\s*(am|pm)?/i;
    const rangeMatch = content.match(rangePattern);

    if (type === "TimeBlock" && rangeMatch) {
      let sH = parseInt(rangeMatch[1]);
      const sM = rangeMatch[2] ? parseInt(rangeMatch[2]) : 0;
      const sMer = rangeMatch[3]?.toLowerCase();
      if (sMer === "pm" && sH !== 12) sH += 12;
      if (sMer === "am" && sH === 12) sH = 0;
      finalTimestamp = new Date(
        baseDate.getFullYear(),
        baseDate.getMonth(),
        baseDate.getDate(),
        sH,
        sM,
      ).getTime();

      let eH = parseInt(rangeMatch[4]);
      const eM = rangeMatch[5] ? parseInt(rangeMatch[5]) : 0;
      const eMer = rangeMatch[6]?.toLowerCase();
      if (eMer === "pm" && eH !== 12) eH += 12;
      if (eMer === "am" && eH === 12) eH = 0;
      endAt = new Date(
        baseDate.getFullYear(),
        baseDate.getMonth(),
        baseDate.getDate(),
        eH,
        eM,
      ).getTime();
      if (endAt <= finalTimestamp!) endAt = finalTimestamp! + 3_600_000;
      cleanContent = content.replace(rangePattern, "").trim();
    } else {
      const { content: c, timestamp } = parseTimeFromContent(content, baseDate);
      cleanContent = c;
      finalTimestamp = timestamp;
    }

    const { content: finalCleanContent, categoryId: parsedCategoryId } =
      parseCategoryFromContent(cleanContent);
    const finalCategoryId = parsedCategoryId || selectedCategoryId;

    if (!finalTimestamp) {
      if (type === "TimeBlock" && timeBlockStart) {
        const [sH, sM] = timeBlockStart.split(":").map(Number);
        finalTimestamp = new Date(
          baseDate.getFullYear(),
          baseDate.getMonth(),
          baseDate.getDate(),
          sH,
          sM,
        ).getTime();
      } else if (journalMode === "day") {
        const now = new Date();
        finalTimestamp = new Date(
          selectedDate.getFullYear(),
          selectedDate.getMonth(),
          selectedDate.getDate(),
          now.getHours(),
          now.getMinutes(),
          now.getSeconds(),
        ).getTime();
      } else {
        finalTimestamp = Date.now();
      }
    }

    if (type === "TimeBlock" && !endAt) {
      if (timeBlockEnd) {
        const [eH, eM] = timeBlockEnd.split(":").map(Number);
        endAt = new Date(
          baseDate.getFullYear(),
          baseDate.getMonth(),
          baseDate.getDate(),
          eH,
          eM,
        ).getTime();
      } else {
        endAt = finalTimestamp! + 3_600_000;
      }
      if (endAt <= finalTimestamp!) endAt = finalTimestamp! + 3_600_000;
    }

    onAddEntry({
      content: finalCleanContent,
      type,
      timestamp: finalTimestamp,
      ...(endAt !== undefined && { endAt }),
      ...(finalCategoryId && { categoryId: finalCategoryId }),
    });
    setContent("");
    setSelectedCategoryId(undefined);
  };

  // ─── Edit handlers ───────────────────────────────────────────────────────────

  const handleStartEdit = (entry: CombinedItem) => {
    if (entry.isCompletedTask) return;
    setEditingEntryId(entry.id);
    setEditingContent(entry.content);
    if (entry.type === "TimeBlock") {
      const s = new Date(entry.timestamp);
      const e = entry.endAt
        ? new Date(entry.endAt)
        : new Date(entry.timestamp + 3_600_000);
      setEditingTimeBlockStart(
        `${String(s.getHours()).padStart(2, "0")}:${String(s.getMinutes()).padStart(2, "0")}`,
      );
      setEditingTimeBlockEnd(
        `${String(e.getHours()).padStart(2, "0")}:${String(e.getMinutes()).padStart(2, "0")}`,
      );
    }
  };

  const handleCancelEdit = () => {
    setEditingEntryId(null);
    setEditingContent("");
    setEditingTimeBlockStart("");
    setEditingTimeBlockEnd("");
  };

  const handleSaveEdit = (id: string, entryType: JournalType) => {
    if (!editingContent.trim()) return;
    let updates: Partial<JournalEntry> = {};
    if (
      entryType === "TimeBlock" &&
      editingTimeBlockStart &&
      editingTimeBlockEnd
    ) {
      const entry = journalEntries.find((e) => e.id === id);
      if (entry) {
        const base = new Date(entry.timestamp);
        const [sH, sM] = editingTimeBlockStart.split(":").map(Number);
        const [eH, eM] = editingTimeBlockEnd.split(":").map(Number);
        const newStart = new Date(
          base.getFullYear(),
          base.getMonth(),
          base.getDate(),
          sH,
          sM,
        ).getTime();
        let newEnd = new Date(
          base.getFullYear(),
          base.getMonth(),
          base.getDate(),
          eH,
          eM,
        ).getTime();
        if (newEnd <= newStart) newEnd = newStart + 3_600_000;
        updates.timestamp = newStart;
        updates.endAt = newEnd;
      }
    }
    onUpdateEntry(id, editingContent.trim(), updates);
    setEditingEntryId(null);
    setEditingContent("");
    setEditingTimeBlockStart("");
    setEditingTimeBlockEnd("");
  };

  // ─── Calendar ────────────────────────────────────────────────────────────────

  const handleDateSelect = (date: Date) => {
    setSelectedDate(date);
    if (journalMode === "timeline") {
      const el = document.getElementById(
        `date-section-${getLocalDateStr(date)}`,
      );
      if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  };

  const currentMonth = calendarViewDate.getMonth();
  const currentYear = calendarViewDate.getFullYear();

  const calendarDays = useMemo(() => {
    const firstDay = new Date(currentYear, currentMonth, 1);
    const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();
    const days: (Date | null)[] = [];
    for (let i = 0; i < firstDay.getDay(); i++) days.push(null);
    for (let d = 1; d <= daysInMonth; d++)
      days.push(new Date(currentYear, currentMonth, d));
    return days;
  }, [currentMonth, currentYear]);

  const monthName = calendarViewDate.toLocaleDateString(undefined, {
    month: "long",
    year: "numeric",
  });
  const weekdays = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];

  // ─── UI helpers ──────────────────────────────────────────────────────────────

  const journalTypeOptions: {
    label: string;
    value: JournalType;
    className: string;
  }[] = [
    {
      label: "Task",
      value: "Task",
      className: "bg-green-500 text-white shadow-lg",
    },
    {
      label: "Event",
      value: "Event",
      className: "bg-orange-500 text-white shadow-lg",
    },
    {
      label: "Log",
      value: "SessionLog",
      className: "bg-blue-500 text-white shadow-lg",
    },
    {
      label: "Achievement",
      value: "Achievement",
      className: "bg-amber-500 text-white shadow-lg",
    },
    {
      label: "Block",
      value: "TimeBlock",
      className: "bg-purple-500 text-white shadow-lg",
    },
  ];

  const getTypeChipClass = (t: JournalType) => {
    if (t === "Task") return "bg-green-500/10 text-green-500";
    if (t === "SessionLog") return "bg-blue-500/10 text-blue-500";
    if (t === "Achievement") return "bg-amber-500/10 text-amber-500";
    if (t === "TimeBlock") return "bg-purple-500/10 text-purple-500";
    return "bg-orange-500/10 text-orange-500";
  };

  const getTypeLabel = (t: JournalType) =>
    t === "SessionLog" ? "Log" : t === "TimeBlock" ? "Block" : t;

  const getLinkedTaskNames = (item: CombinedItem) =>
    item.linkedTaskNames?.length
      ? item.linkedTaskNames
      : item.linkedTaskName
        ? [item.linkedTaskName]
        : [];

  // ─── Entry card ───────────────────────────────────────────────────────────────

  const renderEntryCard = (item: CombinedItem) => {
    const category = item.categoryId
      ? categories.find((c) => c.id === item.categoryId)
      : undefined;
    const dotColor = category
      ? category.color
      : item.type === "Task"
        ? "#10B981"
        : "#F97316";
    const linkedTaskNames = getLinkedTaskNames(item);
    const taskTagInfo = item.task?.tag
      ? TAGS.find((t) => t.label === item.task?.tag)
      : undefined;
    const miniTimeLabel =
      item.task?.startAt && item.task?.endAt
        ? `${new Date(item.task.startAt).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })} -> ${new Date(item.task.endAt).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}`
        : item.isScheduledActiveTask
          ? formatScheduledTime(
              item.task?.startAt || item.timestamp,
              item.task?.endAt,
              item.task?.duration,
            )
          : new Date(item.timestamp).toLocaleTimeString([], {
              hour: "2-digit",
              minute: "2-digit",
            });

    return (
      <div key={item.id} className="relative group">
        {/* Timeline dot */}
        <div
          className="absolute -left-[1.5rem] top-1/2 -translate-y-1/2 w-4 h-4 rounded-full border-4 border-white dark:border-gray-950 z-10 transition-all duration-300 group-hover:scale-125"
          style={{
            backgroundColor: dotColor,
            boxShadow: `0 0 8px ${dotColor}40`,
          }}
        />

        {/* Mini-mode metadata row */}
        {viewMode === "mini" && (
          <div className="mb-1 flex flex-col items-end gap-0.5 pr-2">
            <div className="flex max-w-full flex-row-reverse items-center gap-1 overflow-hidden whitespace-nowrap">
              <div
                className={`flex shrink-0 items-center gap-1 rounded-md border px-1.5 py-0.5 text-[8px] ${item.isScheduledActiveTask ? "border-blue-500 bg-blue-600 text-white font-mono" : "border-gray-500 bg-gray-600 text-white font-mono"}`}
              >
                <Clock className="h-2 w-2" />
                {miniTimeLabel}
              </div>
              {item.task?.dueDate && (
                <div className="flex shrink-0 items-center gap-1 rounded-md border border-gray-500 bg-gray-600 px-1.5 py-0.5 text-[8px] text-white">
                  <CalendarIcon className="h-2 w-2" />
                  {formatScheduledDate(item.task.dueDate)}
                </div>
              )}
              <span
                className={`shrink-0 rounded-md px-1.5 py-0.5 text-[8px] font-black uppercase tracking-wider ${getTypeChipClass(item.type)}`}
              >
                {getTypeLabel(item.type)}
              </span>
              {category && (
                <div
                  className="flex shrink-0 items-center gap-1 rounded-md border px-1.5 py-0.5 text-[8px] uppercase text-white"
                  style={{
                    backgroundColor: category.color,
                    borderColor: category.color,
                  }}
                >
                  <CategoryIcon name={category.iconName} className="h-2 w-2" />
                  {category.name}
                </div>
              )}
              {taskTagInfo && (
                <span
                  className="shrink-0 rounded-md border px-1.5 py-0.5 text-[8px] font-black uppercase tracking-wider text-white"
                  style={{
                    backgroundColor: taskTagInfo.color,
                    borderColor: taskTagInfo.color,
                  }}
                >
                  {item.task?.tag}
                </span>
              )}
              ↓
            </div>
          </div>
        )}

        {/* Card */}
        <div
          className={`${viewMode === "mini" ? "p-2 rounded-xl" : "p-4 rounded-2xl"} border transition-all duration-300 hover:translate-x-1 ${darkMode ? "bg-gray-900 border-gray-800" : "bg-white border-gray-50 shadow-sm"}`}
        >
          {item.isScheduledActiveTask ? (
            viewMode === "mini" ? (
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 min-w-0 flex-1">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onToggleCompleteTask(item.originalId);
                    }}
                    className="shrink-0 text-gray-400 hover:text-green-500 transition-colors"
                  >
                    <Circle className="w-3.5 h-3.5" />
                  </button>
                  {category && (
                    <div
                      className="flex items-center justify-center p-0.5 rounded shrink-0"
                      style={{
                        color: category.color,
                        backgroundColor: `${category.color}15`,
                      }}
                    >
                      <CategoryIcon
                        name={category.iconName}
                        className="w-3 h-3"
                      />
                    </div>
                  )}
                  <p
                    className={`text-xs font-bold truncate ${darkMode ? "text-gray-300" : "text-gray-700"}`}
                  >
                    {item.content}
                  </p>
                </div>
                <div className="flex items-center gap-0.5 shrink-0">
                  <button
                    onClick={() => onEditTask(item.task!)}
                    className="p-1 text-gray-400 hover:text-blue-500 transition-colors"
                  >
                    <Pencil className="w-3 h-3" />
                  </button>
                  <button
                    onClick={() => onDeleteTask(item.originalId)}
                    className="p-1 text-gray-400 hover:text-red-500 transition-colors"
                  >
                    <Trash2 className="w-3 h-3" />
                  </button>
                </div>
              </div>
            ) : (
              <div className="flex flex-col gap-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-3 min-w-0 flex-1">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onToggleCompleteTask(item.originalId);
                      }}
                      className="shrink-0 text-gray-400 hover:text-green-500 transition-colors mt-0.5"
                    >
                      <Circle className="w-5 h-5" />
                    </button>
                    <div className="min-w-0 flex-1">
                      <h4 className="text-sm font-bold text-gray-900 dark:text-white truncate">
                        {item.content}
                      </h4>
                      {category && (
                        <div className="mt-1 flex items-center gap-1.5 opacity-60">
                          <div
                            className="flex items-center justify-center p-0.5 rounded bg-gray-100 dark:bg-gray-800"
                            style={{ color: category.color }}
                          >
                            <CategoryIcon
                              name={category.iconName}
                              className="w-3 h-3"
                            />
                          </div>
                          <span className="text-[9px] font-bold text-gray-500 uppercase tracking-widest">
                            {category.name}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      onClick={() => onEditTask(item.task!)}
                      className="p-1.5 text-gray-400 hover:text-blue-500 transition-colors"
                    >
                      <Pencil className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => onDeleteTask(item.originalId)}
                      className="p-1.5 text-gray-400 hover:text-red-500 transition-colors"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
                <div className="flex items-center gap-1.5 text-xs font-semibold text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/30 px-2.5 py-1 rounded-xl w-fit border border-blue-100 dark:border-blue-900/35 shadow-sm">
                  <Clock className="w-3.5 h-3.5 animate-pulse" />
                  <span>
                    {item.task?.dueDate
                      ? formatScheduledDate(item.task.dueDate)
                      : "Scheduled"}
                    :{" "}
                    {item.task?.startAt && item.task?.endAt
                      ? `${new Date(item.task.startAt).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })} → ${new Date(item.task.endAt).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}`
                      : formatScheduledTime(
                          item.task?.startAt || item.timestamp,
                          item.task?.endAt,
                          item.task?.duration,
                        )}
                  </span>
                </div>
              </div>
            )
          ) : editingEntryId === item.id ? (
            <div className="space-y-3">
              <textarea
                value={editingContent}
                onChange={(e) => setEditingContent(e.target.value)}
                className={`w-full px-3 py-2 rounded-xl border text-sm resize-none ${darkMode ? "bg-gray-800 border-gray-700 text-gray-200" : "bg-gray-50 border-gray-200 text-gray-900"} focus:outline-none focus:ring-2 focus:ring-blue-500`}
                rows={3}
                autoFocus
              />
              <div className="flex items-center justify-end gap-2">
                <button
                  onClick={handleCancelEdit}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${darkMode ? "bg-gray-800 hover:bg-gray-700 text-gray-400" : "bg-gray-100 hover:bg-gray-200 text-gray-600"}`}
                >
                  Cancel
                </button>
                <button
                  onClick={() => handleSaveEdit(item.id, item.type)}
                  disabled={!editingContent.trim()}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${editingContent.trim() ? "bg-blue-600 hover:bg-blue-700 text-white" : "bg-gray-200 text-gray-400 cursor-not-allowed"}`}
                >
                  Save
                </button>
              </div>
            </div>
          ) : viewMode === "mini" ? (
            <>
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 min-w-0 flex-1">
                  {category ? (
                    <div
                      className="flex items-center justify-center p-0.5 rounded shrink-0"
                      style={{
                        color: category.color,
                        backgroundColor: `${category.color}15`,
                      }}
                    >
                      <CategoryIcon
                        name={category.iconName}
                        className="w-3 h-3"
                      />
                    </div>
                  ) : item.type === "Task" ? (
                    <CheckCircle2 className="w-3.5 h-3.5 text-green-500 shrink-0" />
                  ) : (
                    <Package className="w-3.5 h-3.5 text-orange-500 shrink-0" />
                  )}
                  <p
                    className={`text-xs font-bold truncate ${darkMode ? "text-gray-300" : "text-gray-700"}`}
                  >
                    {item.content}
                  </p>
                </div>
                {!item.isCompletedTask && (
                  <div className="flex items-center gap-0.5 shrink-0">
                    <button
                      onClick={() => handleStartEdit(item)}
                      className="p-1 text-gray-400 hover:text-blue-500 transition-colors"
                    >
                      <Pencil className="w-3 h-3" />
                    </button>
                    <button
                      onClick={() => onDeleteEntry(item.id)}
                      className="p-1 text-gray-400 hover:text-red-500 transition-colors"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </div>
                )}
              </div>
              {linkedTaskNames.length > 0 && (
                <div className="mt-1.5 flex items-center gap-1.5 text-[9px] font-black uppercase tracking-wider text-blue-500">
                  <Link className="w-3 h-3" />
                  <span className="truncate">
                    While On: {linkedTaskNames[0]}
                    {linkedTaskNames.length > 1
                      ? ` +${linkedTaskNames.length - 1}`
                      : ""}
                  </span>
                </div>
              )}
            </>
          ) : (
            <>
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  {category ? (
                    <div
                      className="flex items-center justify-center p-1 rounded-lg"
                      style={{
                        color: category.color,
                        backgroundColor: `${category.color}15`,
                      }}
                    >
                      <CategoryIcon
                        name={category.iconName}
                        className="w-3.5 h-3.5"
                      />
                    </div>
                  ) : item.type === "Task" ? (
                    <CheckCircle2 className="w-4 h-4 text-green-500" />
                  ) : (
                    <Package className="w-4 h-4 text-orange-500" />
                  )}
                  <span
                    className={`text-[9px] font-black uppercase tracking-tighter px-1.5 py-0.5 rounded ${getTypeChipClass(item.type)}`}
                  >
                    {getTypeLabel(item.type)}
                  </span>
                  <span className="text-[10px] font-mono text-gray-400">
                    {item.task?.startAt && item.task?.endAt
                      ? `${new Date(item.task.startAt).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })} → ${new Date(item.task.endAt).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}`
                      : new Date(item.timestamp).toLocaleTimeString([], {
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                  </span>
                </div>
                {!item.isCompletedTask && (
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => handleStartEdit(item)}
                      className="p-1.5 text-gray-400 hover:text-blue-500 transition-colors"
                    >
                      <Pencil className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => onDeleteEntry(item.id)}
                      className="p-1.5 text-gray-400 hover:text-red-500 transition-colors"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                )}
              </div>
              <p
                className={`text-sm font-medium ${darkMode ? "text-gray-300" : "text-gray-700"}`}
              >
                {item.content}
              </p>
              {linkedTaskNames.length > 0 && (
                <div
                  className={`mt-2 flex max-w-full flex-wrap items-center gap-1.5 text-[10px] font-black uppercase tracking-wider ${darkMode ? "text-blue-300" : "text-blue-600"}`}
                >
                  <span
                    className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-lg ${darkMode ? "bg-blue-500/10" : "bg-blue-50"}`}
                  >
                    <Link className="w-3 h-3 shrink-0" />
                    While On
                  </span>
                  {linkedTaskNames.map((name) => (
                    <span
                      key={name}
                      className={`max-w-[180px] truncate px-2 py-1 rounded-lg ${darkMode ? "bg-gray-800 text-blue-200" : "bg-blue-50 text-blue-600"}`}
                    >
                      {name}
                    </span>
                  ))}
                </div>
              )}
              {item.categoryId &&
                categories.find((c) => c.id === item.categoryId) && (
                  <div className="mt-3 flex items-center gap-1.5 opacity-60">
                    <div
                      className="w-1.5 h-1.5 rounded-full"
                      style={{
                        backgroundColor: categories.find(
                          (c) => c.id === item.categoryId,
                        )?.color,
                      }}
                    />
                    <span className="text-[9px] font-bold text-gray-500 uppercase tracking-widest">
                      {categories.find((c) => c.id === item.categoryId)?.name}
                    </span>
                  </div>
                )}
            </>
          )}
        </div>
      </div>
    );
  };

  // ─── TimeBlock bracket ────────────────────────────────────────────────────────
  //
  // Layout:
  //   [thin vertical bar + rotated label] | [children area]
  //
  // The bar is a flex column that grows to match the children area height.
  // Edit is triggered by clicking the bar; delete button appears on bar hover.

  const renderBlockBracket = (
    node: Extract<TreeNode, { kind: "block" }>,
    depth: number,
  ): React.ReactNode => {
    const block = node.block;
    const barColor = BLOCK_BAR_COLORS[depth % BLOCK_BAR_COLORS.length];
    const blockEnd = block.endAt ?? block.timestamp + 3_600_000;
    const startLabel = new Date(block.timestamp).toLocaleTimeString([], {
      hour: "numeric",
      minute: "2-digit",
    });
    const endLabel = new Date(blockEnd).toLocaleTimeString([], {
      hour: "numeric",
      minute: "2-digit",
    });
    const durationMins = Math.round((blockEnd - block.timestamp) / 60_000);
    const durationLabel =
      durationMins >= 60
        ? `${Math.floor(durationMins / 60)}h${durationMins % 60 > 0 ? ` ${durationMins % 60}m` : ""}`
        : `${durationMins}m`;
    const isEditing = editingEntryId === block.id;

    return (
      <div
        key={block.id}
        className="flex gap-0 items-stretch -ml-[calc(2rem+2px)]"
      >
        {/* ── Vertical bar column ── */}
        <div
          className="relative flex-shrink-0 flex flex-col items-center cursor-pointer group/bar select-none"
          style={{ width: "40px" }}
          onClick={() => !isEditing && handleStartEdit(block)}
          title={`${block.content} · ${startLabel} → ${endLabel}`}
        >
          {/* Bar line — grows full height of sibling children area */}
          <div
            className="flex-1 rounded-full transition-all duration-200 group-hover/bar:opacity-80"
            style={{
              width: "3px",
              minHeight: "48px",
              backgroundColor: barColor,
              boxShadow: `0 0 6px ${barColor}60`,
            }}
          />

          {/* Rotated label centred over the bar */}
          <div className="absolute inset-y-0 left-0 right-[7px] mr-1 flex items-center justify-center pointer-events-none overflow-hidden">
            <div
              style={{
                writingMode: "vertical-rl",
                transform: "rotate(180deg)",
                color: barColor,
                fontSize: "8px",
                fontWeight: 900,
                letterSpacing: "0.1em",
                textTransform: "uppercase",
                whiteSpace: "nowrap",
                maxHeight: "100%",
                overflow: "hidden",
                textOverflow: "ellipsis",
                lineHeight: 1,
                padding: "6px 0",
                opacity: 0.9,
              }}
            >
              {block.content} · {durationLabel}
            </div>
          </div>
        </div>

        {/* ── Children area ── */}
        <div
          className="flex-1 min-w-0 rounded-2xl py-2 px-3"
          style={{
            borderLeft: `2px solid ${barColor}50`,
            background: darkMode ? `${barColor}0A` : `${barColor}07`,
          }}
        >
          {/* Block header: time range + duration + edit inline if active */}
          {isEditing ? (
            <div className="mb-3 space-y-2">
              <input
                value={editingContent}
                onChange={(e) => setEditingContent(e.target.value)}
                className={`w-full px-3 py-1.5 rounded-xl border text-xs font-bold ${darkMode ? "bg-gray-800 border-gray-700 text-gray-200" : "bg-white border-gray-200 text-gray-900"} focus:outline-none focus:ring-2 focus:ring-purple-500`}
                autoFocus
              />
              <div className="flex items-center gap-3 text-[9px] text-gray-500">
                <div className="flex items-center gap-1">
                  <span className="uppercase font-black tracking-wider">
                    Start
                  </span>
                  <input
                    type="time"
                    value={editingTimeBlockStart}
                    onChange={(e) => setEditingTimeBlockStart(e.target.value)}
                    className={`px-2 py-1 rounded-lg border focus:outline-none focus:ring-1 focus:ring-purple-500 ${darkMode ? "bg-gray-800 border-gray-700 text-gray-300" : "bg-white border-gray-200 text-gray-800"}`}
                  />
                </div>
                <div className="flex items-center gap-1">
                  <span className="uppercase font-black tracking-wider">
                    End
                  </span>
                  <input
                    type="time"
                    value={editingTimeBlockEnd}
                    onChange={(e) => setEditingTimeBlockEnd(e.target.value)}
                    className={`px-2 py-1 rounded-lg border focus:outline-none focus:ring-1 focus:ring-purple-500 ${darkMode ? "bg-gray-800 border-gray-700 text-gray-300" : "bg-white border-gray-200 text-gray-800"}`}
                  />
                </div>
                <div className="flex items-center gap-1.5 ml-auto">
                  <button
                    onClick={handleCancelEdit}
                    className={`px-2.5 py-1 rounded-lg text-[9px] font-black uppercase ${darkMode ? "bg-gray-800 hover:bg-gray-700 text-gray-400" : "bg-gray-100 hover:bg-gray-200 text-gray-600"}`}
                  >
                    Cancel
                  </button>
                  <button
                    onClick={() => handleSaveEdit(block.id, "TimeBlock")}
                    disabled={!editingContent.trim()}
                    className={`px-2.5 py-1 rounded-lg text-[9px] font-black uppercase ${editingContent.trim() ? "bg-purple-600 hover:bg-purple-700 text-white" : "bg-gray-200 text-gray-400 cursor-not-allowed"}`}
                  >
                    Save
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-2 mb-2">
              <span
                className="text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded-md"
                style={{ backgroundColor: `${barColor}20`, color: barColor }}
              >
                {startLabel} → {endLabel}
              </span>
              <span
                className={`text-[9px] font-bold ${darkMode ? "text-gray-500" : "text-gray-400"}`}
              >
                {durationLabel}
              </span>
              <div className="flex items-center gap-0.5 ml-auto">
                <button
                  onClick={() => handleStartEdit(block)}
                  className="p-1 text-gray-400 hover:text-blue-500 transition-colors"
                  title="Edit block"
                >
                  <Pencil className="w-3 h-3" />
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onDeleteEntry(block.id);
                  }}
                  className="p-1 text-gray-400 hover:text-red-500 transition-colors"
                  title="Delete block"
                >
                  <Trash2 className="w-3 h-3" />
                </button>
              </div>
            </div>
          )}

          {/* Children */}
          {node.children.length > 0 ? (
            <div className="space-y-3 ml-1">
              {renderTree(node.children, depth + 1)}
            </div>
          ) : (
            <p
              className={`text-[9px] italic px-2 py-1.5 ${darkMode ? "text-gray-600" : "text-gray-400"}`}
            >
              No entries in this block
            </p>
          )}
        </div>
      </div>
    );
  };

  // ─── Tree renderer (recursive) ───────────────────────────────────────────────

  const renderTree = (nodes: TreeNode[], depth = 0): React.ReactNode =>
    nodes.map((node) =>
      node.kind === "entry"
        ? renderEntryCard(node.item)
        : renderBlockBracket(node, depth),
    );

  // ─── Date-grouped list ───────────────────────────────────────────────────────

  const groupItemsByDate = (items: CombinedItem[]) => {
    const groups: { [date: string]: CombinedItem[] } = {};
    items.forEach((item) => {
      const label = new Date(item.timestamp).toLocaleDateString(undefined, {
        weekday: "long",
        month: "short",
        day: "numeric",
      });
      if (!groups[label]) groups[label] = [];
      groups[label].push(item);
    });
    return groups;
  };

  const renderItemList = (items: CombinedItem[]) =>
    Object.entries(groupItemsByDate(items)).map(([date, dateItems]) => {
      const dateStr =
        dateItems.length > 0 ? getLocalDateStr(dateItems[0].timestamp) : "";
      const tree = buildTree(dateItems);
      return (
        <div
          key={date}
          id={dateStr ? `date-section-${dateStr}` : undefined}
          className="space-y-4"
        >
          <h3
            className={`text-[10px] font-black uppercase tracking-[0.2em] px-4 py-1.5 rounded-lg inline-block ${darkMode ? "bg-gray-900 text-gray-500" : "bg-gray-50 text-gray-400"}`}
          >
            {date}
          </h3>
          <div className="space-y-3 pl-4 border-l-2 border-gray-100 dark:border-gray-800 ml-4">
            {renderTree(tree)}
          </div>
        </div>
      );
    });

  // ─── Render ──────────────────────────────────────────────────────────────────

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 8 }}
      transition={{ duration: 0.18, ease: "easeOut" }}
      className={`flex-1 min-h-0 flex flex-col overflow-hidden ${darkMode ? "bg-gray-950 text-white" : "bg-white text-gray-900"}`}
    >
      {/* ── View Controls ── */}
      <div
        className={`flex flex-wrap items-center gap-1.5 ${darkMode ? "border-gray-800/80 bg-gray-950/40" : "border-gray-100 bg-gray-50/50"}`}
      >
        <div
          className={`p-0.5 rounded-xl flex gap-0.5 border ${darkMode ? "bg-gray-900 border-gray-800" : "bg-white border-gray-100"}`}
        >
          <button
            type="button"
            onClick={() => setJournalMode("day")}
            className={`px-2.5 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all cursor-pointer ${journalMode === "day" ? (darkMode ? "bg-gray-800 text-white shadow-sm" : "bg-white text-gray-900 shadow-sm") : "text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"}`}
          >
            Day
          </button>
          <button
            type="button"
            onClick={() => setJournalMode("timeline")}
            className={`px-2.5 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all cursor-pointer ${journalMode === "timeline" ? (darkMode ? "bg-gray-800 text-white shadow-sm" : "bg-white text-gray-900 shadow-sm") : "text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"}`}
          >
            Timeline
          </button>
        </div>

        <div className="flex items-center gap-2 ml-auto">
          <button
            type="button"
            onClick={() => {
              setIsCalendarOpen(!isCalendarOpen);
              setCalendarViewDate(selectedDate);
            }}
            className={`px-2.5 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all flex items-center gap-1.5 border shadow-sm cursor-pointer ${isCalendarOpen ? "bg-blue-600 border-blue-600 text-white" : darkMode ? "bg-gray-900 border-gray-800 text-gray-300 hover:bg-gray-800" : "bg-white border-gray-150 text-gray-600 hover:bg-gray-50"}`}
          >
            <CalendarIcon className="w-3.5 h-3.5" />
            <span>
              {selectedDate.toLocaleDateString(undefined, {
                weekday: "short",
                month: "short",
                day: "numeric",
                year: "numeric",
              })}
            </span>
            <ChevronDown
              className={`w-3.5 h-3.5 transition-transform duration-250 ${isCalendarOpen ? "rotate-180" : ""}`}
            />
          </button>
        </div>

        <div
          className={`p-0.5 rounded-xl flex gap-0.5 border ${darkMode ? "bg-gray-900 border-gray-800" : "bg-white border-gray-100"}`}
        >
          <button
            type="button"
            onClick={() => setViewMode("normal")}
            className={`px-2.5 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all cursor-pointer ${viewMode === "normal" ? (darkMode ? "bg-gray-800 text-white shadow-sm" : "bg-white text-gray-900 shadow-sm") : "text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"}`}
          >
            Normal
          </button>
          <button
            type="button"
            onClick={() => setViewMode("mini")}
            className={`px-2.5 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all cursor-pointer ${viewMode === "mini" ? (darkMode ? "bg-gray-800 text-white shadow-sm" : "bg-white text-gray-900 shadow-sm") : "text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"}`}
          >
            Mini
          </button>
        </div>

        <div
          className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-[10px] font-black uppercase text-blue-500 ${darkMode ? "bg-blue-500/10" : "bg-blue-50"}`}
        >
          <Zap className="w-3 h-3" />
          {combinedItems.length}
        </div>
      </div>

      {/* ── Calendar Drawer ── */}
      <AnimatePresence>
        {isCalendarOpen && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25, ease: "easeInOut" }}
            className={`border-b overflow-hidden ${darkMode ? "bg-gray-900/60 border-gray-800" : "bg-gray-50/70 border-gray-150"}`}
          >
            <div className="p-3">
              <div className="flex items-center justify-between mb-4">
                <span className="text-sm font-black uppercase tracking-wider">
                  {monthName}
                </span>
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() =>
                      setCalendarViewDate(
                        new Date(currentYear, currentMonth - 1, 1),
                      )
                    }
                    className="p-1.5 rounded-xl hover:bg-gray-200 dark:hover:bg-gray-850 transition-colors cursor-pointer"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      setCalendarViewDate(
                        new Date(currentYear, currentMonth + 1, 1),
                      )
                    }
                    className="p-1.5 rounded-xl hover:bg-gray-200 dark:hover:bg-gray-850 transition-colors cursor-pointer"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
              <div className="grid grid-cols-7 gap-1 text-center mb-2 border-b border-gray-100 dark:border-gray-800/40 pb-1">
                {weekdays.map((d) => (
                  <span
                    key={d}
                    className="text-[10px] font-black text-gray-400 dark:text-gray-500 uppercase py-1"
                  >
                    {d}
                  </span>
                ))}
              </div>
              <div className="grid grid-cols-7 gap-1.5 text-center">
                {calendarDays.map((day, idx) => {
                  if (!day) return <div key={`empty-${idx}`} />;
                  const dateStr = getLocalDateStr(day);
                  const hasEntries = activeDays.has(dateStr);
                  const isSelected = getLocalDateStr(selectedDate) === dateStr;
                  const isToday = getLocalDateStr(new Date()) === dateStr;
                  return (
                    <button
                      key={dateStr}
                      type="button"
                      onClick={() => handleDateSelect(day)}
                      className={`aspect-square rounded-full flex flex-col items-center justify-center text-xs font-bold transition-all relative cursor-pointer ${isSelected ? "text-white scale-105" : isToday ? "ring-2 ring-blue-500/50" : darkMode ? "text-gray-300 hover:bg-gray-800" : "text-gray-700 hover:bg-gray-200"}`}
                      style={
                        isSelected
                          ? {
                              backgroundColor: "#2563EB",
                              boxShadow: "0 4px 12px rgba(37,99,235,0.35)",
                            }
                          : {}
                      }
                      title={dateStr}
                    >
                      <span>{day.getDate()}</span>
                      {hasEntries && (
                        <span
                          className={`absolute bottom-1 w-1.5 h-1.5 rounded-full ${isSelected ? "bg-white" : "bg-blue-500"}`}
                        />
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Content ── */}
      {journalMode === "day" ? (
        <div className="flex-1 min-h-0 overflow-y-auto py-3 no-scrollbar scroll-smooth">
          <div className="space-y-8">
            {renderItemList(filteredItems)}
            {filteredItems.length === 0 && (
              <div className="text-center py-20 opacity-30">
                <History className="w-12 h-12 mx-auto mb-4" />
                <p className="text-sm font-bold uppercase tracking-widest">
                  No entries for this day
                </p>
              </div>
            )}
          </div>
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto py-3 no-scrollbar scroll-smooth">
          <div className="space-y-8">
            {renderItemList(filteredItems)}
            {filteredItems.length === 0 && (
              <div className="text-center py-20 opacity-30">
                <History className="w-12 h-12 mx-auto mb-4" />
                <p className="text-sm font-bold uppercase tracking-widest">
                  No history yet
                </p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Input Bar ── */}
      <div className="pb-4">
        <div className="w-full mx-auto">
          <form onSubmit={handleSubmit} className="relative">
            <div
              className={`p-2 border rounded-[32px] transition-all flex flex-col gap-2 ${darkMode ? "bg-gray-900 border-gray-800" : "bg-gray-50 border-gray-100"}`}
            >
              {/* Type selector */}
              <div className="flex items-center justify-between gap-2 px-2 pt-1 border-b border-gray-100 dark:border-gray-800/60 pb-2">
                <div className="flex flex-wrap items-center gap-1.5">
                  {journalTypeOptions.map((opt) => (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => setType(opt.value)}
                      className={`px-3 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${type === opt.value ? opt.className : "text-gray-500 hover:text-gray-300"}`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Category selector */}
              <div className="flex flex-wrap gap-1.5 px-2 pb-1.5 pt-0.5 border-b border-dashed border-gray-100 dark:border-gray-800/40">
                {categories.map((cat) => {
                  const isSel = selectedCategoryId === cat.id;
                  return (
                    <button
                      key={cat.id}
                      type="button"
                      onClick={() =>
                        setSelectedCategoryId(isSel ? undefined : cat.id)
                      }
                      className={`px-2.5 py-1 rounded-xl text-[9px] font-black uppercase tracking-wider transition-all flex items-center gap-1.5 border ${isSel ? "text-white shadow-sm" : darkMode ? "bg-gray-800/40 border-gray-800 text-gray-400 hover:bg-gray-800" : "bg-gray-100 border-gray-200 text-gray-500 hover:bg-gray-200"}`}
                      style={
                        isSel
                          ? {
                              backgroundColor: cat.color,
                              borderColor: cat.color,
                              boxShadow: `0 2px 6px ${cat.color}30`,
                            }
                          : {}
                      }
                    >
                      <span
                        className="w-1.5 h-1.5 rounded-full"
                        style={{ backgroundColor: isSel ? "#fff" : cat.color }}
                      />
                      {cat.name}
                    </button>
                  );
                })}
              </div>

              {/* TimeBlock time pickers */}
              {type === "TimeBlock" && (
                <div className="flex flex-wrap items-center gap-4 px-2 py-1 pb-1.5 border-b border-dashed border-gray-100 dark:border-gray-800/40 text-xs">
                  <div className="flex items-center gap-1.5">
                    <span className="font-semibold uppercase tracking-wider text-[9px]">
                      Start:
                    </span>
                    <input
                      type="time"
                      value={timeBlockStart}
                      onChange={(e) => setTimeBlockStart(e.target.value)}
                      className={`px-2 py-1 rounded-lg border focus:outline-none focus:ring-1 focus:ring-purple-500 ${darkMode ? "bg-gray-800 border-gray-700 text-gray-300" : "bg-white border-gray-200 text-gray-800"}`}
                    />
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="font-semibold uppercase tracking-wider text-[9px]">
                      End:
                    </span>
                    <input
                      type="time"
                      value={timeBlockEnd}
                      onChange={(e) => setTimeBlockEnd(e.target.value)}
                      className={`px-2 py-1 rounded-lg border focus:outline-none focus:ring-1 focus:ring-purple-500 ${darkMode ? "bg-gray-800 border-gray-700 text-gray-300" : "bg-white border-gray-200 text-gray-800"}`}
                    />
                  </div>
                  <span className="text-[9px] text-purple-400 font-semibold italic ml-auto uppercase tracking-wider">
                    Or write @9am -&gt; @11am in text
                  </span>
                </div>
              )}

              {/* Text input */}
              <div className="flex items-center gap-3 pr-2">
                <input
                  type="text"
                  value={content}
                  onChange={(e) => handleContentChange(e.target.value)}
                  placeholder={
                    type === "Task"
                      ? "Capture a task note... Use #Work @3pm"
                      : type === "SessionLog"
                        ? "Log what happened... Use #Work @3pm"
                        : type === "Achievement"
                          ? "Record a win... Use #Work @3pm"
                          : "Write a journal entry... Use #Work for category @3pm for time"
                  }
                  className="flex-1 bg-transparent px-3 py-2 text-sm outline-none border-none placeholder-gray-500 text-gray-800 dark:text-gray-100"
                />
                <div className="relative flex items-center shrink-0">
                  <button
                    type="button"
                    onClick={() => setShowTooltip(!showTooltip)}
                    onMouseEnter={() => setShowTooltip(true)}
                    onMouseLeave={() => setShowTooltip(false)}
                    className="p-2 text-gray-400 hover:text-blue-500 transition-colors"
                  >
                    <Wand2 className="w-4 h-4" />
                  </button>
                  <AnimatePresence>
                    {showTooltip && (
                      <motion.div
                        initial={{ opacity: 0, scale: 0.95, y: 10 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.95, y: 10 }}
                        className="absolute right-0 bottom-full mb-2 w-64 p-4 bg-gray-950 dark:bg-gray-800 text-white rounded-2xl shadow-2xl z-[110] border border-gray-850 dark:border-gray-700 text-[10px] space-y-2 pointer-events-none"
                      >
                        <p className="font-black text-blue-400 uppercase tracking-wider mb-1 text-xs flex items-center gap-1.5">
                          <Wand2 className="w-3.5 h-3.5 text-blue-400 animate-pulse" />
                          Journal Parsing Guide
                        </p>
                        <div className="space-y-1 text-gray-300">
                          <p>
                            <b className="text-white">#Category:</b> Use{" "}
                            <code className="bg-black/25 px-1 py-0.5 rounded text-purple-300 font-mono">
                              #work
                            </code>{" "}
                            or{" "}
                            <code className="bg-black/25 px-1 py-0.5 rounded text-purple-300 font-mono">
                              #gym
                            </code>
                          </p>
                          <p>
                            <b className="text-white">@Log Time:</b> Use{" "}
                            <code className="bg-black/25 px-1 py-0.5 rounded text-green-300 font-mono">
                              @2pm
                            </code>{" "}
                            or{" "}
                            <code className="bg-black/25 px-1 py-0.5 rounded text-green-300 font-mono">
                              @14:30
                            </code>{" "}
                            to log entry at a specific time
                          </p>
                        </div>
                        <div className="pt-1.5 border-t border-white/10 text-[9px] text-gray-400 italic">
                          Example: Did code review #work @3pm
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
                <button
                  type="submit"
                  disabled={!content.trim()}
                  className={`p-2.5 rounded-xl transition-all ${content.trim() ? "bg-blue-600 text-white hover:bg-blue-700" : "bg-gray-200 text-gray-400"}`}
                >
                  <Send className="w-5 h-5" />
                </button>
              </div>
            </div>
          </form>
        </div>
      </div>
    </motion.div>
  );
}
