import { Priority } from "./types";

export function formatDuration(ms: number): string {
	const seconds = Math.floor((ms / 1000) % 60);
	const minutes = Math.floor((ms / (1000 * 60)) % 60);
	const hours = Math.floor(ms / (1000 * 60 * 60));

	const h = hours > 0 ? `${hours}h ` : "";
	const m = minutes > 0 ? `${minutes}m ` : "";
	const s = `${seconds}s`;

	return `${h}${m}${s}`.trim();
}

export function formatTimer(ms: number): string {
	const seconds = Math.floor((ms / 1000) % 60);
	const minutes = Math.floor((ms / (1000 * 60)) % 60);
	const hours = Math.floor(ms / (1000 * 60 * 60));

	return [
		hours.toString().padStart(2, "0"),
		minutes.toString().padStart(2, "0"),
		seconds.toString().padStart(2, "0"),
	].join(":");
}

export function generateId(): string {
	return Math.random().toString(36).substring(2, 9);
}

export function formatDueDate(dateStr: string): string {
	const dueDate = new Date(dateStr);
	const now = new Date();
	const diffMs = dueDate.getTime() - now.getTime();
	const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));

	// Reset hours to compare dates only
	const dDate = new Date(
		dueDate.getFullYear(),
		dueDate.getMonth(),
		dueDate.getDate(),
	);
	const nDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
	const dayDiff = Math.floor(
		(dDate.getTime() - nDate.getTime()) / (1000 * 60 * 60 * 24),
	);

	if (dayDiff === 0) {
		if (diffMs < 0) return "Overdue today";
		const hours = Math.floor(diffMs / (1000 * 60 * 60));
		const mins = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
		if (hours > 0) return `Due in ${hours}h`;
		return `Due in ${mins}m`;
	}

	if (dayDiff > 0) {
		const dateLabel = dueDate.toLocaleDateString(undefined, {
			month: "short",
			day: "numeric",
		});
		return `Due in ${dayDiff}d (${dateLabel})`;
	}

	return `Due ${dueDate.toLocaleDateString(undefined, { month: "short", day: "numeric" })}`;
}

export function parseSmartInput(input: string): {
	cleanName: string;
	categoryName?: string;
	relativeDate?: Date;
	priority?: Priority;
	isRecurring?: boolean;
	recurringPattern?: "daily" | "weekly";
} {
	let cleanName = input;
	let categoryName: string | undefined;
	let relativeDate: Date | undefined;
	let priority: Priority | undefined;
	let isRecurring = false;
	let recurringPattern: "daily" | "weekly" | undefined;

	// Extract category (#tag)
	const categoryMatch = input.match(/#(\w+)/);
	if (categoryMatch) {
		categoryName = categoryMatch[1];
		cleanName = cleanName.replace(/#\w+/g, "").trim();
	}

	// Extract recurring patterns (@daily, @weekly, etc.)
	const recurringMatch = input.match(/@(daily|day|weekly|week)/i);
	if (recurringMatch) {
		isRecurring = true;
		const pattern = recurringMatch[1].toLowerCase();
		recurringPattern =
			pattern === "daily" || pattern === "day" ? "daily" : "weekly";
		cleanName = cleanName.replace(/@(daily|day|weekly|week)/gi, "").trim();
	}

	// Extract priority (!! or !high, !medium, !low)
	const priorityMatch = input.match(
		/!!(high|medium|low)?|!(high|med|medium|low)/i,
	);
	if (priorityMatch) {
		const priorityText = (
			priorityMatch[1] ||
			priorityMatch[2] ||
			"high"
		).toLowerCase();
		if (priorityText === "high" || priorityText === "!!") {
			priority = "High";
		} else if (priorityText === "medium" || priorityText === "med") {
			priority = "Medium";
		} else if (priorityText === "low") {
			priority = "Low";
		}
		cleanName = cleanName.replace(/!!|!(high|med|medium|low)/gi, "").trim();
	}

	// Extract time patterns
	const timeMatch = input.match(
		/!(today|tomorrow|tmr|mon|tue|wed|thu|fri|sat|sun|(\d+)([hdw]))/i,
	);
	if (timeMatch) {
		const timePattern = timeMatch[1].toLowerCase();
		const now = new Date();

		if (timePattern === "today") {
			relativeDate = now;
		} else if (timePattern === "tomorrow" || timePattern === "tmr") {
			relativeDate = new Date(now.getTime() + 24 * 60 * 60 * 1000);
		} else if (
			["mon", "tue", "wed", "thu", "fri", "sat", "sun"].includes(timePattern)
		) {
			// Day of week
			const dayMap: { [key: string]: number } = {
				sun: 0,
				mon: 1,
				tue: 2,
				wed: 3,
				thu: 4,
				fri: 5,
				sat: 6,
			};
			const targetDay = dayMap[timePattern];
			const currentDay = now.getDay();
			let daysToAdd = targetDay - currentDay;
			if (daysToAdd <= 0) daysToAdd += 7; // Next week if day already passed
			relativeDate = new Date(now.getTime() + daysToAdd * 24 * 60 * 60 * 1000);
		} else if (timeMatch[2] && timeMatch[3]) {
			// Relative time: 2h, 3d, 1w
			const amount = parseInt(timeMatch[2]);
			const unit = timeMatch[3].toLowerCase();
			let milliseconds = 0;

			if (unit === "h") {
				milliseconds = amount * 60 * 60 * 1000;
			} else if (unit === "d") {
				milliseconds = amount * 24 * 60 * 60 * 1000;
			} else if (unit === "w") {
				milliseconds = amount * 7 * 24 * 60 * 60 * 1000;
			}

			relativeDate = new Date(now.getTime() + milliseconds);
		}

		cleanName = cleanName
			.replace(
				/!(today|tomorrow|tmr|mon|tue|wed|thu|fri|sat|sun|\d+[hdw])/gi,
				"",
			)
			.trim();
	}

	// Final cleanup - remove extra spaces
	cleanName = cleanName.replace(/\s+/g, " ").trim();

	return {
		cleanName,
		categoryName,
		relativeDate,
		priority,
		isRecurring,
		recurringPattern,
	};
}

export function formatDateToInput(date: Date): string {
	const year = date.getFullYear();
	const month = String(date.getMonth() + 1).padStart(2, "0");
	const day = String(date.getDate()).padStart(2, "0");
	return `${year}-${month}-${day}`;
}

export function calculateStreak(completedDates: string[] | undefined): number {
	if (!completedDates || completedDates.length === 0) return 0;

	const todayStr = new Date().toISOString().split("T")[0];
	const yesterday = new Date();
	yesterday.setDate(yesterday.getDate() - 1);
	const yesterdayStr = yesterday.toISOString().split("T")[0];

	const dateSet = new Set(completedDates);

	// Check if completed today or yesterday to see if streak is active
	const completedToday = dateSet.has(todayStr);
	const completedYesterday = dateSet.has(yesterdayStr);

	if (!completedToday && !completedYesterday) {
		return 0;
	}

	let currentStreak = 0;
	// Start counting backward from today if completed today, otherwise from yesterday
	const checkDate = completedToday ? new Date() : yesterday;

	while (true) {
		const checkStr = checkDate.toISOString().split("T")[0];
		if (dateSet.has(checkStr)) {
			currentStreak++;
			checkDate.setDate(checkDate.getDate() - 1);
		} else {
			break;
		}
	}

	return currentStreak;
}

