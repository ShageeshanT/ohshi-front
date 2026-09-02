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
    navigate(`/app/c/${id}`);
  };

  return (
    <div
      className="backdrop-in fixed inset-0 z-50 flex items-start justify-center bg-black/40 p-4 pt-[12vh]"
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
              if (e.key === "Enter" && rows[0]) open(rows[0].chat.id);
            }}
            placeholder="Search your chats…"
            className="flex-1 bg-transparent text-[13.5px] outline-none placeholder:text-ink-faint"
          />
          {busy && <Spinner size={13} className="text-ink-dim" />}
          <kbd className="kbd hidden md:inline-flex">Esc</kbd>
        </div>
        <ul className="max-h-[50vh] overflow-y-auto p-1.5">
          {rows.length === 0 ? (
            <li className="px-3 py-6 text-center text-[13px] text-ink-dim">
              {q.trim() ? "Nothing matches." : "No chats yet."}
            </li>
          ) : (
            rows.map((r) => (
              <li key={r.chat.id}>
                <button
                  type="button"
                  onClick={() => open(r.chat.id)}
                  className="flex w-full items-start gap-2.5 rounded-md px-2.5 py-2 text-left hover:bg-ink/[0.05]"
                >
                  <MessageSquare className="mt-0.5 h-3.5 w-3.5 shrink-0 text-ink-dim" />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[13px] font-medium">{r.chat.title || "New chat"}</span>
                    <span className="block truncate text-[12px] text-ink-dim">
                      {r.snippet || `${r.chat.messageCount} messages, ${timeAgo(r.chat.updatedMs)}`}
                    </span>
                  </span>
                </button>
              </li>
            ))
          )}
        </ul>
        {!q.trim() && rows.length > 0 && (
          <p className="border-t border-edge px-3.5 py-2 text-[11.5px] text-ink-dim">Recent chats. Type to search everything.</p>
        )}
      </div>
    </div>
  );
}
