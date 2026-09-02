/**
 * Models — what each model has left (the live quota of every connected Google
 * account, the model list of every Gemini key) and what your agents used per
 * model through the gateway.
 */

import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, Plug, Star } from "lucide-react";
import type { GeminiKeyRow } from "../components/GeminiKeysCard";
import { keyName } from "../components/GeminiKeysCard";
import { GeminiLogo, GoogleLogo } from "../components/logos";
import { QuotaGrid } from "../components/QuotaGrid";
import { Badge, Button, Card, EmptyState, PageHeader, SectionTitle, Spinner } from "../components/ui";
import { formatNumber, get } from "../lib/api";
import { quotaFor, useConnections, useGeminiKeys, useQuotas, useUsage } from "../lib/workspace";

interface KeyModels {
  count: number;
  models: { id: string; displayName: string }[];
  default: string;
}

export default function Models() {
  const { connections } = useConnections();
  const { gemini } = useGeminiKeys();
  const { quotas, loadQuota } = useQuotas(connections);
  const { usage } = useUsage(30);

  const activeConnections = (connections ?? []).filter((c) => c.status === "active");
  const activeKeys = (gemini?.keys ?? []).filter((k) => k.status === "active");
  const known = connections !== null && gemini !== null;
  const route = gemini?.route ?? null;
  const nothing = known && activeConnections.length === 0 && activeKeys.length === 0;

  return (
    <div className="rise-in space-y-7">
      <PageHeader
        title="Models"
        description="What each model has left on your Google accounts, what each key can call, and what your agents used."
        actions={
          route ? (
            <span className="inline-flex h-8 items-center gap-2 rounded-lg border border-edge bg-panel px-2.5 text-[12.5px]">
              <span className="text-ink-dim">Answering from</span>
              {route.kind === "gemini_api" ? <GeminiLogo className="h-3.5 w-3.5 text-ink-dim" /> : <GoogleLogo className="h-3.5 w-3.5" />}
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
            hint="Add a Gemini API key or connect a Google account and the models it can use show up here, with live quota for Google accounts."
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
                <KeyModelsCard key={k.id} row={k} isRoute={route?.kind === "gemini_api" && route.id === k.id} />
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

function KeyModelsCard(props: { row: GeminiKeyRow; isRoute: boolean }) {
  const { row } = props;
  const [models, setModels] = useState<KeyModels | null | undefined>(undefined);

  useEffect(() => {
    let cancelled = false;
    get<KeyModels>(`/api/gemini/keys/${row.id}/models`)
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
        <Spinner label="Asking Google what this key can call…" />
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
