/**
 * The chat screen. "/app" is a fresh chat (lock-up + composer in the middle);
 * "/app/c/:chatId" is a conversation. Replies stream over SSE from
 * POST /api/chats/:id/messages (see ohshi/chat/service.py for the events).
 */

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
} from "react";
import { Link, useLocation, useNavigate, useParams } from "react-router-dom";
import { ArrowRight, ArrowUp, Check, ChevronDown, ChevronRight, Copy, Plug, RefreshCw, Square } from "lucide-react";
import { useChatList } from "../App";
import { BrandHero, BrandMark } from "../components/brand";
import { GeminiLogo } from "../components/logos";
import Markdown from "../components/Markdown";
import ModelPicker from "../components/ModelPicker";
import { Topbar } from "../components/Topbar";
import { Button, Notice, Spinner } from "../components/ui";
import { copyText, friendly, get, post, readSSE, streamPost } from "../lib/api";
import {
  allVariantIds,
  loadStoredModel,
  modelLabel,
  routeLabel,
  storeModel,
  type ChatEvent,
  type ChatMessage,
  type ChatModelsPayload,
  type ChatSummary,
} from "../lib/chat";

interface StreamState {
  content: string;
  reasoning: string;
}

interface PendingState {
  pending?: string;
}

function tempMessage(role: "user" | "assistant", content: string, extra: Partial<ChatMessage> = {}): ChatMessage {
  return {
    id: -Date.now() - Math.floor(Math.random() * 1000),
    role,
    content,
    reasoning: null,
    model: "",
    endpoint: "",
    status: "complete",
    usage: { promptTokens: 0, completionTokens: 0, totalTokens: 0 },
    latencyMs: 0,
    createdMs: Date.now(),
    ...extra,
  };
}

export default function Chat() {
  const { chatId } = useParams<{ chatId: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const { upsert } = useChatList();

  const [models, setModels] = useState<ChatModelsPayload | null>(null);
  const [model, setModel] = useState<string>(loadStoredModel);
  const [chat, setChat] = useState<ChatSummary | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loading, setLoading] = useState<boolean>(Boolean(chatId));
  const [loadError, setLoadError] = useState<string | null>(null);
  const [stream, setStream] = useState<StreamState | null>(null);
  const [turnError, setTurnError] = useState<string | null>(null);
  const [input, setInput] = useState("");

  const abortRef = useRef<AbortController | null>(null);
  const bufRef = useRef<{ content: string; reasoning: string; timer: number | null }>({
    content: "",
    reasoning: "",
    timer: null,
  });
  const scrollRef = useRef<HTMLDivElement>(null);
  const stickRef = useRef(true);
  const pendingKeyRef = useRef<string | null>(null);
  const modelRef = useRef(model);
  modelRef.current = model;

  // --- models ---------------------------------------------------------------
  const loadModels = useCallback(async (force = false) => {
    try {
      setModels(await get<ChatModelsPayload>(`/api/chat/models${force ? "?force=1" : ""}`));
    } catch {
      /* keep whatever we had */
    }
  }, []);

  useEffect(() => {
    void loadModels();
  }, [loadModels]);

  // Keep the selection valid against the live list.
  useEffect(() => {
    if (!models) return;
    const ids = allVariantIds(models);
    if (!ids.has(model)) setModel(models.default);
  }, [models, model]);

  const chooseModel = (id: string) => {
    setModel(id);
    storeModel(id);
  };

  // --- load a chat ------------------------------------------------------------
  useEffect(() => {
    abortRef.current?.abort();
    abortRef.current = null;
    bufRef.current = { content: "", reasoning: "", timer: null };
    setStream(null);
    setTurnError(null);
    setInput("");
    stickRef.current = true;
    if (!chatId) {
      setChat(null);
      setMessages([]);
      setLoading(false);
      setLoadError(null);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setLoadError(null);
    get<{ chat: ChatSummary; messages: ChatMessage[] }>(`/api/chats/${chatId}`)
      .then((d) => {
        if (cancelled) return;
        setChat(d.chat);
        setMessages(d.messages);
        if (d.chat.model) setModel(d.chat.model);
      })
      .catch((e) => {
        if (!cancelled) setLoadError(friendly(e, "That chat couldn't be loaded."));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [chatId]);

  // --- streaming ---------------------------------------------------------------
  const flush = useCallback(() => {
    const buf = bufRef.current;
    if (buf.timer !== null) {
      window.clearTimeout(buf.timer);
      buf.timer = null;
    }
    setStream({ content: buf.content, reasoning: buf.reasoning });
  }, []);

  const scheduleFlush = useCallback(() => {
    const buf = bufRef.current;
    if (buf.timer === null) buf.timer = window.setTimeout(flush, 40);
  }, [flush]);

  const runTurn = useCallback(
    async (opts: { content?: string }) => {
      if (!chatId || abortRef.current) return;
      const controller = new AbortController();
      abortRef.current = controller;
      const chosenModel = modelRef.current;
      setTurnError(null);
      bufRef.current = { content: "", reasoning: "", timer: null };
      stickRef.current = true;
      if (opts.content !== undefined) {
        const optimistic = tempMessage("user", opts.content);
        setMessages((m) => [...m, optimistic]);
      } else {
        setMessages((m) => {
          const copy = [...m];
          while (copy.length && copy[copy.length - 1].role === "assistant") copy.pop();
          return copy;
        });
      }
      setStream({ content: "", reasoning: "" });

      const finishWithPartial = (status: ChatMessage["status"]) => {
        const buf = bufRef.current;
        if (buf.timer !== null) {
          window.clearTimeout(buf.timer);
          buf.timer = null;
        }
        if (buf.content || buf.reasoning) {
          setMessages((m) => [
            ...m,
            tempMessage("assistant", buf.content, {
              reasoning: buf.reasoning || null,
              model: chosenModel,
              status,
            }),
          ]);
        }
        setStream(null);
      };

      try {
        const resp =
          opts.content !== undefined
            ? await streamPost(`/api/chats/${chatId}/messages`, { content: opts.content, model: chosenModel }, controller.signal)
            : await streamPost(`/api/chats/${chatId}/regenerate`, { model: chosenModel }, controller.signal);
        await readSSE(resp, (raw) => {
          const ev = raw as unknown as ChatEvent;
          switch (ev.type) {
            case "user":
              setMessages((m) => [...m.filter((x) => x.id > 0), ev.message]);
              setChat(ev.chat);
              upsert(ev.chat);
              break;
            case "delta":
              bufRef.current.content += ev.content;
              scheduleFlush();
              break;
            case "reasoning":
              bufRef.current.reasoning += ev.content;
              scheduleFlush();
              break;
            case "done":
              if (bufRef.current.timer !== null) {
                window.clearTimeout(bufRef.current.timer);
                bufRef.current.timer = null;
              }
              setMessages((m) => [...m, ev.message]);
              setChat(ev.chat);
              upsert(ev.chat);
              setStream(null);
              break;
            case "error":
              finishWithPartial("interrupted");
              setTurnError(ev.message);
              break;
          }
        });
        // Stream ended without a terminal event (proxy cut it) — keep what arrived.
        if (bufRef.current.timer !== null || stream !== null) finishWithPartial("interrupted");
      } catch (e) {
        if (controller.signal.aborted) {
          finishWithPartial("interrupted");
        } else {
          finishWithPartial("interrupted");
          setTurnError(friendly(e, "Couldn't reach the server. Please try again."));
        }
      } finally {
        abortRef.current = null;
        setStream(null);
      }
    },
    // `stream` is intentionally not a dependency: it is only read defensively after the loop.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [chatId, upsert, scheduleFlush],
  );

  const runTurnRef = useRef(runTurn);
  runTurnRef.current = runTurn;

  // A message typed on "/app" arrives here as navigation state once the chat exists.
  useEffect(() => {
    const pending = (location.state as PendingState | null)?.pending;
    if (!chatId || !pending || loading) return;
    const key = `${chatId}:${pending}`;
    if (pendingKeyRef.current === key) return;
    pendingKeyRef.current = key;
    navigate(location.pathname, { replace: true, state: null });
    void runTurnRef.current({ content: pending });
  }, [chatId, loading, location.state, location.pathname, navigate]);

  const send = async () => {
    const text = input.trim();
    if (!text || abortRef.current) return;
    setInput("");
    if (!chatId) {
      try {
        const created = await post<{ chat: ChatSummary }>("/api/chats", { model: modelRef.current });
        upsert(created.chat);
        navigate(`/app/c/${created.chat.id}`, { state: { pending: text } satisfies PendingState });
      } catch (e) {
        setInput(text);
        setTurnError(friendly(e, "Couldn't start a chat. Please try again."));
      }
      return;
    }
    void runTurn({ content: text });
  };

  const stop = () => abortRef.current?.abort();
  const regenerate = () => void runTurn({});

  // --- scrolling ------------------------------------------------------------------
  useLayoutEffect(() => {
    const el = scrollRef.current;
    if (el && stickRef.current) el.scrollTop = el.scrollHeight;
  }, [messages, stream]);

  const onScroll = () => {
    const el = scrollRef.current;
    if (!el) return;
    stickRef.current = el.scrollHeight - el.scrollTop - el.clientHeight < 80;
  };

  const busy = stream !== null;
  const canRegenerate = useMemo(
    () => !busy && messages.length > 0 && messages[messages.length - 1].role !== "assistant",
    [busy, messages],
  );
  const lastAssistantId = useMemo(() => {
    for (let i = messages.length - 1; i >= 0; i--) if (messages[i].role === "assistant") return messages[i].id;
    return null;
  }, [messages]);
  const isLanding = !chatId;

  const composer = (
    <Composer
      value={input}
      onChange={setInput}
      onSend={() => void send()}
      onStop={stop}
      busy={busy}
      disabled={Boolean(loadError) || (models !== null && !models.connected)}
      models={models}
      model={model}
      onModelChange={chooseModel}
      onModelsRefresh={() => loadModels(true)}
      autoFocus
    />
  );

  return (
    <div className="relative flex h-full min-h-0 flex-col">
      <Topbar
        title={isLanding ? "New chat" : chat?.title || (loading ? "…" : "New chat")}
        actions={<RouteBar models={models} onRouteChange={() => void loadModels(true)} />}
      />

      {isLanding ? (
        /* Empty state: the lock-up and the composer sit together in the middle
           of the page. The moment a conversation starts the lock-up goes and the
           composer drops to the bottom of the screen. */
        <div className="flex min-h-0 flex-1 flex-col items-center justify-center overflow-y-auto px-4 py-8">
          <div className="rise-in flex w-full max-w-[720px] flex-col items-center">
            <BrandHero />
            <p className="mt-3 text-[13px] text-ink-dim">Ask anything. Replies run on your own key or plan.</p>
            {models && !models.connected && (
              <div className="mt-6 w-full max-w-lg">
                <Notice tone="warn">
                  Add a Gemini API key or connect a Google account first. Every reply runs on your own key or plan.{" "}
                  <Link to="/app/accounts" className="inline-flex items-center gap-1 font-medium underline underline-offset-2">
                    Open the dashboard <ArrowRight className="h-3.5 w-3.5" />
                  </Link>
                </Notice>
              </div>
            )}
            {turnError && (
              <div className="mt-4 w-full max-w-lg">
                <Notice tone="danger" onClose={() => setTurnError(null)}>
                  {turnError}
                </Notice>
              </div>
            )}
            <div className="mt-6 w-full">{composer}</div>
            <p className="mt-2.5 text-center text-[11px] text-ink-faint">Ohshi can make mistakes. Check important information.</p>
          </div>
        </div>
      ) : (
        <>
          <div ref={scrollRef} onScroll={onScroll} className="min-h-0 flex-1 overflow-y-auto">
            <div className="mx-auto w-full max-w-[760px] space-y-6 px-4 pb-6 pt-6 md:px-6">
              {loading && (
                <div className="flex justify-center py-10 text-ink-dim">
                  <Spinner />
                </div>
              )}
              {loadError && (
                <Notice tone="danger">
                  {loadError}{" "}
                  <Link to="/app" className="font-medium underline underline-offset-2">
                    Start a new chat
                  </Link>
                </Notice>
              )}
              {messages.map((m) =>
                m.role === "user" ? (
                  <UserBubble key={m.id} message={m} />
                ) : (
                  <AssistantMessage
                    key={m.id}
                    message={m}
                    models={models}
                    onRegenerate={m.id === lastAssistantId && !busy ? regenerate : undefined}
                  />
                ),
              )}
              {stream && <AssistantMessage streaming={stream} models={models} modelId={model} />}
              {turnError && !busy && (
                <div className="flex items-center justify-between gap-3 rounded-lg bg-danger-soft px-3.5 py-2.5 text-[13px] text-danger">
                  <span>{turnError}</span>
                  <div className="flex shrink-0 items-center gap-2">
                    {canRegenerate && (
                      <Button size="sm" tone="ghost" onClick={regenerate}>
                        <RefreshCw className="h-3.5 w-3.5" /> Retry
                      </Button>
                    )}
                    <button type="button" className="text-[12px] font-medium" onClick={() => setTurnError(null)}>
                      Dismiss
                    </button>
                  </div>
                </div>
              )}
              {!loading && !stream && !turnError && canRegenerate && (
                <div className="flex justify-start">
                  <Button size="sm" tone="ghost" onClick={regenerate}>
                    <RefreshCw className="h-3.5 w-3.5" /> No reply yet, generate one
                  </Button>
                </div>
              )}
            </div>
          </div>
          <div className="px-4 pb-3 pt-1 md:px-6">
            <div className="mx-auto w-full max-w-[760px]">
              {composer}
              <p className="mt-2 text-center text-[11px] text-ink-faint">Ohshi can make mistakes. Check important information.</p>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

// --- composer -----------------------------------------------------------------------

function Composer(props: {
  value: string;
  onChange: (v: string) => void;
  onSend: () => void;
  onStop: () => void;
  busy: boolean;
  disabled: boolean;
  models: ChatModelsPayload | null;
  model: string;
  onModelChange: (id: string) => void;
  onModelsRefresh: () => Promise<void>;
  autoFocus?: boolean;
}) {
  const ref = useRef<HTMLTextAreaElement>(null);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = "0px";
    el.style.height = `${Math.min(el.scrollHeight, 200)}px`;
  }, [props.value]);

  const onKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault();
      if (!props.busy) props.onSend();
    }
  };

  const canSend = props.value.trim().length > 0 && !props.disabled;

  return (
    <div className="composer rounded-2xl px-3 pb-2 pt-2.5">
      <textarea
        ref={ref}
        value={props.value}
        onChange={(e) => props.onChange(e.target.value)}
        onKeyDown={onKeyDown}
        placeholder={props.disabled ? "Add a Gemini API key or connect Google to start chatting" : "Ask anything…"}
        rows={1}
        autoFocus={props.autoFocus}
        disabled={props.disabled}
        className="max-h-[200px] min-h-[24px] w-full resize-none bg-transparent px-1 text-[14px] leading-6 outline-none placeholder:text-ink-faint disabled:cursor-not-allowed"
      />
      <div className="mt-1.5 flex items-center justify-between gap-2">
        <ModelPicker
          models={props.models}
          value={props.model}
          onChange={props.onModelChange}
          onRefresh={props.onModelsRefresh}
          disabled={props.busy}
        />
        {props.busy ? (
          <button
            type="button"
            onClick={props.onStop}
            className="flex h-8 w-8 items-center justify-center rounded-lg bg-night text-night-ink transition-opacity hover:opacity-85"
            aria-label="Stop generating"
          >
            <Square className="h-3.5 w-3.5 fill-current" />
          </button>
        ) : (
          <button
            type="button"
            onClick={props.onSend}
            disabled={!canSend}
            className="flex h-8 w-8 items-center justify-center rounded-lg bg-night text-night-ink transition-opacity hover:opacity-85 disabled:cursor-not-allowed disabled:opacity-25"
            aria-label="Send"
          >
            <ArrowUp className="h-4 w-4" />
          </button>
        )}
      </div>
    </div>
  );
}

// --- messages ------------------------------------------------------------------------

function UserBubble(props: { message: ChatMessage }) {
  return (
    <div className="flex justify-end">
      <div className="max-w-[80%] whitespace-pre-wrap break-words rounded-2xl bg-bubble-me px-3.5 py-2 text-[14px] leading-6 text-ink">
        {props.message.content}
      </div>
    </div>
  );
}

function AssistantMessage(props: {
  message?: ChatMessage;
  streaming?: StreamState;
  models: ChatModelsPayload | null;
  modelId?: string;
  onRegenerate?: () => void;
}) {
  const content = props.streaming ? props.streaming.content : (props.message?.content ?? "");
  const reasoning = props.streaming ? props.streaming.reasoning : (props.message?.reasoning ?? "");
  const streaming = Boolean(props.streaming);
  const [copied, setCopied] = useState(false);
  const [showReasoning, setShowReasoning] = useState(false);
  const modelId = props.message?.model || props.modelId || "";

  return (
    <div className="flex gap-3">
      <BrandMark className="mt-1 h-5 shrink-0" />
      <div className="min-w-0 flex-1">
        {reasoning && (
          <div className="mb-2">
            <button
              type="button"
              onClick={() => setShowReasoning((v) => !v)}
              className="inline-flex items-center gap-1 text-[12px] font-medium text-ink-dim hover:text-ink"
            >
              {showReasoning ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
              {streaming && !content ? "Thinking…" : "Thought process"}
            </button>
            {showReasoning && (
              <div className="mt-1.5 whitespace-pre-wrap border-l-2 border-edge pl-3 text-[13px] leading-relaxed text-ink-dim">
                {reasoning}
              </div>
            )}
          </div>
        )}
        {content ? (
          <div className={streaming ? "cursor-blink" : ""}>
            <Markdown text={content} />
          </div>
        ) : streaming && !reasoning ? (
          <div className="flex items-center gap-2 py-1 text-[13px] text-ink-dim">
            <span className="thinking-dots" aria-hidden />
            Thinking…
          </div>
        ) : null}
        {!streaming && props.message && (
          <div className="mt-2 flex flex-wrap items-center gap-1 text-[11.5px] text-ink-dim">
            <button
              type="button"
              onClick={() => {
                void copyText(content).then((ok) => {
                  setCopied(ok);
                  window.setTimeout(() => setCopied(false), 1500);
                });
              }}
              className="inline-flex items-center gap-1 rounded-md px-1.5 py-1 transition-colors hover:bg-ink/[0.06] hover:text-ink"
              aria-label="Copy reply"
            >
              {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
              {copied ? "Copied" : "Copy"}
            </button>
            {props.onRegenerate && (
              <button
                type="button"
                onClick={props.onRegenerate}
                className="inline-flex items-center gap-1 rounded-md px-1.5 py-1 transition-colors hover:bg-ink/[0.06] hover:text-ink"
              >
                <RefreshCw className="h-3.5 w-3.5" /> Regenerate
              </button>
            )}
            {modelId && <span className="px-1.5 text-ink-faint">{modelLabel(props.models, modelId)}</span>}
            {props.message.status === "interrupted" && (
              <span className="rounded bg-warn-soft px-1.5 py-0.5 font-medium text-warn">Stopped early</span>
            )}
            {props.message.usage.totalTokens > 0 && (
              <span className="px-1 text-ink-faint">{props.message.usage.totalTokens} tokens</span>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

interface AccountRow {
  id: string;
  email: string;
  isDefault: boolean;
  status: "active" | "needs_reconnect" | "revoked";
}

interface KeyRow {
  id: string;
  label: string;
  prefix: string;
  isDefault: boolean;
  status: "active" | "invalid";
}

/** Compact route control: which Gemini API key or Google account replies come
 *  from. Click it to see every source and move the default. */
function RouteBar(props: { models: ChatModelsPayload | null; onRouteChange?: () => void }) {
  const m = props.models;
  const [open, setOpen] = useState(false);
  const [accounts, setAccounts] = useState<AccountRow[] | null>(null);
  const [keys, setKeys] = useState<KeyRow[] | null>(null);
  const [switchingId, setSwitchingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: globalThis.KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const load = useCallback(() => {
    get<{ connections: AccountRow[] }>("/api/google/connections")
      .then((d) => setAccounts(d.connections))
      .catch((e) => setError(friendly(e)));
    get<{ keys: KeyRow[] }>("/api/gemini/keys")
      .then((d) => setKeys(d.keys))
      .catch((e) => setError(friendly(e)));
  }, []);

  const toggle = () => {
    setOpen((v) => {
      if (!v) {
        setError(null);
        load();
      }
      return !v;
    });
  };

  const choose = (path: string, id: string) => {
    if (switchingId) return;
    setSwitchingId(id);
    setError(null);
    post(path)
      .then(() => {
        load();
        props.onRouteChange?.();
      })
      .catch((e) => setError(friendly(e)))
      .finally(() => setSwitchingId(null));
  };

  if (!m) return null;
  if (!m.connected) {
    return (
      <Link
        to="/app/accounts"
        className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-night px-3 text-[12.5px] font-medium text-night-ink hover:opacity-90"
      >
        <Plug className="h-3.5 w-3.5" /> Add a key or account
      </Link>
    );
  }

  const gemini = m.route === "gemini_api";
  const isCurrent = (kind: "gemini_api" | "code_assist", id: string) => m.route === kind && m.connectionId === id;

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={toggle}
        className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-edge bg-panel px-2.5 text-[12.5px] font-medium text-ink transition-colors hover:border-edge-strong"
        title={routeLabel(m)}
        aria-haspopup="listbox"
        aria-expanded={open}
      >
        <span className={`h-1.5 w-1.5 rounded-full ${gemini || m.quotaAvailable ? "bg-ok" : "bg-warn"}`} />
        {gemini ? <GeminiLogo className="h-3.5 w-3.5 text-ink-dim" /> : <Plug className="h-3.5 w-3.5 text-ink-dim" />}
        <span className="hidden max-w-[11rem] truncate sm:inline">{gemini ? "Gemini API" : m.email}</span>
        {m.beta && <span className="rounded bg-violet-soft px-1 py-px text-[10px] font-medium text-violet">Beta</span>}
        <ChevronDown className={`h-3.5 w-3.5 text-ink-dim transition-transform duration-200 ${open ? "rotate-180" : ""}`} />
      </button>

      {open && (
        <div
          className="pop-in absolute right-0 top-full z-30 mt-2 w-[21rem] max-w-[calc(100vw-2rem)] overflow-hidden rounded-xl border border-edge bg-panel shadow-[0_16px_40px_-16px_rgb(0_0_0/0.35)]"
          role="listbox"
        >
          <p className="border-b border-edge px-3 py-2 text-[11.5px] font-medium text-ink-dim">Gemini API keys</p>
          <div className="max-h-40 overflow-y-auto p-1.5">
            {keys === null ? (
              <div className="flex justify-center py-4 text-ink-dim">
                <Spinner size={14} />
              </div>
            ) : keys.length === 0 ? (
              <p className="px-2 py-1.5 text-[12px] text-ink-dim">No keys yet. Add one on the dashboard.</p>
            ) : (
              keys.map((row) => (
                <SourceRow
                  key={row.id}
                  label={row.label || row.prefix}
                  sub={row.label ? row.prefix : ""}
                  ok={row.status === "active"}
                  current={isCurrent("gemini_api", row.id)}
                  switching={switchingId === row.id}
                  disabled={row.status !== "active" || switchingId !== null}
                  onPick={() => choose(`/api/gemini/keys/${row.id}/default`, row.id)}
                />
              ))
            )}
          </div>
          <p className="flex items-center gap-2 border-y border-edge px-3 py-2 text-[11.5px] font-medium text-ink-dim">
            Google accounts
            <span className="rounded bg-violet-soft px-1 py-px text-[10px] text-violet">Beta</span>
          </p>
          <div className="max-h-40 overflow-y-auto p-1.5">
            {accounts === null ? (
              <div className="flex justify-center py-4 text-ink-dim">
                <Spinner size={14} />
              </div>
            ) : accounts.length === 0 ? (
              <p className="px-2 py-1.5 text-[12px] text-ink-dim">No Google account connected.</p>
            ) : (
              accounts.map((row) => (
                <SourceRow
                  key={row.id}
                  label={row.email}
                  sub=""
                  ok={row.status === "active"}
                  current={isCurrent("code_assist", row.id)}
                  switching={switchingId === row.id}
                  disabled={row.status !== "active" || switchingId !== null}
                  onPick={() => choose(`/api/google/connections/${row.id}/default`, row.id)}
                />
              ))
            )}
          </div>
          {error && <p className="border-t border-edge px-3 py-2 text-[11.5px] text-danger">{error}</p>}
          <Link
            to="/app/accounts"
            onClick={() => setOpen(false)}
            className="flex items-center gap-2 border-t border-edge px-3 py-2 text-[12.5px] font-medium text-ink-dim hover:text-ink"
          >
            <Plug className="h-3.5 w-3.5" /> Manage sources
          </Link>
        </div>
      )}
    </div>
  );
}

function SourceRow(props: {
  label: string;
  sub: string;
  ok: boolean;
  current: boolean;
  switching: boolean;
  disabled: boolean;
  onPick: () => void;
}) {
  return (
    <button
      type="button"
      disabled={props.current || props.disabled}
      onClick={props.onPick}
      className={`flex w-full items-center gap-2.5 rounded-md px-2 py-1.5 text-left text-[12.5px] ${
        props.current ? "bg-ink/[0.06]" : "hover:bg-ink/[0.04] disabled:opacity-60"
      }`}
    >
      <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${props.ok ? "bg-ok" : "bg-danger"}`} />
      <span className="min-w-0 flex-1 truncate font-medium text-ink">
        {props.label}
        {props.sub && <span className="mono ml-1.5 text-[11px] font-normal text-ink-dim">{props.sub}</span>}
      </span>
      {props.switching ? (
        <Spinner size={12} />
      ) : props.current ? (
        <span className="shrink-0 text-[11px] font-medium text-ink-dim">Default</span>
      ) : null}
    </button>
  );
}
