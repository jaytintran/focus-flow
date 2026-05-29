import React, { createContext, useContext, useState, useEffect, useCallback } from "react";
import type { Theme } from "./types";
import * as db from "./db";

interface ThemeContextValue {
	theme: Theme;
	setTheme: (t: Theme) => void;
	isDark: boolean;
}

const ThemeContext = createContext<ThemeContextValue | undefined>(undefined);

function getInitialTheme(): Theme {
	return "light";
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
	const [theme, setThemeState] = useState<Theme>(getInitialTheme);
	const [loaded, setLoaded] = useState(false);

	// Load theme from DB on mount
	useEffect(() => {
		async function loadTheme() {
			try {
				let saved = await db.getSetting("focusflow_theme");
				if (!saved) {
					// Try legacy migration
					const legacy = await db.getSetting("focusflow_darkmode");
					if (legacy === "true") {
						saved = "dark";
						await db.setSetting("focusflow_theme", saved);
					}
				}
				if (saved && ["light", "dark", "sepia", "forest", "ocean"].includes(saved)) {
					setThemeState(saved as Theme);
				}
			} catch (e) {
				console.error("Failed to load theme:", e);
			}
			setLoaded(true);
		}
		loadTheme();
	}, []);

	// Apply theme and persist on change
	useEffect(() => {
		if (!loaded) return;
		document.documentElement.dataset.theme = theme;
		const isDark = theme === "dark" || theme === "forest" || theme === "ocean";
		if (isDark) {
			document.documentElement.classList.add("dark");
		} else {
			document.documentElement.classList.remove("dark");
		}
		db.setSetting("focusflow_theme", theme);
	}, [theme, loaded]);

	const setTheme = useCallback((t: Theme) => {
		setThemeState(t);
	}, []);

	const isDark = theme === "dark" || theme === "forest" || theme === "ocean";

	return (
		<ThemeContext.Provider value={{ theme, setTheme, isDark }}>
			{children}
		</ThemeContext.Provider>
	);
}

export function useTheme(): ThemeContextValue {
	const ctx = useContext(ThemeContext);
	if (!ctx) throw new Error("useTheme must be used inside ThemeProvider");
	return ctx;
}
