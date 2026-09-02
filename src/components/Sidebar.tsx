/**
 * App sidebar: brand and collapse, New chat and Search, the workspace links,
 * date-grouped chat history, and the account chip at the bottom.
 */

import { useEffect, useRef, useState, type ComponentType } from "react";
import { Link, NavLink, useLocation } from "react-router-dom";
import {
  BookOpen,
  KeyRound,
  LayoutDashboard,
  PanelLeftClose,
  PanelLeftOpen,
  Pencil,
  Search,
  SquarePen,
  Trash2,
  X,
} from "lucide-react";
import type { ChatSummary } from "../lib/chat";
import { groupChatsByDate } from "../lib/chat";
import { BrandMark, Wordmark } from "./brand";
import { Avatar } from "./ui";

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
}

type Icon = ComponentType<{ className?: string }>;

export default function Sidebar(p: SidebarProps) {
  const location = useLocation();
  const onNewChat = location.pathname === "/app";
  const groups = groupChatsByDate(p.chats);
  const name = p.user.displayName || p.user.email.split("@")[0];

  return (
    <>
      {p.mobileOpen && (
        <div className="backdrop-in fixed inset-0 z-30 bg-black/40 md:hidden" onClick={p.onMobileClose} />
      )}
      <aside
        className={`sidebar-rail fixed inset-y-0 left-0 z-40 flex w-[240px] flex-col border-r border-edge bg-surface transition-[transform,width] duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] md:static md:translate-x-0 ${
          p.collapsed ? "md:w-[56px]" : "md:w-[228px]"
        } ${p.mobileOpen ? "translate-x-0" : "-translate-x-full"}`}
      >
        <div className={`flex h-12 shrink-0 items-center ${p.collapsed ? "justify-center px-2" : "justify-between pl-3.5 pr-2"}`}>
          <Link to="/app" className="flex items-center" title="Ohshi" onClick={p.onMobileClose}>
            {p.collapsed ? <BrandMark className="h-6" /> : <Wordmark className="h-6" />}
          </Link>
          {!p.collapsed && (
            <>
              <button
                type="button"
                onClick={p.onToggleCollapsed}
                className="hidden rounded-md p-1.5 text-ink-faint transition-colors hover:bg-ink/[0.06] hover:text-ink md:inline-flex"
                aria-label="Collapse sidebar"
              >
                <PanelLeftClose className="h-4 w-4" />
              </button>
              <button
                type="button"
                onClick={p.onMobileClose}
                className="rounded-md p-1.5 text-ink-dim hover:bg-ink/[0.06] md:hidden"
                aria-label="Close menu"
              >
                <X className="h-4 w-4" />
              </button>
            </>
          )}
        </div>
        {p.collapsed && (
          <button
            type="button"
            onClick={p.onToggleCollapsed}
            className="mx-auto mb-1 hidden rounded-md p-1.5 text-ink-faint transition-colors hover:bg-ink/[0.06] hover:text-ink md:inline-flex"
            aria-label="Expand sidebar"
          >
            <PanelLeftOpen className="h-4 w-4" />
          </button>
        )}

        <nav className="space-y-0.5 px-2">
          <SideLink icon={SquarePen} label="New chat" to="/app" active={onNewChat} collapsed={p.collapsed} onClick={p.onMobileClose} />
          <SideButton icon={Search} label="Search" hint="Ctrl K" collapsed={p.collapsed} onClick={p.onSearch} />
        </nav>

        <div className="mt-4 space-y-0.5 px-2">
          {!p.collapsed && <SectionLabel>Workspace</SectionLabel>}
          <SideLink icon={LayoutDashboard} label="Dashboard" to="/app/accounts" collapsed={p.collapsed} onClick={p.onMobileClose} />
          <SideLink icon={KeyRound} label="API keys" to="/app/keys" collapsed={p.collapsed} onClick={p.onMobileClose} />
          <SideLink icon={BookOpen} label="Docs" to="/app/docs" collapsed={p.collapsed} onClick={p.onMobileClose} />
        </div>

        <div
          className={`mt-4 min-h-0 flex-1 overflow-y-auto px-2 pb-2 transition-opacity duration-200 ${
            p.collapsed ? "pointer-events-none opacity-0" : "opacity-100"
          }`}
          aria-hidden={p.collapsed}
        >
          <SectionLabel>History</SectionLabel>
          {groups.length === 0 ? (
            <p className="px-2.5 py-1.5 text-[12px] text-ink-faint">Your chats will show up here.</p>
          ) : (
            groups.map((g) => (
              <div key={g.label} className="mb-2.5">
                <p className="px-2.5 pb-1 pt-1 text-[11px] font-medium text-ink-faint">{g.label}</p>
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

        <div className={`border-t border-edge p-2 ${p.collapsed ? "flex justify-center" : ""}`}>
          <Link
            to="/app/profile"
            title="Account settings"
            aria-label="Account settings"
            onClick={p.onMobileClose}
            className={`flex items-center gap-2.5 rounded-lg transition-colors hover:bg-ink/[0.05] ${
              p.collapsed ? "p-1" : "px-2 py-1.5"
            }`}
          >
            <Avatar name={name} size="sm" />
            {!p.collapsed && (
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[12.5px] font-semibold leading-tight">{name}</span>
                <span className="block truncate text-[11.5px] leading-tight text-ink-dim">{p.user.email}</span>
              </span>
            )}
          </Link>
        </div>
      </aside>
    </>
  );
}

function SectionLabel(props: { children: string }) {
  return <p className="px-2.5 pb-1 text-[11px] font-medium text-ink-faint">{props.children}</p>;
}

const itemBase = "flex w-full items-center gap-2.5 rounded-md px-2.5 py-[6px] text-[13px] font-medium transition-colors";

function SideButton(props: { icon: Icon; label: string; hint?: string; collapsed: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={props.onClick}
      title={props.label}
      className={`${itemBase} text-ink-dim hover:bg-ink/[0.05] hover:text-ink ${props.collapsed ? "justify-center px-0" : ""}`}
    >
      <props.icon className="h-4 w-4 shrink-0" />
      <span className={`sidebar-label text-left ${props.collapsed ? "sidebar-label-hidden" : "flex-1"}`}>{props.label}</span>
      {props.hint && (
        <kbd className={`sidebar-label kbd ${props.collapsed ? "sidebar-label-hidden" : ""}`}>{props.hint}</kbd>
      )}
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
      end={props.to === "/app"}
      onClick={props.onClick}
      title={props.label}
      className={({ isActive }) => {
        const active = props.active ?? isActive;
        return `${itemBase} ${active ? "bg-ink/[0.07] text-ink" : "text-ink-dim hover:bg-ink/[0.05] hover:text-ink"} ${
          props.collapsed ? "justify-center px-0" : ""
        }`;
      }}
    >
      <props.icon className="h-4 w-4 shrink-0" />
      <span className={`sidebar-label ${props.collapsed ? "sidebar-label-hidden" : ""}`}>{props.label}</span>
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
        className="w-full rounded-md border border-accent bg-panel px-2 py-1 text-[13px] outline-none"
      />
    );
  }

  return (
    <div className={`group flex items-center rounded-md pr-1 ${props.active ? "bg-ink/[0.07]" : "hover:bg-ink/[0.05]"}`}>
      <Link
        to={`/app/c/${props.chat.id}`}
        onClick={props.onNavigate}
        className={`min-w-0 flex-1 truncate px-2.5 py-[5px] text-[13px] transition-colors ${
          props.active ? "text-ink" : "text-ink-dim group-hover:text-ink"
        }`}
        title={props.chat.title || "New chat"}
      >
        {props.chat.title || "New chat"}
      </Link>
      <div className="flex shrink-0 items-center opacity-0 transition-opacity focus-within:opacity-100 group-hover:opacity-100">
        <button
          type="button"
          onClick={() => {
            setTitle(props.chat.title);
            setEditing(true);
          }}
          className="rounded p-1 text-ink-dim hover:bg-ink/10 hover:text-ink"
          aria-label="Rename chat"
        >
          <Pencil className="h-3 w-3" />
        </button>
        <button
          type="button"
          onClick={() => {
            if (window.confirm(`Delete "${props.chat.title || "New chat"}"?`)) void props.onDelete();
          }}
          className="rounded p-1 text-ink-dim hover:bg-danger-soft hover:text-danger"
          aria-label="Delete chat"
        >
          <Trash2 className="h-3 w-3" />
        </button>
      </div>
    </div>
  );
}
