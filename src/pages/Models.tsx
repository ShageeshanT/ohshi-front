/**
 * Models — what each model has left (the live quota of every connected Google
 * account, the rolling usage windows of every ChatGPT account, the model list
 * of every Gemini and DeepSeek key) and what your agents used per model
 * through the gateway.
 */

import { useEffect, useState, type ComponentType } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, Plug, RefreshCw, Star } from "lucide-react";
import { WindowChip } from "../components/ChatGPTAccountCard";
import { keyName, type KeyRow, type RouteKind } from "../components/ProviderKeysCard";
import { DeepSeekLogo, GeminiLogo, GoogleLogo, OpenAILogo } from "../components/logos";
import { QuotaGrid } from "../components/QuotaGrid";
import { Badge, Button, Card, EmptyState, Notice, PageHeader, SectionTitle, Spinner } from "../components/ui";
import { formatNumber, get, timeAgo } from "../lib/api";
import {
  quotaFor,
  usageFor,
  useChatGPTConnections,
  useChatGPTUsage,
  useConnections,
  useDeepSeekChat,
  useDeepSeekKeys,
  useGeminiKeys,
  useQuotas,
  useUsage,
  windowName,
  type ChatGPTConnection,
  type ChatGPTUsageState,
} from "../lib/workspace";

interface KeyModels {
  count: number;
  models: { id: string; displayName: string }[];
  default: string;
}

interface ChatGPTModels {
  count: number;
  models: { id: string; displayName: string; description: string; efforts: string[]; defaultEffort: string; contextWindow: number | null }[];
  default: string;
}

const ROUTE_LOGO: Record<RouteKind, ComponentType<{ className?: string }>> = {
  gemini_api: GeminiLogo,
  deepseek_api: DeepSeekLogo,
  deepseek_chat: DeepSeekLogo,
  code_assist: GoogleLogo,
  chatgpt: OpenAILogo,
};

export default function Models() {
  const { connections } = useConnections();
  const { gemini } = useGeminiKeys();
  const { deepseek } = useDeepSeekKeys();
  const { chatgpt } = useChatGPTConnections();
  const { deepseekChat } = useDeepSeekChat();
  const { quotas, loadQuota } = useQuotas(connections);
  const chatgptRows = chatgpt?.connections ?? null;
  const { usages, loadUsage } = useChatGPTUsage(chatgptRows);
  const { usage } = useUsage(30);

  const activeConnections = (connections ?? []).filter((c) => c.status === "active");
  const activeKeys = (gemini?.keys ?? []).filter((k) => k.status === "active");
  const activeDeepSeek = (deepseek?.keys ?? []).filter((k) => k.status === "active");
  const activeChatgpt = (chatgptRows ?? []).filter((c) => c.status === "active");
  const activeDeepSeekChat = (deepseekChat?.connections ?? []).filter((c) => c.status === "active");
  const known =
    connections !== null && gemini !== null && deepseek !== null && chatgpt !== null && deepseekChat !== null;
  // Every keys payload carries the same route summary; either answers.
  const route = gemini?.route ?? deepseek?.route ?? null;
  const RouteLogo = route ? ROUTE_LOGO[route.kind] : null;
  const nothing =
    known &&
    activeConnections.length === 0 &&
    activeKeys.length === 0 &&
    activeDeepSeek.length === 0 &&
    activeDeepSeekChat.length === 0 &&
    activeChatgpt.length === 0;

  return (
    <div className="rise-in space-y-7">
      <PageHeader
        title="Models"
        description="What each model has left on your Google and ChatGPT accounts, what each key can call, and what your agents used."
        actions={
          route && RouteLogo ? (
            <span className="inline-flex h-8 items-center gap-2 rounded-lg border border-edge bg-panel px-2.5 text-[12.5px]">
              <span className="text-ink-dim">Answering from</span>
              <RouteLogo className={`h-3.5 w-3.5 ${route.kind === "code_assist" ? "" : "text-ink-dim"}`} />
              <span className="font-medium">{route.label}</span>
              {route.beta && <Badge tone="violet">Beta</Badge>}
            </span>
          ) : undefined
        }
      />

      {!known ? (
        <Card>
          <Spinner label="Reading your sources…" />
        </Card>
      ) : nothing ? (
        <Card>
          <EmptyState
            title="Nothing to show yet"
            hint="Add a Gemini or DeepSeek API key, or connect a Google or ChatGPT account, and the models it can use show up here with what is left on the plan."
            action={
              <Link to="/app/accounts?add=key">
                <Button arrow>
                  <Plug className="h-3.5 w-3.5" /> Connected accounts
                </Button>
              </Link>
            }
          />
        </Card>
      ) : (
        <>
          {activeConnections.length > 0 && (
            <section className="space-y-3">
              <SectionTitle
                icon={GoogleLogo}
                title="Remaining quota"
                badge={<Badge tone="violet">Beta</Badge>}
                description="Read live from Google for every model family a connected account can use, with the reset countdown."
              />
              {activeConnections.map((c) => (
                <Card
                  key={c.id}
                  title={
                    <span className="flex items-center gap-1.5">
                      {c.email}
                      {c.isDefault && (
                        <Badge tone="accent">
                          <Star className="h-3 w-3" /> Default
                        </Badge>
                      )}
                    </span>
                  }
                  description={c.tier === "free" ? "Code Assist free tier" : c.tier ? `${c.tier} tier` : undefined}
                >
                  <QuotaGrid quota={quotaFor(quotas, c.id)} onRefresh={() => loadQuota(c.id, true)} />
                </Card>
              ))}
            </section>
          )}

          {activeChatgpt.length > 0 && (
            <section className="space-y-3">
              <SectionTitle
                icon={OpenAILogo}
                title="ChatGPT usage"
                badge={<Badge tone="violet">Beta</Badge>}
                description="OpenAI meters a ChatGPT plan per account, not per model: a 5-hour window and a weekly one. Every model on the plan shares them."
              />
              {activeChatgpt.map((c) => (
                <ChatGPTUsageCard key={c.id} row={c} usage={usageFor(usages, c.id)} onRefresh={() => loadUsage(c.id, true)} />
              ))}
            </section>
          )}

          {activeKeys.length > 0 && (
            <section className="space-y-3">
              <SectionTitle
                icon={GeminiLogo}
                title="Gemini API keys"
                badge={
                  <Badge tone="ok" dot>
                    Live
                  </Badge>
                }
                description="A key has no quota meter. This is what Google lists for it right now; anything new appears by itself."
              />
              {activeKeys.map((k) => (
                <KeyModelsCard
                  key={k.id}
                  api="/api/gemini/keys"
                  vendor="Google"
                  row={k}
                  isRoute={route?.kind === "gemini_api" && route.id === k.id}
                />
              ))}
            </section>
          )}

          {activeDeepSeek.length > 0 && (
            <section className="space-y-3">
              <SectionTitle
                icon={DeepSeekLogo}
                title="DeepSeek API keys"
                badge={
                  <Badge tone="ok" dot>
                    Live
                  </Badge>
                }
                description="What DeepSeek lists for the key right now. The balance behind each key is on the Connected accounts page."
              />
              {activeDeepSeek.map((k) => (
                <KeyModelsCard
                  key={k.id}
                  api="/api/deepseek/keys"
                  vendor="DeepSeek"
                  row={k}
                  isRoute={route?.kind === "deepseek_api" && route.id === k.id}
                />
              ))}
            </section>
          )}

          {activeDeepSeekChat.length > 0 && (
            <section className="space-y-3">
              <SectionTitle
                icon={DeepSeekLogo}
                title="DeepSeek chat accounts"
                badge={<Badge tone="violet">Beta</Badge>}
                description="What chat.deepseek.com lists for the signed-in account."
              />
              {activeDeepSeekChat.map((c) => (
                <ChatAccountModelsCard
                  key={c.id}
                  email={c.email}
                  path={`/api/deepseek/connections/${c.id}/models`}
                  isRoute={route?.kind === "deepseek_chat" && route.id === c.id}
                />
              ))}
            </section>
          )}

          <section className="space-y-3">
            <SectionTitle title="Usage by model" description={`Through the gateway in the last ${usage?.windowDays ?? 30} days.`} />
            <Card flush>
              {!usage ? (
                <Spinner label="Loading usage…" />
              ) : usage.byModel.length === 0 ? (
                <div className="p-4">
                  <EmptyState title="No calls yet" hint="Send a message in chat, or call /v1 with an API key." />
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="tbl">
                    <thead>
                      <tr>
                        <th>Model</th>
                        <th className="num">Calls</th>
                        <th className="num">Tokens</th>
                        <th className="num">Errors</th>
                        <th className="num">Share</th>
                      </tr>
                    </thead>
                    <tbody>
                      {usage.byModel.map((row) => {
                        const share = usage.totals.requests ? Math.round((row.requests / usage.totals.requests) * 100) : 0;
                        return (
                          <tr key={row.model}>
                            <td className="mono text-[12px]">{row.model}</td>
                            <td className="num">{formatNumber(row.requests)}</td>
                            <td className="num">{formatNumber(row.totalTokens)}</td>
                            <td className={`num ${row.errors ? "font-medium text-danger" : "text-ink-dim"}`}>{row.errors}</td>
                            <td className="num">
                              <span className="inline-flex items-center justify-end gap-2">
                                <span className="h-1 w-16 overflow-hidden rounded-full bg-ink/[0.08]">
                                  <span className="block h-full rounded-full bg-ink/60" style={{ width: `${share}%` }} />
                                </span>
                                <span className="tnum w-8 text-right text-ink-dim">{share}%</span>
                              </span>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                  <p className="border-t border-edge px-4 py-2 text-[11.5px] text-ink-dim">
                    Full ledger on the{" "}
                    <Link to="/app/usage" className="inline-flex items-center gap-0.5 font-medium text-ink hover:underline">
                      Usage page <ArrowRight className="h-3 w-3" />
                    </Link>
                  </p>
                </div>
              )}
            </Card>
          </section>
        </>
      )}
    </div>
  );
}

function ChatGPTUsageCard(props: { row: ChatGPTConnection; usage: ChatGPTUsageState; onRefresh: () => void }) {
  const { row } = props;
  const { usage, error, loading } = props.usage;
  const [models, setModels] = useState<ChatGPTModels | null | undefined>(undefined);

  useEffect(() => {
    let cancelled = false;
    get<ChatGPTModels>(`/api/openai/connections/${row.id}/models`)
      .then((d) => {
        if (!cancelled) setModels(d);
      })
      .catch(() => {
        if (!cancelled) setModels(null);
      });
    return () => {
      cancelled = true;
    };
  }, [row.id]);

  return (
    <Card
      flush
      title={
        <span className="flex items-center gap-1.5">
          {row.email}
          {row.planLabel && <Badge>ChatGPT {row.planLabel}</Badge>}
          {row.isDefault && (
            <Badge tone="accent">
              <Star className="h-3 w-3" /> Default
            </Badge>
          )}
        </span>
      }
      description={
        usage
          ? `Read from OpenAI ${timeAgo(usage.fetchedMs)}${usage.cached ? ", cached" : ""}${usage.exhausted ? ", limit reached" : ""}`
          : loading
            ? "Reading your usage from OpenAI…"
            : "Usage unavailable"
      }
      aside={
        <Button size="sm" tone="ghost" busy={loading} onClick={props.onRefresh}>
          <RefreshCw className="h-3.5 w-3.5" /> Refresh
        </Button>
      }
    >
      <div className="space-y-3 p-4">
        {error && (
          <Notice tone="warn">
            {error}
            {usage ? " Showing the last reading." : ""}
          </Notice>
        )}
        {usage ? (
          <div className="grid gap-2 sm:grid-cols-2">
            <WindowChip wide window={usage.primary} label={windowName(usage.primary, "5-hour window")} />
            <WindowChip wide window={usage.secondary} label={windowName(usage.secondary, "Weekly window")} />
          </div>
        ) : !loading ? (
          <EmptyState title="No usage reading yet" hint="Hit Refresh to ask OpenAI again." />
        ) : null}
        {usage?.credits?.hasCredits && (
          <p className="text-[12px] text-ink-dim">
            Credits on the account{usage.credits.unlimited ? ": unlimited" : usage.credits.balance ? `: ${usage.credits.balance}` : ""}.
          </p>
        )}
      </div>
      <div className="border-t border-edge">
        {models === undefined ? (
          <Spinner label="Asking OpenAI what this plan can call…" />
        ) : models === null ? (
          <div className="p-4">
            <EmptyState title="Could not list this plan's models" hint="Test the account on the Connected accounts page to see why." />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="tbl">
              <thead>
                <tr>
                  <th>Model</th>
                  <th>Id</th>
                  <th>Reasoning levels</th>
                  <th className="num">Context</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {models.models.map((m) => (
                  <tr key={m.id}>
                    <td className="font-medium" title={m.description}>
                      {m.displayName}
                    </td>
                    <td className="mono text-[12px] text-ink-dim">{m.id}</td>
                    <td className="text-[12px] text-ink-dim">
                      {m.efforts.length ? m.efforts.map((e) => (e === m.defaultEffort ? `${e} (default)` : e)).join(", ") : "—"}
                    </td>
                    <td className="num text-[12px] text-ink-dim">{m.contextWindow ? formatNumber(m.contextWindow) : "—"}</td>
                    <td className="num">{m.id === models.default && <Badge tone="accent">Default</Badge>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </Card>
  );
}

function KeyModelsCard(props: { api: string; vendor: string; row: KeyRow; isRoute: boolean }) {
  const { api, row } = props;
  const [models, setModels] = useState<KeyModels | null | undefined>(undefined);

  useEffect(() => {
    let cancelled = false;
    get<KeyModels>(`${api}/${row.id}/models`)
      .then((d) => {
        if (!cancelled) setModels(d);
      })
      .catch(() => {
        if (!cancelled) setModels(null);
      });
    return () => {
      cancelled = true;
    };
  }, [api, row.id]);

  return (
    <Card
      flush
      title={
        <span className="flex items-center gap-1.5">
          {keyName(row)}
          <span className="mono text-[11.5px] font-normal text-ink-dim">{row.prefix}…</span>
          {props.isRoute && (
            <Badge tone="accent">
              <Star className="h-3 w-3" /> Default
            </Badge>
          )}
        </span>
      }
      description={models ? `${models.count} chat model${models.count === 1 ? "" : "s"} on this key` : undefined}
    >
      {models === undefined ? (
        <Spinner label={`Asking ${props.vendor} what this key can call…`} />
      ) : models === null ? (
        <div className="p-4">
          <EmptyState title="Could not list this key's models" hint="Test the key on the Connected accounts page to see why." />
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="tbl">
            <thead>
              <tr>
                <th>Model</th>
                <th>Id</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {models.models.map((m) => (
                <tr key={m.id}>
                  <td className="font-medium">{m.displayName}</td>
                  <td className="mono text-[12px] text-ink-dim">{m.id}</td>
                  <td className="num">{m.id === models.default && <Badge tone="accent">Default</Badge>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  );
}

function ChatAccountModelsCard(props: { email: string; path: string; isRoute: boolean }) {
  const [models, setModels] = useState<KeyModels | null | undefined>(undefined);

  useEffect(() => {
    let cancelled = false;
    get<KeyModels>(props.path)
      .then((d) => {
        if (!cancelled) setModels(d);
      })
      .catch(() => {
        if (!cancelled) setModels(null);
      });
    return () => {
      cancelled = true;
    };
  }, [props.path]);

  return (
    <Card
      flush
      title={
        <span className="flex items-center gap-1.5">
          {props.email}
          {props.isRoute && (
            <Badge tone="accent">
              <Star className="h-3 w-3" /> Default
            </Badge>
          )}
        </span>
      }
      description={models ? `${models.count} chat model${models.count === 1 ? "" : "s"} on this account` : undefined}
    >
      {models === undefined ? (
        <Spinner label="Asking DeepSeek what this account can call…" />
      ) : models === null ? (
        <div className="p-4">
          <EmptyState
            title="Could not list this account's models"
            hint="Test the account on the Connected accounts page to see why."
          />
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="tbl">
            <thead>
              <tr>
                <th>Model</th>
                <th>Id</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {models.models.map((m) => (
                <tr key={m.id}>
                  <td className="font-medium">{m.displayName}</td>
                  <td className="mono text-[12px] text-ink-dim">{m.id}</td>
                  <td className="num">{m.id === models.default && <Badge tone="accent">Default</Badge>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  );
}
