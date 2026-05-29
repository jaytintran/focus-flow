export type Tag = "quick" | "explore" | "finish" | "handle";
export type ViewMode = "compact" | "normal" | "mini";
export type LayoutType = "list" | "table";

export interface Category {
	id: string;
	name: string;
	color: string;
	iconName?: string;
	isDefault?: boolean;
	isHidden?: boolean;
}

export interface Task {
	id: string;
	name: string;
	description?: string;
	categoryId: string;
	tag: Tag;
	spentTime: number; // in milliseconds
	dueDate?: string;
	isRecurring?: boolean;
	recurringIcon?: string;
	recurringColor?: string;
	completedDates?: string[];
	completed: boolean;
	createdAt: number;
	completedAt?: number;
	startAt?: number; // Unix timestamp in milliseconds for start
	duration?: number; // Duration in milliseconds
	endAt?: number; // Unix timestamp in milliseconds for end
	inbox?: boolean; // Flag for inbox tasks
}

export type JournalType = "Task" | "Event" | "SessionLog" | "Achievement";

export interface JournalEntry {
	id: string;
	content: string;
	type: JournalType;
	timestamp: number;
	categoryId?: string;
	linkedTaskId?: string;
	linkedTaskName?: string;
	linkedTaskIds?: string[];
	linkedTaskNames?: string[];
}
