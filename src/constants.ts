import { Category } from "./types";

export const DEFAULT_CATEGORIES: Category[] = [
	{
		id: "1",
		name: "Work",
		color: "#3b82f6",
		iconName: "Briefcase",
		isDefault: true,
	},
	{ id: "2", name: "Personal", color: "#10b981", iconName: "User" },
	{ id: "3", name: "Health", color: "#ef4444", iconName: "Heart" },
	{ id: "4", name: "Studies", color: "#f59e0b", iconName: "Book" },
	{ id: "5", name: "Finance", color: "#8b5cf6", iconName: "DollarSign" },
];

export const TAGS: { label: string; color: string }[] = [
	{ label: "quick", color: "#10b981" },
	{ label: "explore", color: "#3b82f6" },
	{ label: "finish", color: "#f59e0b" },
	{ label: "handle", color: "#ef4444" },
];
