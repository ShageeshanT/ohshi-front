/**
 * App sidebar: brand and collapse, New chat and Search, the workspace and
 * manage links, date-grouped chat history, and the account chip at the
 * bottom. Collapsed it is a 56px rail of centred icons with the expand
 * control above the account chip.
 */

import { useEffect, useRef, useState, type ComponentType } from "react";
import { Link, NavLink, useLocation } from "react-router-dom";
import {
  Activity,
  BookOpen,
  CreditCard,
  KeyRound,
  Layers,
  LayoutDashboard,
  Network,
  PanelLeftClose,
  PanelLeftOpen,
  Pencil,
  Plug,
  Rocket,
  Search,
  ShieldCheck,
  Sparkles,
  SquarePen,
  Trash2,
  X,
} from "lucide-react";
import type { ChatSummary } from "../lib/chat";
import { groupChatsByDate } from "../lib/chat";
import { searchHotkey } from "../lib/api";
import { BrandMark, Wordmark } from "./brand";
import UncensoredSwitch from "./UncensoredSwitch";
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
  /** The account's Ohshi plan, marked on the account chip. */
  plan?: string;
  /** Show the Admin link. */
  isAdmin?: boolean;
}

type Icon = ComponentType<{ className?: string }>;

const WORKSPACE: { to: string; icon: Icon; label: string }[] = [
  { to: "/app/dashboard", icon: LayoutDashboard, label: "Overview" },
  { to: "/app/models", icon: Layers, label: "Models" },
  { to: "/app/usage", icon: Activity, label: "Usage" },
];

const MANAGE: { to: string; icon: Icon; label: string }[] = [
  { to: "/app/connections", icon: Network, label: "Connections" },
  { to: "/app/accounts", icon: Plug, label: "Accounts" },
  { to: "/app/keys", icon: KeyRound, label: "API keys" },
  { to: "/app/billing", icon: CreditCard, label: "Plan and billing" },
  { to: "/app/docs", icon: BookOpen, label: "Docs" },
];

function useWideScreen() {
  const [wide, setWide] = useState(() =>
    typeof window === "undefined" ? true : window.matchMedia("(min-width: 768px)").matches,
  );
  useEffect(() => {
    const mq = window.matchMedia("(min-width: 768px)");
    const onChange = () => setWide(mq.matches);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);
  return wide;
}

export default function Sidebar(p: SidebarProps) {
  const location = useLocation();
  const onNewChat = location.pathname === "/app";
  const groups = groupChatsByDate(p.chats);
  const name = p.user.displayName || p.user.email.split("@")[0];
  const wide = useWideScreen();
  const c = p.collapsed && wide;
  const plan = (p.plan || "free").toLowerCase();
  const planName = PLAN_MARK[plan]?.label ?? "Free";

  return (
    <>
      {p.mobileOpen && <div className="backdrop-in fixed inset-0 z-30 bg-black/40 md:hidden" onClick={p.onMobileClose} />}
      <aside
        className={`sidebar-rail fixed inset-y-0 left-0 z-40 flex w-[240px] flex-col border-r border-edge bg-surface transition-[transform,width] duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] md:static md:translate-x-0 ${
          c ? "cursor-pointer md:w-[56px]" : "md:w-[236px]"
        } ${p.mobileOpen ? "translate-x-0" : "-translate-x-full"}`}
        title={c ? "Expand sidebar" : undefined}
        onClick={(e) => {
          // On the rail, a click on empty space expands; links and buttons keep their own job.
          if (!c) return;
          if ((e.target as HTMLElement).closest("a, button, input")) return;
          p.onToggleCollapsed();
        }}
      >
        {/* Brand row. */}
        <div className={`flex h-11 shrink-0 items-center ${c ? "justify-center" : "justify-between pl-3.5 pr-2"}`}>
          <Link to="/app" className="flex items-center" title="Ohshi" onClick={p.onMobileClose}>
            {c ? <BrandMark className="h-6" /> : <Wordmark className="h-6" />}
          </Link>
          {!c && (
            <button
              type="button"
              onClick={p.onMobileClose}
              className="inline-flex h-7 w-7 items-center justify-center rounded-md text-ink-dim hover:bg-ink/[0.06] md:hidden"
              aria-label="Close menu"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>

        <nav className={`space-y-0.5 ${c ? "px-2" : "px-2"}`}>
          <SideLink icon={SquarePen} label="New chat" to="/app" active={onNewChat} collapsed={c} onClick={p.onMobileClose} />
          <SideButton icon={Search} label="Search" hint={searchHotkey()} collapsed={c} onClick={p.onSearch} />
        </nav>

        <Divider collapsed={c} label="Workspace" />
        <nav className="space-y-0.5 px-2">
          {WORKSPACE.map((item) => (
            <SideLink key={item.to} icon={item.icon} label={item.label} to={item.to} collapsed={c} onClick={p.onMobileClose} />
          ))}
        </nav>

        <Divider collapsed={c} label="Manage" />
        <nav className="space-y-0.5 px-2">
          {MANAGE.map((item) => (
            <SideLink key={item.to} icon={item.icon} label={item.label} to={item.to} collapsed={c} onClick={p.onMobileClose} />
          ))}
        </nav>

        {p.isAdmin && (
          <>
            <Divider collapsed={c} label="Operator" />
            <nav className="space-y-0.5 px-2">
              <SideLink icon={ShieldCheck} label="Admin" to="/app/admin" collapsed={c} onClick={p.onMobileClose} />
              <UncensoredSwitch collapsed={c} />
            </nav>
          </>
        )}

        {/* History: hidden on the rail. */}
        <div
          className={`mt-3 min-h-0 flex-1 overflow-y-auto px-2 pb-2 transition-opacity duration-200 ${
            c ? "pointer-events-none opacity-0" : "opacity-100"
          }`}
          aria-hidden={c}
        >
          <p className="px-2.5 pb-1 text-[11px] font-medium text-ink-faint">History</p>
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

        {/* Bottom: the collapse/expand control, then the account chip. Same
            spot in both states so the hand knows where to go. */}
        <div className={`mt-auto border-t border-edge p-2 ${c ? "flex flex-col items-center gap-1" : "flex items-center gap-1"}`}>
          {c ? (
            <button
              type="button"
              onClick={p.onToggleCollapsed}
              className="hidden h-8 w-8 items-center justify-center rounded-md text-ink-faint transition-colors hover:bg-ink/[0.06] hover:text-ink md:inline-flex"
              aria-label="Expand sidebar"
              title="Expand sidebar"
            >
              <PanelLeftOpen className="h-4 w-4" />
            </button>
          ) : null}
          <Link
            to="/app/profile"
            title={`Account settings — ${planName} plan`}
            aria-label={`Account settings, ${planName} plan`}
            onClick={p.onMobileClose}
            className={`flex min-w-0 items-center gap-2 rounded-lg transition-colors hover:bg-ink/[0.05] ${c ? "p-1" : "flex-1 px-2 py-1.5"}`}
          >
            <span className="relative shrink-0">
              <Avatar name={name} size="sm" />
              {c && <PlanDot plan={plan} />}
            </span>
            {!c && (
              <>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[12.5px] font-semibold leading-tight">{name}</span>
                  <span className="block truncate text-[11.5px] leading-tight text-ink-dim">{p.user.email}</span>
                </span>
                <PlanChip plan={plan} />
              </>
            )}
          </Link>
          {!c && (
            <button
              type="button"
              onClick={p.onToggleCollapsed}
              className="hidden h-8 w-8 shrink-0 items-center justify-center rounded-md text-ink-faint transition-colors hover:bg-ink/[0.06] hover:text-ink md:inline-flex"
              aria-label="Collapse sidebar"
              title="Collapse sidebar"
            >
              <PanelLeftClose className="h-4 w-4" />
            </button>
          )}
        </div>
      </aside>
    </>
  );
}

/** Plus and Pro carry the same motif as their pricing cards: a sparkle and
 *  a rocket. Free is marked too — quietly — so the chip always answers
 *  "what am I on?" rather than only shouting when the answer is flattering. */
const PLAN_MARK: Record<string, { label: string; icon: Icon; chip: string; dot: string }> = {
  plus: { label: "Plus", icon: Sparkles, chip: "bg-accent-soft text-accent", dot: "bg-accent" },
  pro: { label: "Pro", icon: Rocket, chip: "bg-violet-soft text-violet", dot: "bg-violet" },
};

function PlanChip(props: { plan: string }) {
  const mark = PLAN_MARK[props.plan];
  if (!mark) {
    return (
      <span className="shrink-0 rounded-md bg-ink/[0.06] px-1.5 py-0.5 text-[10.5px] font-medium leading-none text-ink-dim">
        Free
      </span>
    );
  }
  const Icon = mark.icon;
  return (
    <span
      className={`inline-flex shrink-0 items-center gap-1 rounded-md px-1.5 py-0.5 text-[10.5px] font-semibold leading-none ${mark.chip}`}
    >
      <Icon className="h-3 w-3" />
      {mark.label}
    </span>
  );
}

/** On the 56px rail there is no room for a word: a paid plan becomes a dot
 *  on the avatar, named by the chip's tooltip. */
function PlanDot(props: { plan: string }) {
  const mark = PLAN_MARK[props.plan];
  if (!mark) return null;
  return (
    <span
      className={`absolute -bottom-px -right-px h-2 w-2 rounded-full ring-2 ring-surface ${mark.dot}`}
    />
  );
}

function Divider(props: { collapsed: boolean; label: string }) {
  if (props.collapsed) return <div className="mx-3 my-1.5 h-px bg-edge" />;
  return <p className="mt-2.5 px-4 pb-0.5 text-[11px] font-medium text-ink-faint">{props.label}</p>;
}

const itemBase = "flex items-center gap-2 rounded-md text-[13px] font-medium transition-colors";
const expanded = "w-full px-2.5 py-[5px]";
const rail = "mx-auto h-9 w-9 justify-center";

function SideButton(props: { icon: Icon; label: string; hint?: string; collapsed: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={props.onClick}
      title={props.label}
      className={`${itemBase} text-ink-dim hover:bg-ink/[0.05] hover:text-ink ${props.collapsed ? rail : expanded}`}
    >
      <props.icon className="h-4 w-4 shrink-0" />
      {!props.collapsed && (
        <>
          <span className="flex-1 text-left">{props.label}</span>
          {props.hint && <kbd className="kbd">{props.hint}</kbd>}
        </>
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
          props.collapsed ? rail : expanded
        }`;
      }}
    >
      <props.icon className="h-4 w-4 shrink-0" />
      {!props.collapsed && <span className="truncate">{props.label}</span>}
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
      <div className="flex shrink-0 items-center opacity-100 transition-opacity md:opacity-0 md:focus-within:opacity-100 md:group-hover:opacity-100">
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
