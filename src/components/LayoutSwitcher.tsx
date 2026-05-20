import React from "react";
import { List, LayoutGrid, Table as TableIcon } from "lucide-react";
import { LayoutType } from "../types";

interface LayoutSwitcherProps {
	current: LayoutType;
	onChange: (layout: LayoutType) => void;
	darkMode: boolean;
}

export const LayoutSwitcher: React.FC<LayoutSwitcherProps> = ({
	current,
	onChange,
	darkMode,
}) => {
	const layouts: { type: LayoutType; icon: any; label: string }[] = [
		{ type: "list", icon: List, label: "List" },
		{ type: "gallery", icon: LayoutGrid, label: "Gallery" },
		{ type: "table", icon: TableIcon, label: "Table" },
	];

	return (
		<div
			className={`flex items-center p-1 rounded-2xl border ${darkMode ? "bg-gray-900 border-gray-800" : "bg-white border-gray-100"}`}
		>
			{layouts.map(({ type, icon: Icon, label }) => (
				<button
					key={type}
					onClick={() => onChange(type)}
					className={`px-3 py-1.5 rounded-xl transition-all flex items-center gap-2 text-xs font-bold ${
						current === type
							? darkMode
								? "bg-blue-500/20 text-blue-400"
								: "bg-blue-50 text-blue-600"
							: "text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
					}`}
					title={label}
				>
					<Icon className="w-4 h-4" />
					<span className="hidden sm:inline">{label}</span>
				</button>
			))}
		</div>
	);
};
