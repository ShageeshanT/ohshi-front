/** Ctrl+K: search chat titles and messages, or jump to any page. */

import { useEffect, useMemo, useRef, useState, type ComponentType } from "react";
import { useNavigate } from "react-router-dom";
import {
  Activity,
  BookOpen,
  CornerDownLeft,
  CreditCard,
  KeyRound,
  Layers,
  LayoutDashboard,
  MessageSquare,
  Network,
  Plug,
  Search,
  Settings,
  SquarePen,
} from "lucide-react";
import { useChatList } from "../App";
import type { ChatSummary } from "../lib/chat";
import { get, timeAgo } from "../lib/api";
import { Spinner } from "./ui";

interface Result {
  chat: ChatSummary;
  snippet: string;
}

interface PageHit {
  to: string;
  label: string;
  hint: string;
  icon: ComponentType<{ className?: string }>;
}

const PAGES: PageHit[] = [
  { to: "/app", label: "New chat", hint: "Start a conversation", icon: SquarePen },
  { to: "/app/dashboard", label: "Overview", hint: "How the workspace is doing", icon: LayoutDashboard },
  { to: "/app/models", label: "Models", hint: "Quota per model", icon: Layers },
  { to: "/app/usage", label: "Usage", hint: "The gateway ledger", icon: Activity },
  { to: "/app/connections", label: "Connections", hint: "Providers, live and coming", icon: Network },
  { to: "/app/accounts", label: "Google access", hint: "Gemini keys, Google accounts, connector", icon: Plug },
  { to: "/app/keys", label: "API keys", hint: "Keys for /v1", icon: KeyRound },
  { to: "/app/billing", label: "Plan and billing", hint: "Your plan", icon: CreditCard },
  { to: "/app/docs", label: "Docs", hint: "Request snippets", icon: BookOpen },
  { to: "/app/profile", label: "Account settings", hint: "Profile, password, theme", icon: Settings },
];

export default function SearchDialog(props: { open: boolean; onClose: () => void }) {
  const navigate = useNavigate();
  const { chats } = useChatList();
  const [q, setQ] = useState("");
  const [results, setResults] = useState<Result[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [cursor, setCursor] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!props.open) return;
    setQ("");
    setResults(null);
    setCursor(0);
    const t = window.setTimeout(() => inputRef.current?.focus(), 20);
    return () => window.clearTimeout(t);
  }, [props.open]);

  useEffect(() => {
    if (!props.open) return;
    const needle = q.trim();
    if (!needle) {
      setResults(null);
      return;
    }
    setBusy(true);
    const controller = new AbortController();
    const t = window.setTimeout(() => {
      get<{ results: Result[] }>(`/api/chats/search?q=${encodeURIComponent(needle)}`, controller.signal)
        .then((d) => setResults(d.results))
        .catch(() => {
          /* aborted or failed — keep the previous list */
        })
        .finally(() => setBusy(false));
    }, 180);
    return () => {
      window.clearTimeout(t);
      controller.abort();
    };
  }, [q, props.open]);

  const needle = q.trim().toLowerCase();
  const pages = useMemo(
    () => (needle ? PAGES.filter((p) => `${p.label} ${p.hint}`.toLowerCase().includes(needle)) : PAGES.slice(0, 5)),
    [needle],
  );
  const rows: Result[] = results ?? (needle ? [] : chats.slice(0, 6).map((chat) => ({ chat, snippet: "" })));
  const total = pages.length + rows.length;

  useEffect(() => {
    setCursor(0);
  }, [q, results]);

  if (!props.open) return null;

  const go = (index: number) => {
    if (index < pages.length) {
      props.onClose();
      navigate(pages[index].to);
      return;
    }
    const row = rows[index - pages.length];
    if (!row) return;
    props.onClose();
    navigate(`/app/c/${row.chat.id}`);
  };

  const itemCls = (active: boolean) =>
    `flex w-full items-center gap-2.5 rounded-md px-2.5 py-2 text-left ${active ? "bg-ink/[0.06]" : "hover:bg-ink/[0.04]"}`;

  return (
    <div
      className="backdrop-in fixed inset-0 z-50 flex items-start justify-center bg-black/40 p-4 pt-[10vh] sm:pt-[12vh]"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) props.onClose();
      }}
    >
      <div className="modal-in w-full max-w-lg overflow-hidden rounded-xl border border-edge bg-panel shadow-[0_24px_60px_-24px_rgb(0_0_0/0.45)]">
        <div className="flex items-center gap-2.5 border-b border-edge px-3.5 py-2.5">
          <Search className="h-4 w-4 text-ink-dim" />
          <input
            ref={inputRef}
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Escape") props.onClose();
              else if (e.key === "ArrowDown") {
                e.preventDefault();
                setCursor((c) => Math.min(total - 1, c + 1));
              } else if (e.key === "ArrowUp") {
                e.preventDefault();
                setCursor((c) => Math.max(0, c - 1));
              } else if (e.key === "Enter") go(cursor);
            }}
            placeholder="Search chats, or jump to a page…"
            className="flex-1 bg-transparent text-[13.5px] outline-none placeholder:text-ink-faint"
          />
          {busy && <Spinner size={13} className="text-ink-dim" />}
          <kbd className="kbd hidden md:inline-flex">Esc</kbd>
        </div>
        <div className="max-h-[55vh] overflow-y-auto p-1.5">
          {pages.length > 0 && (
            <>
              <p className="px-2.5 pb-1 pt-1.5 text-[11px] font-medium text-ink-faint">Pages</p>
              {pages.map((p, i) => (
                <button key={p.to} type="button" onClick={() => go(i)} onMouseEnter={() => setCursor(i)} className={itemCls(cursor === i)}>
                  <p.icon className="h-3.5 w-3.5 shrink-0 text-ink-dim" />
                  <span className="min-w-0 flex-1 truncate text-[13px] font-medium">{p.label}</span>
                  <span className="truncate text-[12px] text-ink-dim">{p.hint}</span>
                </button>
              ))}
            </>
          )}
          <p className="px-2.5 pb-1 pt-2 text-[11px] font-medium text-ink-faint">{needle ? "Chats" : "Recent chats"}</p>
          {rows.length === 0 ? (
            <p className="px-2.5 py-3 text-[13px] text-ink-dim">{needle ? (busy ? "Searching…" : "No chat matches.") : "No chats yet."}</p>
          ) : (
            rows.map((r, i) => {
              const index = pages.length + i;
              return (
                <button
                  key={r.chat.id}
                  type="button"
                  onClick={() => go(index)}
                  onMouseEnter={() => setCursor(index)}
                  className={`${itemCls(cursor === index)} items-start`}
                >
                  <MessageSquare className="mt-0.5 h-3.5 w-3.5 shrink-0 text-ink-dim" />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[13px] font-medium">{r.chat.title || "New chat"}</span>
                    <span className="block truncate text-[12px] text-ink-dim">
                      {r.snippet || `${r.chat.messageCount} messages, ${timeAgo(r.chat.updatedMs)}`}
                    </span>
                  </span>
                </button>
              );
            })
          )}
        </div>
        <p className="flex items-center gap-3 border-t border-edge px-3.5 py-2 text-[11px] text-ink-faint">
          <span className="inline-flex items-center gap-1">
            <kbd className="kbd">↑↓</kbd> move
          </span>
          <span className="inline-flex items-center gap-1">
            <kbd className="kbd">
              <CornerDownLeft className="h-2.5 w-2.5" />
            </kbd>{" "}
            open
          </span>
        </p>
      </div>
    </div>
  );
}
