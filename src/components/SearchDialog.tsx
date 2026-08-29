/** Ctrl+K search over chat titles and messages. */

import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { MessageSquare, Search } from "lucide-react";
import { useChatList } from "../App";
import type { ChatSummary } from "../lib/chat";
import { get, timeAgo } from "../lib/api";
import { Spinner } from "./ui";

interface Result {
  chat: ChatSummary;
  snippet: string;
}

export default function SearchDialog(props: { open: boolean; onClose: () => void }) {
  const navigate = useNavigate();
  const { chats } = useChatList();
  const [q, setQ] = useState("");
  const [results, setResults] = useState<Result[] | null>(null);
  const [busy, setBusy] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!props.open) return;
    setQ("");
    setResults(null);
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

  if (!props.open) return null;

  const rows: Result[] = results ?? chats.slice(0, 8).map((chat) => ({ chat, snippet: "" }));
  const open = (id: string) => {
    props.onClose();
    navigate(`/c/${id}`);
  };

  return (
    <div
      className="backdrop-in fixed inset-0 z-50 flex items-start justify-center bg-ink/40 p-4 pt-[12vh] backdrop-blur-[2px]"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) props.onClose();
      }}
    >
      <div className="modal-in w-full max-w-xl overflow-hidden rounded-3xl bg-panel shadow-2xl">
        <div className="flex items-center gap-3 border-b border-edge px-4 py-3">
          <Search className="h-4 w-4 text-ink-dim" />
          <input
            ref={inputRef}
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Escape") props.onClose();
              if (e.key === "Enter" && rows[0]) open(rows[0].chat.id);
            }}
            placeholder="Search your chats…"
            className="flex-1 bg-transparent text-sm outline-none placeholder:text-ink-dim/70"
          />
          {busy && <Spinner size={14} className="text-ink-dim" />}
          <kbd className="hidden rounded-md bg-panel-2 px-1.5 py-0.5 text-[10px] text-ink-dim md:inline">Esc</kbd>
        </div>
        <ul className="max-h-[50vh] overflow-y-auto p-2">
          {rows.length === 0 ? (
            <li className="px-3 py-6 text-center text-sm text-ink-dim">
              {q.trim() ? "Nothing matches." : "No chats yet."}
            </li>
          ) : (
            rows.map((r) => (
              <li key={r.chat.id}>
                <button
                  type="button"
                  onClick={() => open(r.chat.id)}
                  className="flex w-full items-start gap-3 rounded-xl px-3 py-2.5 text-left hover:bg-panel-2"
                >
                  <MessageSquare className="mt-0.5 h-4 w-4 shrink-0 text-ink-dim" />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium">{r.chat.title || "New chat"}</span>
                    <span className="block truncate text-xs text-ink-dim">
                      {r.snippet || `${r.chat.messageCount} messages · ${timeAgo(r.chat.updatedMs)}`}
                    </span>
                  </span>
                </button>
              </li>
            ))
          )}
        </ul>
        {!q.trim() && rows.length > 0 && (
          <p className="border-t border-edge px-4 py-2 text-[11px] text-ink-dim">Recent chats — type to search everything.</p>
        )}
      </div>
    </div>
  );
}
