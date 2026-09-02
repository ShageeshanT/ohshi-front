/**
 * The bar across the top of every signed-in page: the page title on the left,
 * search, the theme switch and the account menu on the right. On a phone it
 * also carries the button that opens the sidebar.
 */

import { useEffect, useRef, useState, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { BookOpen, CreditCard, KeyRound, LayoutDashboard, LogOut, Menu, Moon, Search, Settings, Sun } from "lucide-react";
import { useAuth, useShell } from "../App";
import { useTheme } from "../lib/theme";
import { Avatar, IconButton } from "./ui";

export function Topbar(props: { title: ReactNode; aside?: ReactNode; actions?: ReactNode }) {
  const { openNav, openSearch } = useShell();
  const { theme, toggle } = useTheme();
  const dark = theme === "dark";

  return (
    <header className="flex h-12 shrink-0 items-center gap-3 border-b border-edge bg-panel px-3 md:px-5">
      <IconButton icon={Menu} label="Open menu" onClick={openNav} className="md:hidden" />
      <div className="flex min-w-0 flex-1 items-center gap-2.5">
        <h1 className="truncate text-[13.5px] font-semibold tracking-tight">{props.title}</h1>
        {props.aside}
      </div>
      <div className="flex shrink-0 items-center gap-1.5">
        {props.actions}
        <button
          type="button"
          onClick={openSearch}
          className="hidden h-8 w-48 items-center gap-2 rounded-lg border border-edge bg-panel px-2.5 text-[12.5px] text-ink-dim transition-colors hover:border-edge-strong hover:text-ink lg:flex"
        >
          <Search className="h-3.5 w-3.5" />
          Search
          <kbd className="kbd ml-auto">Ctrl K</kbd>
        </button>
        <IconButton icon={Search} label="Search" onClick={openSearch} className="lg:hidden" />
        <IconButton icon={dark ? Sun : Moon} label={dark ? "Switch to light theme" : "Switch to dark theme"} onClick={toggle} />
        <UserMenu />
      </div>
    </header>
  );
}

function UserMenu() {
  const { me, signOut } = useAuth();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const name = me?.user.displayName || me?.user.email.split("@")[0] || "";

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const item = "flex items-center gap-2.5 rounded-md px-2 py-1.5 text-[13px] text-ink transition-colors hover:bg-ink/[0.05]";

  return (
    <div ref={ref} className="relative ml-1">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex items-center rounded-full ring-offset-2 ring-offset-panel transition-shadow hover:ring-2 hover:ring-edge-strong"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label="Account menu"
      >
        <Avatar name={name} size="sm" />
      </button>
      {open && (
        <div
          role="menu"
          className="pop-in absolute right-0 top-full z-40 mt-2 w-60 overflow-hidden rounded-xl border border-edge bg-panel p-1.5 shadow-[0_16px_40px_-16px_rgb(0_0_0/0.35)]"
        >
          <div className="px-2 pb-2 pt-1.5">
            <p className="truncate text-[13px] font-semibold">{name}</p>
            <p className="truncate text-[12px] text-ink-dim">{me?.user.email}</p>
          </div>
          <div className="my-1 h-px bg-edge" />
          <Link to="/app/profile" className={item} onClick={() => setOpen(false)} role="menuitem">
            <Settings className="h-4 w-4 text-ink-dim" /> Account settings
          </Link>
          <Link to="/app/dashboard" className={item} onClick={() => setOpen(false)} role="menuitem">
            <LayoutDashboard className="h-4 w-4 text-ink-dim" /> Overview
          </Link>
          <Link to="/app/billing" className={item} onClick={() => setOpen(false)} role="menuitem">
            <CreditCard className="h-4 w-4 text-ink-dim" /> Plan and billing
          </Link>
          <Link to="/app/keys" className={item} onClick={() => setOpen(false)} role="menuitem">
            <KeyRound className="h-4 w-4 text-ink-dim" /> API keys
          </Link>
          <Link to="/app/docs" className={item} onClick={() => setOpen(false)} role="menuitem">
            <BookOpen className="h-4 w-4 text-ink-dim" /> Docs
          </Link>
          <div className="my-1 h-px bg-edge" />
          <button type="button" className={`${item} w-full`} onClick={() => void signOut()} role="menuitem">
            <LogOut className="h-4 w-4 text-ink-dim" /> Sign out
          </button>
        </div>
      )}
    </div>
  );
}
