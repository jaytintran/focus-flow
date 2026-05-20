export const HABIT_COLORS = [
	// Vibrant & Energetic
	{
		name: "Sunset Orange",
		value: "#FF6B35",
		light: "#FF8C61",
		dark: "#E55A2B",
	},
	{
		name: "Electric Blue",
		value: "#0066FF",
		light: "#3385FF",
		dark: "#0052CC",
	},
	{ name: "Neon Pink", value: "#FF006E", light: "#FF3388", dark: "#CC0058" },
	{ name: "Lime Green", value: "#00F5A0", light: "#33F7B3", dark: "#00C480" },
	{ name: "Purple Haze", value: "#8B5CF6", light: "#A78BFA", dark: "#7C3AED" },

	// Sophisticated & Premium
	{ name: "Royal Purple", value: "#6366F1", light: "#818CF8", dark: "#4F46E5" },
	{ name: "Emerald", value: "#10B981", light: "#34D399", dark: "#059669" },
	{ name: "Rose Gold", value: "#F43F5E", light: "#FB7185", dark: "#E11D48" },
	{ name: "Sapphire", value: "#3B82F6", light: "#60A5FA", dark: "#2563EB" },
	{ name: "Amber", value: "#F59E0B", light: "#FBBF24", dark: "#D97706" },

	// Calm & Focused
	{ name: "Ocean Blue", value: "#0EA5E9", light: "#38BDF8", dark: "#0284C7" },
	{ name: "Mint", value: "#14B8A6", light: "#2DD4BF", dark: "#0D9488" },
	{ name: "Lavender", value: "#A855F7", light: "#C084FC", dark: "#9333EA" },
	{ name: "Coral", value: "#FB923C", light: "#FDBA74", dark: "#F97316" },
	{ name: "Sky Blue", value: "#06B6D4", light: "#22D3EE", dark: "#0891B2" },

	// Bold & Modern
	{ name: "Crimson", value: "#DC2626", light: "#EF4444", dark: "#B91C1C" },
	{ name: "Teal", value: "#14B8A6", light: "#2DD4BF", dark: "#0D9488" },
	{ name: "Magenta", value: "#D946EF", light: "#E879F9", dark: "#C026D3" },
	{ name: "Gold", value: "#EAB308", light: "#FACC15", dark: "#CA8A04" },
	{ name: "Cyan", value: "#06B6D4", light: "#22D3EE", dark: "#0891B2" },

	// Earthy & Natural
	{ name: "Forest Green", value: "#16A34A", light: "#22C55E", dark: "#15803D" },
	{ name: "Terracotta", value: "#EA580C", light: "#FB923C", dark: "#C2410C" },
	{ name: "Slate Blue", value: "#475569", light: "#64748B", dark: "#334155" },
	{ name: "Olive", value: "#84CC16", light: "#A3E635", dark: "#65A30D" },
	{ name: "Burgundy", value: "#BE123C", light: "#E11D48", dark: "#9F1239" },

	// Pastel & Soft
	{ name: "Soft Pink", value: "#F472B6", light: "#F9A8D4", dark: "#EC4899" },
	{ name: "Peach", value: "#FCA5A5", light: "#FECACA", dark: "#F87171" },
	{ name: "Baby Blue", value: "#93C5FD", light: "#BFDBFE", dark: "#60A5FA" },
	{ name: "Mint Cream", value: "#6EE7B7", light: "#A7F3D0", dark: "#34D399" },
	{ name: "Lilac", value: "#C4B5FD", light: "#DDD6FE", dark: "#A78BFA" },

	// Dark & Mysterious
	{
		name: "Midnight Blue",
		value: "#1E3A8A",
		light: "#3B82F6",
		dark: "#1E40AF",
	},
	{ name: "Deep Purple", value: "#581C87", light: "#9333EA", dark: "#6B21A8" },
	{ name: "Charcoal", value: "#374151", light: "#6B7280", dark: "#1F2937" },
	{ name: "Wine", value: "#881337", light: "#BE123C", dark: "#9F1239" },
	{ name: "Navy", value: "#1E40AF", light: "#3B82F6", dark: "#1E3A8A" },
];

export type HabitColor = (typeof HABIT_COLORS)[number];
