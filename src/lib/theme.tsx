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

interface ThemeState {
  theme: Theme;
  setTheme: (theme: Theme) => void;
  toggle: () => void;
}

const ThemeContext = createContext<ThemeState>({ theme: "light", setTheme: () => {}, toggle: () => {} });

export function ThemeProvider(props: { children: ReactNode }) {
  const [theme, setThemeState] = useState<Theme>(initialTheme);

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
    try {
      localStorage.setItem(STORAGE_KEY, theme);
    } catch {
      /* ignore */
    }
  }, [theme]);

  const setTheme = useCallback((next: Theme) => setThemeState(next), []);
  const toggle = useCallback(() => setThemeState((t) => (t === "dark" ? "light" : "dark")), []);
  const value = useMemo(() => ({ theme, setTheme, toggle }), [theme, setTheme, toggle]);
  return <ThemeContext.Provider value={value}>{props.children}</ThemeContext.Provider>;
}

export const useTheme = () => useContext(ThemeContext);
