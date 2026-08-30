import { Moon, Sun } from "lucide-react";
import { useTheme } from "../../lib/theme";

/** Sits where the mockup's "EN" chip is — same shape, but it actually does
 *  something: flips light / dark. */
export function ThemeToggle(props: { compact?: boolean; className?: string }) {
  const { theme, toggle } = useTheme();
  const dark = theme === "dark";
  return (
    <button
      type="button"
      onClick={toggle}
      className={`mk-chip ${props.className ?? ""}`}
      aria-label={dark ? "Switch to light theme" : "Switch to dark theme"}
      title={dark ? "Light theme" : "Dark theme"}
    >
      {dark ? <Moon className="h-4 w-4" /> : <Sun className="h-4 w-4" />}
      {!props.compact && <span>{dark ? "Dark" : "Light"}</span>}
    </button>
  );
}
