/**
 * App sidebar in the Grok style: brand + collapse, Search, New Chat, the
 * workspace links, date-grouped chat history, and the user chip.
 */

import { useEffect, useRef, useState, type ComponentType } from "react";
import { Link, NavLink, useLocation } from "react-router-dom";
import {
  BookOpen,
  ChevronsLeft,
  ChevronsRight,
  KeyRound,
  LogOut,
  Pencil,
  Plug,
  Search,
  SquarePen,
  Trash2,
  X,
} from "lucide-react";
import type { ChatSummary } from "../lib/chat";
import { groupChatsByDate } from "../lib/chat";
import { BrandMark } from "./brand";

export interface SidebarProps {
  chats: ChatSummary[];
  activeChatId: string | null;
  collapsed: boolean;
  onToggleCollapsed: () => void;
  mobileOpen: boolean;
  onMobileClose: () => void;
  onSearch: () => void;
  onRename: (id: string, title: string) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
  user: { email: string; displayName: string };
  onSignOut: () => void;
}

type Icon = ComponentType<{ className?: string }>;

export default function Sidebar(p: SidebarProps) {
  const location = useLocation();
  const onNewChat = location.pathname === "/";
  const groups = groupChatsByDate(p.chats);
  const initials = (p.user.displayName || p.user.email).trim().charAt(0).toUpperCase() || "?";
  const name = p.user.displayName || p.user.email.split("@")[0];

  return (
    <>
      {p.mobileOpen && (
        <div className="fixed inset-0 z-30 bg-night/40 backdrop-blur-[2px] md:hidden" onClick={p.onMobileClose} />
      )}
      <aside
        className={`fixed inset-y-0 left-0 z-40 flex w-[272px] flex-col border-r border-edge bg-panel transition-[transform,width] duration-200 md:static md:translate-x-0 ${
          p.collapsed ? "md:w-[68px]" : "md:w-[272px]"
        } ${p.mobileOpen ? "translate-x-0" : "-translate-x-full"}`}
      >
        <div className={`flex items-center px-3 pb-1 pt-4 ${p.collapsed ? "justify-center" : "justify-between"}`}>
          <Link to="/" className="flex items-center gap-2.5" title="Ohshi" onClick={p.onMobileClose}>
            <BrandMark />
            {!p.collapsed && <span className="text-lg font-semibold tracking-tight">Ohshi</span>}
          </Link>
          {!p.collapsed && (
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={p.onToggleCollapsed}
                className="hidden rounded-lg p-1.5 text-ink-dim hover:bg-panel-2 hover:text-ink md:inline-flex"
                aria-label="Collapse sidebar"
              >
                <ChevronsLeft className="h-4 w-4" />
              </button>
              <button
                type="button"
                onClick={p.onMobileClose}
                className="rounded-lg p-1.5 text-ink-dim hover:bg-panel-2 md:hidden"
                aria-label="Close menu"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          )}
        </div>
        {p.collapsed && (
          <button
            type="button"
            onClick={p.onToggleCollapsed}
            className="mx-auto mb-1 hidden rounded-lg p-1.5 text-ink-dim hover:bg-panel-2 hover:text-ink md:inline-flex"
            aria-label="Expand sidebar"
          >
            <ChevronsRight className="h-4 w-4" />
          </button>
        )}

        <nav className="mt-2 space-y-1 px-3">
          <SideButton icon={Search} label="Search" hint="Ctrl K" collapsed={p.collapsed} onClick={p.onSearch} />
          <SideLink icon={SquarePen} label="New Chat" to="/" active={onNewChat} collapsed={p.collapsed} onClick={p.onMobileClose} />
        </nav>

        <div className="mt-5 space-y-1 px-3">
          {!p.collapsed && <SectionLabel>Workspace</SectionLabel>}
          <SideLink icon={Plug} label="Google accounts" to="/accounts" collapsed={p.collapsed} onClick={p.onMobileClose} />
          <SideLink icon={KeyRound} label="API keys" to="/keys" collapsed={p.collapsed} onClick={p.onMobileClose} />
          <SideLink icon={BookOpen} label="Docs" to="/docs" collapsed={p.collapsed} onClick={p.onMobileClose} />
        </div>

        {p.collapsed ? (
          <div className="flex-1" />
        ) : (
          <div className="mt-5 min-h-0 flex-1 overflow-y-auto px-3 pb-2">
            <SectionLabel>History</SectionLabel>
            {groups.length === 0 ? (
              <p className="px-3 py-2 text-xs text-ink-dim">Your chats will show up here.</p>
            ) : (
              groups.map((g) => (
                <div key={g.label} className="mb-3">
                  <p className="px-3 pb-1 pt-1 text-[11px] font-medium text-ink-dim/80">{g.label}</p>
                  {g.chats.map((chat) => (
                    <HistoryRow
                      key={chat.id}
                      chat={chat}
                      active={chat.id === p.activeChatId}
                      onRename={(title) => p.onRename(chat.id, title)}
                      onDelete={() => p.onDelete(chat.id)}
                      onNavigate={p.onMobileClose}
                    />
                  ))}
                </div>
              ))
            )}
          </div>
        )}

        <div className={`border-t border-edge p-3 ${p.collapsed ? "flex justify-center" : "flex items-center gap-3"}`}>
          <span
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-night text-sm font-semibold text-white"
            title={p.user.email}
          >
            {initials}
          </span>
          {!p.collapsed && (
            <>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold">{name}</p>
                <p className="truncate text-xs text-ink-dim">{p.user.email}</p>
              </div>
              <button
                type="button"
                onClick={p.onSignOut}
                className="rounded-lg p-1.5 text-ink-dim hover:bg-panel-2 hover:text-ink"
                aria-label="Sign out"
                title="Sign out"
              >
                <LogOut className="h-4 w-4" />
              </button>
            </>
          )}
        </div>
      </aside>
    </>
  );
}

function SectionLabel(props: { children: string }) {
  return <p className="px-3 pb-1 text-[11px] font-semibold uppercase tracking-wider text-ink-dim">{props.children}</p>;
}

const itemBase = "flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-[15px] font-semibold transition-colors";

function SideButton(props: { icon: Icon; label: string; hint?: string; collapsed: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={props.onClick}
      title={props.label}
      className={`${itemBase} text-ink hover:bg-panel-2 ${props.collapsed ? "justify-center px-0" : ""}`}
    >
      <props.icon className="h-5 w-5 shrink-0" />
      {!props.collapsed && <span className="flex-1 text-left">{props.label}</span>}
      {!props.collapsed && props.hint && <kbd className="text-[10px] font-medium text-ink-dim">{props.hint}</kbd>}
    </button>
  );
}

function SideLink(props: {
  icon: Icon;
  label: string;
  to: string;
  active?: boolean;
  collapsed: boolean;
  onClick?: () => void;
}) {
  return (
    <NavLink
      to={props.to}
      end={props.to === "/"}
      onClick={props.onClick}
      title={props.label}
      className={({ isActive }) => {
        const active = props.active ?? isActive;
        return `${itemBase} ${active ? "bg-panel-2 text-ink" : "text-ink hover:bg-panel-2/70"} ${
          props.collapsed ? "justify-center px-0" : ""
        }`;
      }}
    >
      <props.icon className="h-5 w-5 shrink-0" />
      {!props.collapsed && <span>{props.label}</span>}
    </NavLink>
  );
}

function HistoryRow(props: {
  chat: ChatSummary;
  active: boolean;
  onRename: (title: string) => Promise<void>;
  onDelete: () => Promise<void>;
  onNavigate: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState(props.chat.title);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editing) inputRef.current?.select();
  }, [editing]);

  const commit = () => {
    const next = title.trim();
    setEditing(false);
    if (next && next !== props.chat.title) void props.onRename(next);
    else setTitle(props.chat.title);
  };

  if (editing) {
    return (
      <input
        ref={inputRef}
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === "Enter") commit();
          if (e.key === "Escape") {
            setTitle(props.chat.title);
            setEditing(false);
          }
        }}
        className="w-full rounded-lg border border-accent bg-panel px-2.5 py-1.5 text-sm outline-none"
      />
    );
  }

  return (
    <div
      className={`group flex items-center rounded-xl pr-1 ${props.active ? "bg-panel-2" : "hover:bg-panel-2/70"}`}
    >
      <Link
        to={`/c/${props.chat.id}`}
        onClick={props.onNavigate}
        className="min-w-0 flex-1 truncate px-3 py-2 text-sm text-ink"
        title={props.chat.title || "New chat"}
      >
        {props.chat.title || "New chat"}
      </Link>
      <div className="flex shrink-0 items-center opacity-0 transition-opacity group-hover:opacity-100 focus-within:opacity-100">
        <button
          type="button"
          onClick={() => {
            setTitle(props.chat.title);
            setEditing(true);
          }}
          className="rounded-md p-1 text-ink-dim hover:bg-edge hover:text-ink"
          aria-label="Rename chat"
        >
          <Pencil className="h-3.5 w-3.5" />
        </button>
        <button
          type="button"
          onClick={() => {
            if (window.confirm(`Delete "${props.chat.title || "New chat"}"?`)) void props.onDelete();
          }}
          className="rounded-md p-1 text-ink-dim hover:bg-danger-soft hover:text-danger"
          aria-label="Delete chat"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
}
