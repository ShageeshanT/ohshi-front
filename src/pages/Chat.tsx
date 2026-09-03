/**
 * The chat screen. "/app" is a fresh chat (lock-up, suggestions and the
 * composer in the middle); "/app/c/:chatId" is a conversation. Replies stream
 * over SSE from POST /api/chats/:id/messages (see ohshi/chat/service.py).
 *
 * Streaming: the server's chunks land in a buffer and the screen reveals them
 * a few characters at a time (faster the further it is behind), so a reply
 * flows instead of jumping. Files: uploaded to the chat the moment they are
 * added (or, on a fresh chat, right after the chat is created), then sent by
 * id with the message. Titles: after the first exchange the backend names the
 * chat with the model; the page polls for the new name briefly.
 */

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
  type ClipboardEvent,
  type DragEvent,
  type KeyboardEvent,
} from "react";
import { Link, useLocation, useNavigate, useParams } from "react-router-dom";
import {
  ArrowDown,
  ArrowRight,
  ArrowUp,
  Check,
  ChevronDown,
  ChevronRight,
  Code2,
  Copy,
  FileText,
  Image as ImageIcon,
  Loader2,
  Paperclip,
  PenLine,
  Plug,
  Presentation,
  RefreshCw,
  Sparkles,
  Square,
  X,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { useChatList } from "../App";
import { BrandHero, BrandMark } from "../components/brand";
import { DeepSeekLogo, GeminiLogo } from "../components/logos";
import Markdown from "../components/Markdown";
import ModelPicker from "../components/ModelPicker";
import { Topbar } from "../components/Topbar";
import { Button, LinkText, Notice, Spinner } from "../components/ui";
import { copyText, friendly, get, post, readSSE, streamPost, uploadFile } from "../lib/api";
import {
  ATTACHMENT_ACCEPT,
  ATTACHMENT_MAX_BYTES,
  allVariantIds,
  attachmentKind,
  formatBytes,
  isKeyRoute,
  loadStoredModel,
  modelLabel,
  routeLabel,
  storeModel,
  type Attachment,
  type ChatEvent,
  type ChatMessage,
  type ChatModelsPayload,
  type ChatSummary,
  type RouteKind,
} from "../lib/chat";

interface StreamState {
  content: string;
  reasoning: string;
}

interface PendingState {
  pending?: string;
  attachments?: string[];
}

/** A file in the composer: queued (no chat yet), uploading, ready to send, or refused. */
interface PendingFile {
  key: string;
  file: File;
  kind: Attachment["kind"];
  status: "queued" | "uploading" | "ready" | "error";
  id?: string;
  error?: string;
  preview?: string;
}

const SUGGESTIONS: { icon: LucideIcon; label: string; prompt?: string; attach?: boolean }[] = [
  {
    icon: Sparkles,
    label: "Explain something simply",
    prompt: "Explain how large language models work, in plain words, for someone new to the topic.",
  },
  {
    icon: PenLine,
    label: "Draft an email",
    prompt: "Draft a short, friendly email telling a client that the project timeline has moved by one week.",
  },
  { icon: FileText, label: "Summarise a file", attach: true },
  {
    icon: Code2,
    label: "Write some code",
    prompt: "Write a Python function that removes duplicate lines from a text file while keeping their first order.",
  },
];

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

const reduceMotion = () =>
  document.documentElement.getAttribute("data-reduce-motion") === "true" ||
  window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

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
  const [files, setFiles] = useState<PendingFile[]>([]);
  const [atBottom, setAtBottom] = useState(true);

  const abortRef = useRef<AbortController | null>(null);
  // The reply as received, how much of it is on screen, and the loop that closes the gap.
  const targetRef = useRef<StreamState>({ content: "", reasoning: "" });
  const shownRef = useRef({ content: 0, reasoning: 0 });
  const tickRef = useRef<number | null>(null);
  const finishRef = useRef<(() => void) | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const stickRef = useRef(true);
  const pendingKeyRef = useRef<string | null>(null);
  const modelRef = useRef(model);
  modelRef.current = model;
  const filesRef = useRef(files);
  filesRef.current = files;
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const titlePollRef = useRef<number[]>([]);

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
  const stopTick = useCallback(() => {
    if (tickRef.current !== null) {
      window.clearTimeout(tickRef.current);
      tickRef.current = null;
    }
  }, []);

  useEffect(() => {
    abortRef.current?.abort();
    abortRef.current = null;
    stopTick();
    targetRef.current = { content: "", reasoning: "" };
    shownRef.current = { content: 0, reasoning: 0 };
    finishRef.current = null;
    titlePollRef.current.forEach((t) => window.clearTimeout(t));
    titlePollRef.current = [];
    setStream(null);
    setTurnError(null);
    setInput("");
    setFiles([]);
    stickRef.current = true;
    setAtBottom(true);
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
  }, [chatId, stopTick]);

  // --- the reveal loop ------------------------------------------------------------
  // Runs every ~28ms while there is unseen text: a few characters when the
  // screen is nearly caught up, a bigger slice when it is far behind. When the
  // turn has ended and everything is on screen, the final message is committed.
  const tick = useCallback(() => {
    tickRef.current = null;
    const target = targetRef.current;
    const shown = shownRef.current;
    let changed = false;
    for (const key of ["reasoning", "content"] as const) {
      const backlog = target[key].length - shown[key];
      if (backlog > 0) {
        const step = finishRef.current ? Math.max(6, Math.ceil(backlog / 4)) : Math.max(2, Math.ceil(backlog / 12));
        shown[key] += Math.min(backlog, step);
        changed = true;
      }
    }
    if (changed) {
      setStream({ content: target.content.slice(0, shown.content), reasoning: target.reasoning.slice(0, shown.reasoning) });
    }
    const behind = target.content.length > shown.content || target.reasoning.length > shown.reasoning;
    if (behind) tickRef.current = window.setTimeout(tick, 28);
    else if (finishRef.current) {
      const finish = finishRef.current;
      finishRef.current = null;
      finish();
    }
  }, []);

  const nudge = useCallback(() => {
    if (tickRef.current === null) tickRef.current = window.setTimeout(tick, 0);
  }, [tick]);

  /** Put everything received on screen at once (errors, stop, reduced motion). */
  const showAll = useCallback(() => {
    stopTick();
    const target = targetRef.current;
    shownRef.current = { content: target.content.length, reasoning: target.reasoning.length };
    setStream({ content: target.content, reasoning: target.reasoning });
  }, [stopTick]);

  // --- title: the model names the chat after the first exchange -----------------------
  const pollTitle = useCallback(
    (id: string, current: string) => {
      titlePollRef.current.forEach((t) => window.clearTimeout(t));
      titlePollRef.current = [1200, 2800, 5200].map((ms) =>
        window.setTimeout(() => {
          get<{ chat: ChatSummary }>(`/api/chats/${id}`)
            .then((d) => {
              if (d.chat.title && d.chat.title !== current) {
                setChat((c) => (c && c.id === id ? { ...c, title: d.chat.title } : c));
                upsert(d.chat);
                titlePollRef.current.forEach((t) => window.clearTimeout(t));
                titlePollRef.current = [];
              }
            })
            .catch(() => {});
        }, ms),
      );
    },
    [upsert],
  );

  // --- one turn --------------------------------------------------------------------
  const runTurn = useCallback(
    async (opts: { content?: string; attachments?: string[] }) => {
      if (!chatId || abortRef.current) return;
      const controller = new AbortController();
      abortRef.current = controller;
      const chosenModel = modelRef.current;
      const instant = reduceMotion();
      setTurnError(null);
      stopTick();
      targetRef.current = { content: "", reasoning: "" };
      shownRef.current = { content: 0, reasoning: 0 };
      finishRef.current = null;
      stickRef.current = true;
      if (opts.content !== undefined) {
        const optimistic = tempMessage("user", opts.content, {
          attachments: filesRef.current
            .filter((f) => f.status === "ready" && f.id)
            .map((f) => ({ id: f.id!, name: f.file.name, mime: f.file.type, size: f.file.size, kind: f.kind, url: f.preview ?? "" })),
        });
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
        stopTick();
        finishRef.current = null;
        const target = targetRef.current;
        if (target.content || target.reasoning) {
          setMessages((m) => [
            ...m,
            tempMessage("assistant", target.content, { reasoning: target.reasoning || null, model: chosenModel, status }),
          ]);
        }
        setStream(null);
      };

      let settled = false;
      try {
        const body = { content: opts.content, model: chosenModel, attachments: opts.attachments ?? [] };
        const resp =
          opts.content !== undefined
            ? await streamPost(`/api/chats/${chatId}/messages`, body, controller.signal)
            : await streamPost(`/api/chats/${chatId}/regenerate`, { model: chosenModel }, controller.signal);
        await readSSE(resp, (raw) => {
          const ev = raw as unknown as ChatEvent;
          switch (ev.type) {
            case "user":
              // Only the optimistic user row goes; a partial reply kept from a stop stays.
              setMessages((m) => [...m.filter((x) => !(x.id < 0 && x.role === "user")), ev.message]);
              setChat(ev.chat);
              upsert(ev.chat);
              setFiles([]);
              break;
            case "delta":
              targetRef.current.content += ev.content;
              if (instant) showAll();
              else nudge();
              break;
            case "reasoning":
              targetRef.current.reasoning += ev.content;
              if (instant) showAll();
              else nudge();
              break;
            case "done": {
              settled = true;
              const commit = () => {
                setMessages((m) => [...m, ev.message]);
                setChat(ev.chat);
                upsert(ev.chat);
                setStream(null);
                if (ev.chat.messageCount === 2) pollTitle(ev.chat.id, ev.chat.title);
              };
              const target = targetRef.current;
              const shown = shownRef.current;
              if (instant || (target.content.length <= shown.content && target.reasoning.length <= shown.reasoning)) {
                stopTick();
                commit();
              } else {
                finishRef.current = commit;
                nudge();
              }
              break;
            }
            case "error":
              settled = true;
              finishWithPartial("interrupted");
              setTurnError(ev.message);
              break;
          }
        });
        if (!settled) finishWithPartial("interrupted");
      } catch (e) {
        if (controller.signal.aborted) {
          finishWithPartial("interrupted");
        } else {
          finishWithPartial("interrupted");
          setTurnError(friendly(e, "Couldn't reach the server. Please try again."));
        }
      } finally {
        abortRef.current = null;
        if (!finishRef.current) setStream((s) => (s && !settled ? null : s));
      }
    },
    [chatId, upsert, nudge, showAll, stopTick, pollTitle],
  );

  const runTurnRef = useRef(runTurn);
  runTurnRef.current = runTurn;

  // A message typed on "/app" arrives here as navigation state once the chat exists.
  useEffect(() => {
    const state = location.state as PendingState | null;
    const pending = state?.pending;
    if (!chatId || pending === undefined || loading) return;
    const key = `${chatId}:${pending}:${(state?.attachments ?? []).join(",")}`;
    if (pendingKeyRef.current === key) return;
    pendingKeyRef.current = key;
    navigate(location.pathname, { replace: true, state: null });
    void runTurnRef.current({ content: pending, attachments: state?.attachments ?? [] });
  }, [chatId, loading, location.state, location.pathname, navigate]);

  // --- files ------------------------------------------------------------------------
  const uploadOne = useCallback(async (targetChat: string, key: string, file: File): Promise<string | null> => {
    setFiles((list) => list.map((f) => (f.key === key ? { ...f, status: "uploading" } : f)));
    try {
      const { attachment } = await uploadFile<{ attachment: Attachment }>(`/api/chats/${targetChat}/attachments`, file);
      setFiles((list) => list.map((f) => (f.key === key ? { ...f, status: "ready", id: attachment.id } : f)));
      return attachment.id;
    } catch (e) {
      setFiles((list) => list.map((f) => (f.key === key ? { ...f, status: "error", error: friendly(e) } : f)));
      return null;
    }
  }, []);

  const addFiles = useCallback(
    (incoming: File[]) => {
      const room = Math.max(0, 4 - filesRef.current.length);
      const picked = incoming.slice(0, room);
      if (picked.length === 0) {
        setTurnError("Up to four files per message.");
        return;
      }
      const next: PendingFile[] = picked.map((file) => {
        const kind = attachmentKind(file);
        const key = `${file.name}-${file.size}-${Date.now()}-${Math.random()}`;
        const preview = kind === "image" ? URL.createObjectURL(file) : undefined;
        if (!kind) {
          return { key, file, kind: "text", status: "error", error: "Not supported. Images, PDFs, text and Office files work." };
        }
        if (file.size > ATTACHMENT_MAX_BYTES) {
          return { key, file, kind, status: "error", error: `Over ${formatBytes(ATTACHMENT_MAX_BYTES)}.`, preview };
        }
        return { key, file, kind, status: chatId ? "uploading" : "queued", preview };
      });
      setFiles((list) => [...list, ...next]);
      if (chatId) {
        for (const f of next) if (f.status === "uploading") void uploadOne(chatId, f.key, f.file);
      }
    },
    [chatId, uploadOne],
  );

  const removeFile = (key: string) => {
    setFiles((list) => {
      const gone = list.find((f) => f.key === key);
      if (gone?.preview) URL.revokeObjectURL(gone.preview);
      return list.filter((f) => f.key !== key);
    });
  };

  const uploading = files.some((f) => f.status === "uploading");
  const blocked = files.some((f) => f.status === "error");

  const send = async () => {
    const text = input.trim();
    const current = filesRef.current;
    const usable = current.filter((f) => f.status !== "error");
    if ((!text && usable.length === 0) || abortRef.current || uploading || blocked) return;
    setInput("");
    if (!chatId) {
      try {
        const created = await post<{ chat: ChatSummary }>("/api/chats", { model: modelRef.current });
        upsert(created.chat);
        const ids: string[] = [];
        let failed = false;
        for (const f of usable) {
          const id = await uploadOne(created.chat.id, f.key, f.file);
          if (id) ids.push(id);
          else failed = true;
        }
        if (failed) {
          // Keep the text and the files (the failed chip says why); drop the empty chat.
          setInput(text);
          setTurnError("A file could not be uploaded. Remove it or try again, then send.");
          void post(`/api/chats/${created.chat.id}/delete`).catch(() => {});
          return;
        }
        navigate(`/app/c/${created.chat.id}`, { state: { pending: text, attachments: ids } satisfies PendingState });
      } catch (e) {
        setInput(text);
        setTurnError(friendly(e, "Couldn't start a chat. Please try again."));
      }
      return;
    }
    const ids = usable.map((f) => f.id).filter((id): id is string => Boolean(id));
    void runTurn({ content: text, attachments: ids });
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
    const near = el.scrollHeight - el.scrollTop - el.clientHeight < 80;
    stickRef.current = near;
    setAtBottom(near);
  };

  const jumpToBottom = () => {
    const el = scrollRef.current;
    if (!el) return;
    stickRef.current = true;
    el.scrollTo({ top: el.scrollHeight, behavior: reduceMotion() ? "auto" : "smooth" });
    setAtBottom(true);
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

  const useSuggestion = (s: (typeof SUGGESTIONS)[number]) => {
    if (s.attach) {
      fileInputRef.current?.click();
      return;
    }
    setInput(s.prompt ?? "");
    window.setTimeout(() => textareaRef.current?.focus(), 0);
  };

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
      files={files}
      onAddFiles={addFiles}
      onRemoveFile={removeFile}
      uploading={uploading}
      blocked={blocked}
      textareaRef={textareaRef}
      fileInputRef={fileInputRef}
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
        <div className="flex min-h-0 flex-1 flex-col items-center justify-center overflow-y-auto px-4 py-8">
          <div className="rise-in flex w-full max-w-[720px] flex-col items-center">
            <BrandHero />
            <p className="mt-3 text-center text-[13px] text-ink-dim">Ask anything, or drop a file in. Replies run on your own key or plan.</p>
            {models && !models.connected && (
              <div className="mt-6 w-full max-w-lg">
                <Notice tone="warn">
                  Add a Gemini or DeepSeek API key, or connect a Google account first. Every reply runs on your own key or plan.{" "}
                  <Link to="/app/accounts" className="inline-flex items-center gap-1 font-medium underline underline-offset-2">
                    Model access <ArrowRight className="h-3.5 w-3.5" />
                  </Link>
                </Notice>
              </div>
            )}
            {turnError && (
              <div className="mt-4 w-full max-w-lg">
                <Notice tone="danger" onClose={() => setTurnError(null)}>
                  <LinkText text={turnError} />
                </Notice>
              </div>
            )}
            <div className="mt-6 w-full">{composer}</div>
            <div className="mt-4 flex flex-wrap justify-center gap-1.5">
              {SUGGESTIONS.map((s) => (
                <button
                  key={s.label}
                  type="button"
                  onClick={() => useSuggestion(s)}
                  className="inline-flex items-center gap-1.5 rounded-full border border-edge bg-panel px-3 py-1.5 text-[12.5px] text-ink-dim transition-colors hover:border-edge-strong hover:text-ink"
                >
                  <s.icon className="h-3.5 w-3.5" /> {s.label}
                </button>
              ))}
            </div>
            <p className="mt-4 text-center text-[11px] text-ink-faint">Ohshi can make mistakes. Check important information.</p>
          </div>
        </div>
      ) : (
        <>
          <div className="relative min-h-0 flex-1">
            <div ref={scrollRef} onScroll={onScroll} className="h-full overflow-y-auto">
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
                  <div className="msg-in flex items-center justify-between gap-3 rounded-lg bg-danger-soft px-3.5 py-2.5 text-[13px] text-danger">
                    <span>
                      <LinkText text={turnError} />
                    </span>
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
            {!atBottom && (
              <button
                type="button"
                onClick={jumpToBottom}
                className="pop-in absolute bottom-3 left-1/2 inline-flex h-8 -translate-x-1/2 items-center gap-1.5 rounded-full border border-edge bg-panel px-3 text-[12px] font-medium text-ink shadow-[0_6px_20px_-8px_rgb(0_0_0/0.35)] hover:border-edge-strong"
                aria-label="Jump to the latest message"
              >
                <ArrowDown className="h-3.5 w-3.5" /> Latest
              </button>
            )}
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
  files: PendingFile[];
  onAddFiles: (files: File[]) => void;
  onRemoveFile: (key: string) => void;
  uploading: boolean;
  blocked: boolean;
  textareaRef: React.RefObject<HTMLTextAreaElement | null>;
  fileInputRef: React.RefObject<HTMLInputElement | null>;
  autoFocus?: boolean;
}) {
  const [dragging, setDragging] = useState(false);
  const dragDepth = useRef(0);

  useLayoutEffect(() => {
    const el = props.textareaRef.current;
    if (!el) return;
    el.style.height = "0px";
    el.style.height = `${Math.min(el.scrollHeight, 200)}px`;
  }, [props.value, props.textareaRef]);

  const onKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault();
      if (!props.busy) props.onSend();
    }
  };

  const onPaste = (e: ClipboardEvent<HTMLTextAreaElement>) => {
    const items = Array.from(e.clipboardData?.files ?? []);
    if (items.length === 0) return;
    e.preventDefault();
    props.onAddFiles(items);
  };

  const onDragEnter = (e: DragEvent) => {
    if (!e.dataTransfer?.types.includes("Files")) return;
    e.preventDefault();
    dragDepth.current += 1;
    setDragging(true);
  };
  const onDragLeave = () => {
    dragDepth.current = Math.max(0, dragDepth.current - 1);
    if (dragDepth.current === 0) setDragging(false);
  };
  const onDrop = (e: DragEvent) => {
    e.preventDefault();
    dragDepth.current = 0;
    setDragging(false);
    const dropped = Array.from(e.dataTransfer?.files ?? []);
    if (dropped.length) props.onAddFiles(dropped);
  };
  const onPick = (e: ChangeEvent<HTMLInputElement>) => {
    const picked = Array.from(e.target.files ?? []);
    if (picked.length) props.onAddFiles(picked);
    e.target.value = "";
  };

  const hasFiles = props.files.some((f) => f.status !== "error");
  const canSend = (props.value.trim().length > 0 || hasFiles) && !props.disabled && !props.uploading && !props.blocked;

  return (
    <div
      className={`composer relative rounded-2xl px-3 pb-2 pt-2.5 ${dragging ? "composer-drag" : ""}`}
      onDragEnter={onDragEnter}
      onDragOver={(e) => {
        if (e.dataTransfer?.types.includes("Files")) e.preventDefault();
      }}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
    >
      {dragging && (
        <div className="pointer-events-none absolute inset-0 z-10 grid place-items-center rounded-2xl border-2 border-dashed border-accent bg-panel/90 text-[13px] font-medium text-accent">
          Drop to attach
        </div>
      )}
      {props.files.length > 0 && (
        <div className="mb-2 flex flex-wrap gap-1.5 px-1">
          {props.files.map((f) => (
            <FileChip key={f.key} file={f} onRemove={() => props.onRemoveFile(f.key)} />
          ))}
        </div>
      )}
      <textarea
        ref={props.textareaRef}
        value={props.value}
        onChange={(e) => props.onChange(e.target.value)}
        onKeyDown={onKeyDown}
        onPaste={onPaste}
        placeholder={props.disabled ? "Add an API key or connect Google to start chatting" : "Ask anything…"}
        rows={1}
        autoFocus={props.autoFocus}
        disabled={props.disabled}
        className="max-h-[200px] min-h-[24px] w-full resize-none bg-transparent px-1 text-[14px] leading-6 outline-none placeholder:text-ink-faint disabled:cursor-not-allowed"
      />
      <div className="mt-1.5 flex items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-0.5">
          <input ref={props.fileInputRef} type="file" multiple accept={ATTACHMENT_ACCEPT} className="hidden" onChange={onPick} />
          <button
            type="button"
            onClick={() => props.fileInputRef.current?.click()}
            disabled={props.disabled || props.busy}
            className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-ink-dim transition-colors hover:bg-ink/[0.06] hover:text-ink disabled:opacity-40"
            aria-label="Attach a file"
            title="Attach images, PDFs, text or Office files (up to 10 MB each)"
          >
            <Paperclip className="h-4 w-4" />
          </button>
          <ModelPicker
            models={props.models}
            value={props.model}
            onChange={props.onModelChange}
            onRefresh={props.onModelsRefresh}
            disabled={props.busy}
          />
        </div>
        {props.busy ? (
          <button
            type="button"
            onClick={props.onStop}
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-night text-night-ink transition-opacity hover:opacity-85"
            aria-label="Stop generating"
          >
            <Square className="h-3.5 w-3.5 fill-current" />
          </button>
        ) : (
          <button
            type="button"
            onClick={props.onSend}
            disabled={!canSend}
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-night text-night-ink transition-opacity hover:opacity-85 disabled:cursor-not-allowed disabled:opacity-25"
            aria-label="Send"
            title={props.uploading ? "Waiting for the upload" : "Send (Enter)"}
          >
            {props.uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowUp className="h-4 w-4" />}
          </button>
        )}
      </div>
    </div>
  );
}

const KIND_ICON: Record<Attachment["kind"], LucideIcon> = {
  image: ImageIcon,
  pdf: FileText,
  text: FileText,
  office: Presentation,
};

function FileChip(props: { file: PendingFile; onRemove: () => void }) {
  const f = props.file;
  const Icon = KIND_ICON[f.kind];
  const tone = f.status === "error" ? "border-danger/40 bg-danger-soft text-danger" : "border-edge bg-panel";
  return (
    <span className={`pop-in inline-flex max-w-[16rem] items-center gap-1.5 rounded-lg border py-1 pl-1.5 pr-1 text-[12px] ${tone}`} title={f.error ?? f.file.name}>
      {f.preview ? (
        <img src={f.preview} alt="" className="h-6 w-6 rounded object-cover" />
      ) : (
        <Icon className="h-3.5 w-3.5 shrink-0 text-ink-dim" />
      )}
      <span className="min-w-0 truncate">
        <span className="font-medium">{f.file.name}</span>
        <span className="ml-1 text-ink-dim">{f.error ? f.error : formatBytes(f.file.size)}</span>
      </span>
      {f.status === "uploading" ? (
        <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin text-ink-dim" />
      ) : (
        <button
          type="button"
          onClick={props.onRemove}
          className="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded text-ink-dim hover:bg-ink/10 hover:text-ink"
          aria-label={`Remove ${f.file.name}`}
        >
          <X className="h-3 w-3" />
        </button>
      )}
    </span>
  );
}

// --- messages ------------------------------------------------------------------------

function AttachmentList(props: { items: Attachment[] }) {
  const images = props.items.filter((a) => a.kind === "image" && a.url);
  const others = props.items.filter((a) => !(a.kind === "image" && a.url));
  return (
    <div className="mb-1.5 flex flex-wrap justify-end gap-1.5">
      {images.map((a) => (
        <a key={a.id} href={a.url} target="_blank" rel="noreferrer" className="block overflow-hidden rounded-lg border border-edge">
          <img src={a.url} alt={a.name} loading="lazy" className="h-28 max-w-[12rem] object-cover" />
        </a>
      ))}
      {others.map((a) => {
        const Icon = KIND_ICON[a.kind] ?? FileText;
        return (
          <a
            key={a.id}
            href={a.url || undefined}
            target="_blank"
            rel="noreferrer"
            className="inline-flex max-w-[16rem] items-center gap-1.5 rounded-lg border border-edge bg-panel px-2 py-1 text-[12px] hover:border-edge-strong"
          >
            <Icon className="h-3.5 w-3.5 shrink-0 text-ink-dim" />
            <span className="truncate font-medium">{a.name}</span>
            <span className="shrink-0 text-ink-dim">{formatBytes(a.size)}</span>
          </a>
        );
      })}
    </div>
  );
}

function UserBubble(props: { message: ChatMessage }) {
  const attachments = props.message.attachments ?? [];
  return (
    <div className="msg-in flex flex-col items-end">
      {attachments.length > 0 && <AttachmentList items={attachments} />}
      {props.message.content && (
        <div className="max-w-[80%] whitespace-pre-wrap break-words rounded-2xl bg-bubble-me px-3.5 py-2 text-[14px] leading-6 text-ink">
          {props.message.content}
        </div>
      )}
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
    <div className="msg-in flex gap-3">
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

/** Compact route control: which Gemini key, DeepSeek key or Google account
 *  replies come from. Click it to see every source and move the default. */
function RouteBar(props: { models: ChatModelsPayload | null; onRouteChange?: () => void }) {
  const m = props.models;
  const [open, setOpen] = useState(false);
  const [accounts, setAccounts] = useState<AccountRow[] | null>(null);
  const [keys, setKeys] = useState<KeyRow[] | null>(null);
  const [deepseekKeys, setDeepSeekKeys] = useState<KeyRow[] | null>(null);
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
    get<{ keys: KeyRow[] }>("/api/deepseek/keys")
      .then((d) => setDeepSeekKeys(d.keys))
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

  const keyRoute = isKeyRoute(m.route);
  const RouteLogo = m.route === "gemini_api" ? GeminiLogo : m.route === "deepseek_api" ? DeepSeekLogo : Plug;
  const routeName = m.route === "gemini_api" ? "Gemini API" : m.route === "deepseek_api" ? "DeepSeek API" : m.email;
  const isCurrent = (kind: RouteKind, id: string) => m.route === kind && m.connectionId === id;

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
        <span className={`h-1.5 w-1.5 rounded-full ${keyRoute || m.quotaAvailable ? "bg-ok" : "bg-warn"}`} />
        <RouteLogo className="h-3.5 w-3.5 text-ink-dim" />
        <span className="hidden max-w-[11rem] truncate sm:inline">{routeName}</span>
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
              <p className="px-2 py-1.5 text-[12px] text-ink-dim">No keys yet. Add one on the Model access page.</p>
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
          <p className="border-y border-edge px-3 py-2 text-[11.5px] font-medium text-ink-dim">DeepSeek API keys</p>
          <div className="max-h-40 overflow-y-auto p-1.5">
            {deepseekKeys === null ? (
              <div className="flex justify-center py-4 text-ink-dim">
                <Spinner size={14} />
              </div>
            ) : deepseekKeys.length === 0 ? (
              <p className="px-2 py-1.5 text-[12px] text-ink-dim">No keys yet. Add one on the Model access page.</p>
            ) : (
              deepseekKeys.map((row) => (
                <SourceRow
                  key={row.id}
                  label={row.label || row.prefix}
                  sub={row.label ? row.prefix : ""}
                  ok={row.status === "active"}
                  current={isCurrent("deepseek_api", row.id)}
                  switching={switchingId === row.id}
                  disabled={row.status !== "active" || switchingId !== null}
                  onPick={() => choose(`/api/deepseek/keys/${row.id}/default`, row.id)}
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
