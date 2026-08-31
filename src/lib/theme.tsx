/**
 * Light / dark theme. The choice lives in localStorage and on
 * `<html data-theme>`; index.html applies it before React mounts so the first
 * paint is already the right colour. Tokens for both themes are in index.css.
 *
 * Light is the default and the OS preference is deliberately ignored: the
 * brand art, the hero painting and the auth pages are all cut light-first, so
 * a visitor arriving on a dark-mode machine should still meet the site the way
 * it was designed. Dark is opt-in through the toggle, and once chosen it
 * sticks. Keep this in step with the inline script in index.html.
 */

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";

export type Theme = "light" | "dark";

const STORAGE_KEY = "ohshi.theme";
const MOTION_STORAGE_KEY = "ohshi.reduce-motion";

function initialTheme(): Theme {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored === "light" || stored === "dark") return stored;
  } catch {
    /* private mode */
  }
  const attr = document.documentElement.getAttribute("data-theme");
  if (attr === "light" || attr === "dark") return attr;
  return "light";
}

function initialReducedMotion(): boolean {
  try {
    return localStorage.getItem(MOTION_STORAGE_KEY) === "1";
  } catch {
    return false;
  }
}

interface ThemeState {
  theme: Theme;
  setTheme: (theme: Theme) => void;
  toggle: () => void;
  reducedMotion: boolean;
  setReducedMotion: (reduced: boolean) => void;
}

const ThemeContext = createContext<ThemeState>({
  theme: "light",
  setTheme: () => {},
  toggle: () => {},
  reducedMotion: false,
  setReducedMotion: () => {},
});

export function ThemeProvider(props: { children: ReactNode }) {
  const [theme, setThemeState] = useState<Theme>(initialTheme);
  const [reducedMotion, setReducedMotionState] = useState(initialReducedMotion);

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
    try {
      localStorage.setItem(STORAGE_KEY, theme);
    } catch {
      /* ignore */
    }
  }, [theme]);

  useEffect(() => {
    document.documentElement.setAttribute("data-reduce-motion", reducedMotion ? "true" : "false");
    try {
      localStorage.setItem(MOTION_STORAGE_KEY, reducedMotion ? "1" : "0");
    } catch {
      /* ignore */
    }
  }, [reducedMotion]);

  const setTheme = useCallback((next: Theme) => setThemeState(next), []);
  const toggle = useCallback(() => setThemeState((t) => (t === "dark" ? "light" : "dark")), []);
  const setReducedMotion = useCallback((next: boolean) => setReducedMotionState(next), []);
  const value = useMemo(
    () => ({ theme, setTheme, toggle, reducedMotion, setReducedMotion }),
    [theme, setTheme, toggle, reducedMotion, setReducedMotion],
  );
  return <ThemeContext.Provider value={value}>{props.children}</ThemeContext.Provider>;
}

export const useTheme = () => useContext(ThemeContext);
