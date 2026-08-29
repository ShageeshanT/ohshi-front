/**
 * The chat screen. "/" is a fresh chat (big brand + pill composer, like Grok's
 * landing); "/c/:chatId" is a conversation. Replies stream over SSE from
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
import { ArrowUp, Check, ChevronDown, ChevronRight, Copy, Plug, RefreshCw, Square } from "lucide-react";
import { useChatList } from "../App";
import { BrandHero, BrandMark } from "../components/brand";
import Markdown from "../components/Markdown";
import ModelPicker from "../components/ModelPicker";
import { Button, Notice, Spinner } from "../components/ui";
import { copyText, friendly, get, post, readSSE, streamPost } from "../lib/api";
import {
  allVariantIds,
  loadStoredModel,
  modelLabel,
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
          setTurnError(friendly(e, "Couldn't reach the server — please try again."));
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

  // A message typed on "/" arrives here as navigation state once the chat exists.
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
        navigate(`/c/${created.chat.id}`, { state: { pending: text } satisfies PendingState });
      } catch (e) {
        setInput(text);
        setTurnError(friendly(e, "Couldn't start a chat — please try again."));
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
    <div className="relative flex h-full flex-col">
      {!isLanding && (
        <div className="pointer-events-none absolute left-5 top-4 z-10 hidden max-w-[45%] md:block">
          <p className="truncate text-sm font-medium text-ink-dim" title={chat?.title || undefined}>
            {chat?.title || (loading ? "" : "New chat")}
          </p>
        </div>
      )}
      <div className="absolute right-4 top-3 z-10 hidden md:block">
        <AccountChip models={models} />
      </div>

      {isLanding ? (
        <div className="flex flex-1 flex-col items-center justify-center px-4 pb-16">
          <div className="rise-in flex w-full max-w-3xl flex-col items-center">
            <BrandHero />
            <div className="mt-9 w-full">{composer}</div>
            {models && !models.connected && (
              <div className="mt-6 w-full">
                <Notice tone="warn">
                  <span className="normal-case">
                    Connect a Google account first — every reply runs on your own Google plan.{" "}
                    <Link to="/accounts" className="font-semibold underline underline-offset-2">
                      Google accounts →
                    </Link>
                  </span>
                </Notice>
              </div>
            )}
            {turnError && (
              <div className="mt-4 w-full">
                <Notice tone="danger" onClose={() => setTurnError(null)}>
                  {turnError}
                </Notice>
              </div>
            )}
          </div>
        </div>
      ) : (
        <>
          <div ref={scrollRef} onScroll={onScroll} className="min-h-0 flex-1 overflow-y-auto">
            <div className="mx-auto w-full max-w-3xl space-y-7 px-4 pb-6 pt-14 md:pt-16">
              {loading && (
                <div className="flex justify-center py-10 text-ink-dim">
                  <Spinner />
                </div>
              )}
              {loadError && (
                <Notice tone="danger">
                  {loadError}{" "}
                  <Link to="/" className="font-semibold underline underline-offset-2">
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
                <div className="flex items-center justify-between gap-3 rounded-xl bg-danger-soft px-4 py-3 text-sm text-danger">
                  <span>{turnError}</span>
                  <div className="flex shrink-0 gap-2">
                    {canRegenerate && (
                      <Button size="sm" tone="ghost" onClick={regenerate}>
                        <RefreshCw className="h-3.5 w-3.5" /> Retry
                      </Button>
                    )}
                    <button type="button" className="text-xs font-semibold" onClick={() => setTurnError(null)}>
                      Dismiss
                    </button>
                  </div>
                </div>
              )}
              {!loading && !stream && !turnError && canRegenerate && (
                <div className="flex justify-start">
                  <Button size="sm" tone="ghost" onClick={regenerate}>
                    <RefreshCw className="h-3.5 w-3.5" /> No reply yet — generate one
                  </Button>
                </div>
              )}
            </div>
          </div>
          <div className="px-4 pb-4 pt-2">
            <div className="mx-auto w-full max-w-3xl">
              {composer}
              <p className="mt-2 text-center text-[11px] text-ink-dim">
                Ohshi can make mistakes. Replies run on {models?.email ?? "your Google account"}.
              </p>
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
    el.style.height = `${Math.min(el.scrollHeight, 220)}px`;
  }, [props.value]);

  const onKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault();
      if (!props.busy) props.onSend();
    }
  };

  const canSend = props.value.trim().length > 0 && !props.disabled;
  const multiline = props.value.includes("\n") || props.value.length > 90;

  return (
    <div className={`chat-pill flex items-end gap-2 bg-panel py-2 pl-5 pr-2 ${multiline ? "rounded-3xl" : "rounded-full"}`}>
      <textarea
        ref={ref}
        value={props.value}
        onChange={(e) => props.onChange(e.target.value)}
        onKeyDown={onKeyDown}
        placeholder={props.disabled ? "Connect a Google account to start chatting" : "What do you want to know?"}
        rows={1}
        autoFocus={props.autoFocus}
        disabled={props.disabled}
        className="my-1.5 max-h-[220px] min-h-[28px] flex-1 resize-none bg-transparent text-[16px] leading-7 outline-none placeholder:text-ink-dim/70 disabled:cursor-not-allowed"
      />
      <div className="flex shrink-0 items-center gap-1 pb-0.5">
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
            className="flex h-11 w-11 items-center justify-center rounded-full bg-night text-white transition-transform hover:scale-105 active:scale-95"
            aria-label="Stop generating"
          >
            <Square className="h-4 w-4 fill-current" />
          </button>
        ) : (
          <button
            type="button"
            onClick={props.onSend}
            disabled={!canSend}
            className="flex h-11 w-11 items-center justify-center rounded-full bg-night text-white transition-transform hover:scale-105 active:scale-95 disabled:cursor-not-allowed disabled:opacity-30 disabled:hover:scale-100"
            aria-label="Send"
          >
            <ArrowUp className="h-5 w-5" />
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
      <div className="max-w-[85%] whitespace-pre-wrap break-words rounded-3xl bg-panel-2 px-5 py-3 text-[15px] leading-7">
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
    <div className="flex gap-3.5">
      <BrandMark className="mt-1 h-7 w-7 rounded-lg" />
      <div className="min-w-0 flex-1">
        {reasoning && (
          <div className="mb-2">
            <button
              type="button"
              onClick={() => setShowReasoning((v) => !v)}
              className="inline-flex items-center gap-1 text-xs font-semibold text-ink-dim hover:text-ink"
            >
              {showReasoning ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
              {streaming && !content ? "Thinking…" : "Thought process"}
            </button>
            {showReasoning && (
              <div className="mt-1.5 whitespace-pre-wrap border-l-2 border-edge pl-3 text-sm text-ink-dim">
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
          <div className="flex items-center gap-2 py-1 text-sm text-ink-dim">
            <span className="thinking-dots" aria-hidden />
            Thinking…
          </div>
        ) : null}
        {!streaming && props.message && (
          <div className="mt-2 flex flex-wrap items-center gap-2 text-[11px] text-ink-dim">
            <button
              type="button"
              onClick={() => {
                void copyText(content).then((ok) => {
                  setCopied(ok);
                  window.setTimeout(() => setCopied(false), 1500);
                });
              }}
              className="inline-flex items-center gap-1 rounded-md px-1.5 py-1 hover:bg-panel-2 hover:text-ink"
              aria-label="Copy reply"
            >
              {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
              {copied ? "Copied" : "Copy"}
            </button>
            {props.onRegenerate && (
              <button
                type="button"
                onClick={props.onRegenerate}
                className="inline-flex items-center gap-1 rounded-md px-1.5 py-1 hover:bg-panel-2 hover:text-ink"
              >
                <RefreshCw className="h-3.5 w-3.5" /> Regenerate
              </button>
            )}
            {modelId && <span className="px-1">{modelLabel(props.models, modelId)}</span>}
            {props.message.status === "interrupted" && (
              <span className="rounded-full bg-warn-soft px-2 py-0.5 font-medium text-warn">Stopped early</span>
            )}
            {props.message.usage.totalTokens > 0 && <span className="px-1">{props.message.usage.totalTokens} tokens</span>}
          </div>
        )}
      </div>
    </div>
  );
}

function AccountChip(props: { models: ChatModelsPayload | null }) {
  const m = props.models;
  if (!m) return null;
  if (!m.connected) {
    return (
      <Link
        to="/accounts"
        className="inline-flex items-center gap-2 rounded-full bg-night px-3.5 py-1.5 text-sm font-semibold text-white shadow-sm hover:bg-black"
      >
        <Plug className="h-4 w-4" /> Connect Google
      </Link>
    );
  }
  return (
    <Link
      to="/accounts"
      className="inline-flex items-center gap-2 rounded-full border border-edge bg-panel px-3.5 py-1.5 text-sm font-medium text-ink-dim hover:text-ink"
      title="Google accounts & remaining usage"
    >
      <span className={`h-2 w-2 rounded-full ${m.quotaAvailable ? "bg-ok" : "bg-warn"}`} />
      <span className="max-w-[220px] truncate">{m.email}</span>
    </Link>
  );
}
