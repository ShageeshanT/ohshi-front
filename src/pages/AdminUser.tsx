/**
 * One account, as the operator sees it: plan and billing, the 30-day
 * ledger, everything connected (accounts and keys), API keys, sessions,
 * billing events — and the switches: ban, unban, sign out everywhere,
 * revoke API keys. Never chat content.
 */

import { useCallback, useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { ArrowLeft, KeyRound, LogOut, ShieldBan, ShieldCheck } from "lucide-react";
import { useAuth } from "../App";
import { Badge, Button, Card, EmptyState, Field, Input, Modal, Notice, PageHeader, Progress, SectionTitle, Spinner, Stat } from "../components/ui";
import { formatNumber, friendly, timeAgo } from "../lib/api";
import {
  banUser,
  bool,
  fetchUser,
  num,
  revokeKeys,
  revokeSessions,
  str,
  unbanUser,
  type AdminUserDetail,
  type Loose,
} from "../lib/admin";
import { StateBadges, planTone } from "./Admin";

function when(ms: number | null | undefined): string {
  return ms ? new Date(ms).toLocaleString(undefined, { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }) : "—";
}

/** The owner's own as_dict() view of a connected account or key, rendered generically. */
function AccountRows(props: { rows: Loose[]; kind: "google" | "chatgpt" | "deepseek" | "geminiKey" | "deepseekKey" }) {
  if (props.rows.length === 0) return <p className="px-4 py-3 text-[12.5px] text-ink-dim">None</p>;
  return (
    <ul className="divide-y divide-edge">
      {props.rows.map((r, i) => {
        const primary = str(r.email) || str(r.label) || str(r.googleEmail) || "(unnamed)";
        const secondary = [str(r.prefix), str(r.planLabel), str(r.tier), str(r.projectId)].filter(Boolean).join(" · ");
        const status = str(r.status);
        const health = (r.health ?? null) as Loose | null;
        return (
          <li key={str(r.id) || i} className="flex flex-wrap items-center justify-between gap-2 px-4 py-2.5 text-[12.5px]">
            <span className="min-w-0">
              <span className="block truncate font-medium">{primary}</span>
              <span className="block truncate text-[11.5px] text-ink-dim">
                {secondary || props.kind}
                {num(r.connectedMs) || num(r.createdMs) ? ` · added ${timeAgo((num(r.connectedMs) ?? num(r.createdMs)) as number)}` : ""}
                {health && str(health.lastModel) ? ` · last ${str(health.lastModel)}` : ""}
              </span>
            </span>
            <span className="flex shrink-0 gap-1">
              {bool(r.isDefault) && <Badge tone="accent">default</Badge>}
              {bool(r.locked) && <Badge tone="warn">locked</Badge>}
              {status && <Badge tone={status === "active" ? "ok" : "warn"}>{status.replace("_", " ")}</Badge>}
            </span>
          </li>
        );
      })}
    </ul>
  );
}

export default function AdminUser() {
  const { userId = "" } = useParams();
  const { me } = useAuth();
  const [d, setD] = useState<AdminUserDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [banOpen, setBanOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [cancelSub, setCancelSub] = useState(true);

  const load = useCallback(async () => {
    try {
      setD(await fetchUser(userId));
    } catch (err) {
      setError(friendly(err));
    }
  }, [userId]);

  useEffect(() => {
    void load();
  }, [load]);

  const act = async (name: string, fn: () => Promise<AdminUserDetail>, done: (r: AdminUserDetail) => string) => {
    if (busy) return;
    setBusy(name);
    setError(null);
    try {
      const r = await fn();
      setD(r);
      setNotice(done(r));
    } catch (err) {
      setError(friendly(err));
    } finally {
      setBusy(null);
    }
  };

  if (!d) {
    return (
      <div className="rise-in space-y-4">
        <Link to="/app/admin" className="inline-flex items-center gap-1 text-[12.5px] text-ink-dim hover:text-ink">
          <ArrowLeft className="h-3.5 w-3.5" /> All accounts
        </Link>
        {error ? <Notice tone="danger">{error}</Notice> : <div className="flex items-center gap-2 text-[13px] text-ink-dim"><Spinner size={14} /> Loading</div>}
      </div>
    );
  }

  const u = d.user;
  const isSelf = me?.user.id === u.id;
  const pct = u.requestLimit ? Math.min(100, Math.round((u.requestsMonth / u.requestLimit) * 100)) : 0;
  const maxDay = Math.max(1, ...d.daily.map((x) => x.requests));
  const liveKeys = d.apiKeys.filter((k) => !k.revokedMs).length;

  return (
    <div className="rise-in space-y-7">
      <Link to="/app/admin" className="inline-flex items-center gap-1 text-[12.5px] text-ink-dim hover:text-ink">
        <ArrowLeft className="h-3.5 w-3.5" /> All accounts
      </Link>

      <PageHeader
        title={
          <span className="flex flex-wrap items-center gap-2">
            <span className={u.isActive ? "" : "line-through"}>{u.email}</span>
            <StateBadges row={u} />
          </span>
        }
        description={`${u.displayName || "No display name"} · signs in with ${u.authProvider === "clerk" ? "Clerk" : "a password"} · joined ${when(u.createdMs)} · last seen ${u.lastSeenMs ? timeAgo(u.lastSeenMs) : "never"}`}
        actions={
          <span className="flex flex-wrap gap-2">
            <Button tone="ghost" busy={busy === "sessions"} disabled={busy !== null || u.sessions === 0} onClick={() => void act("sessions", () => revokeSessions(u.id), () => "Signed out everywhere.")}>
              <LogOut className="h-3.5 w-3.5" /> Sign out everywhere
            </Button>
            <Button tone="ghost" busy={busy === "keys"} disabled={busy !== null || liveKeys === 0} onClick={() => void act("keys", () => revokeKeys(u.id), (r) => `${r.revokedKeys ?? 0} API key${r.revokedKeys === 1 ? "" : "s"} revoked.`)}>
              <KeyRound className="h-3.5 w-3.5" /> Revoke API keys
            </Button>
            {u.isActive ? (
              <Button tone="danger" disabled={busy !== null || isSelf || u.isAdmin} onClick={() => setBanOpen(true)} title={u.isAdmin ? "Admins cannot be banned from here" : undefined}>
                <ShieldBan className="h-3.5 w-3.5" /> Ban
              </Button>
            ) : (
              <Button busy={busy === "unban"} disabled={busy !== null} onClick={() => void act("unban", () => unbanUser(u.id), () => "Unbanned. They can sign in again.")}>
                <ShieldCheck className="h-3.5 w-3.5" /> Unban
              </Button>
            )}
          </span>
        }
      />

      {notice && (
        <Notice tone="ok" onClose={() => setNotice(null)}>
          {notice}
        </Notice>
      )}
      {error && (
        <Notice tone="danger" onClose={() => setError(null)}>
          {error}
        </Notice>
      )}
      {!u.isActive && (
        <Notice tone="danger">
          Banned {u.bannedMs ? timeAgo(u.bannedMs) : ""}
          {u.banReason ? `: ${u.banReason}` : "."} Every session was ended, API keys and the connector refuse, and sign-in is rejected until unbanned.
        </Notice>
      )}

      <div className="tiles grid-cols-2 md:grid-cols-3 lg:grid-cols-6">
        <Stat
          label="Plan"
          value={<Badge tone={planTone(u.plan)}>{u.planLabel}</Badge>}
          sub={
            u.plan === "free"
              ? "free"
              : `${u.subscriptionStatus ?? "active"}${u.planRenewsMs ? ` · ${u.subscriptionStatus === "cancelled" ? "ends" : "renews"} ${timeAgo(u.planRenewsMs)}` : ""}`
          }
        />
        <Stat label="This month" value={`${formatNumber(u.requestsMonth)} / ${formatNumber(u.requestLimit)}`} sub={<Progress percent={pct} tone={pct >= 100 ? "danger" : pct >= 80 ? "warn" : "accent"} className="mt-1" />} />
        <Stat label="Requests, 30 days" value={formatNumber(u.requests30d)} sub={u.lastRequestMs ? `last ${timeAgo(u.lastRequestMs)}` : "none"} />
        <Stat label="Errors, 30 days" value={formatNumber(u.errors30d)} tone={u.errors30d ? "warn" : undefined} sub={u.requests30d ? `${Math.round((u.errors30d / u.requests30d) * 100)}%` : "—"} />
        <Stat label="Tokens, 30 days" value={formatNumber(u.tokens30d)} />
        <Stat label="Chats" value={formatNumber(u.chats)} sub={`${u.sessions} session${u.sessions === 1 ? "" : "s"}`} />
      </div>

      <Card title="Daily requests, last 30 days" description="Each bar is one UTC day. Red is the share that failed.">
        {/* Each column has the full height so its percentage bars resolve. */}
        <div className="flex h-24 gap-[3px]">
          {d.daily.map((day) => {
            const h = Math.round((day.requests / maxDay) * 100);
            const eh = day.requests ? Math.round((day.errors / day.requests) * h) : 0;
            return (
              <div key={day.day} className="relative flex h-full flex-1 flex-col justify-end" title={`${day.day}: ${day.requests} requests, ${day.errors} errors, ${formatNumber(day.tokens)} tokens`}>
                <div className="w-full rounded-t-[3px] bg-accent/70" style={{ height: `${Math.max(h, day.requests ? 3 : 0)}%` }} />
                {eh > 0 && <div className="absolute bottom-0 left-0 w-full rounded-t-[3px] bg-danger" style={{ height: `${eh}%` }} />}
              </div>
            );
          })}
        </div>
        <div className="mt-1.5 flex justify-between text-[11px] text-ink-faint">
          <span>{d.daily[0]?.day}</span>
          <span>{d.daily[d.daily.length - 1]?.day}</span>
        </div>
      </Card>

      <section className="space-y-3">
        <SectionTitle title="Connected" description="What this account routes its calls through. Tokens and keys are never shown, only their labels." />
        <div className="grid gap-4 lg:grid-cols-2">
          <Card title="Google accounts" flush>
            <AccountRows rows={d.google} kind="google" />
          </Card>
          <Card title="ChatGPT accounts" flush>
            <AccountRows rows={d.chatgpt} kind="chatgpt" />
          </Card>
          <Card title="DeepSeek accounts" flush>
            <AccountRows rows={d.deepseek} kind="deepseek" />
          </Card>
          <Card title="Gemini and DeepSeek API keys" flush>
            <AccountRows rows={[...d.geminiKeys, ...d.deepseekKeys]} kind="geminiKey" />
          </Card>
        </div>
      </section>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card title={`Ohshi API keys (${liveKeys} live)`} flush>
          {d.apiKeys.length === 0 ? (
            <p className="px-4 py-3 text-[12.5px] text-ink-dim">None</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="tbl">
                <thead>
                  <tr>
                    <th>Name</th>
                    <th>Prefix</th>
                    <th>Created</th>
                    <th>Last used</th>
                    <th>State</th>
                  </tr>
                </thead>
                <tbody>
                  {d.apiKeys.map((k) => (
                    <tr key={k.id}>
                      <td className="max-w-[10rem] truncate">{k.name || "—"}</td>
                      <td className="mono text-[12px]">{k.prefix}…</td>
                      <td className="whitespace-nowrap text-ink-dim">{timeAgo(k.createdMs)}</td>
                      <td className="whitespace-nowrap text-ink-dim">{k.lastUsedMs ? timeAgo(k.lastUsedMs) : "never"}</td>
                      <td>{k.revokedMs ? <Badge tone="dim">revoked</Badge> : <Badge tone="ok">live</Badge>}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
        <Card title={`Sessions (${d.sessions.length})`} description="Browsers currently signed in." flush>
          {d.sessions.length === 0 ? (
            <p className="px-4 py-3 text-[12.5px] text-ink-dim">None</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="tbl">
                <thead>
                  <tr>
                    <th>Last seen</th>
                    <th>IP</th>
                    <th>Browser</th>
                  </tr>
                </thead>
                <tbody>
                  {d.sessions.map((s) => (
                    <tr key={s.id}>
                      <td className="whitespace-nowrap">{timeAgo(s.lastSeenMs)}</td>
                      <td className="mono text-[12px]">{s.ip || "—"}</td>
                      <td className="max-w-[16rem] truncate text-[12px] text-ink-dim" title={s.userAgent}>
                        {s.userAgent || "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      </div>

      <Card title="Recent calls" description="The newest 50 in the last 30 days. Prompts are never stored." flush>
        {d.recentUsage.length === 0 ? (
          <div className="p-4">
            <EmptyState title="No calls in the last 30 days" />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="tbl">
              <thead>
                <tr>
                  <th>When</th>
                  <th>Model</th>
                  <th>Via</th>
                  <th className="num">Tokens</th>
                  <th className="num">Latency</th>
                  <th>Result</th>
                </tr>
              </thead>
              <tbody>
                {d.recentUsage.map((r) => (
                  <tr key={r.id}>
                    <td className="whitespace-nowrap text-ink-dim">{timeAgo(r.createdMs)}</td>
                    <td className="mono max-w-[14rem] truncate text-[12px]" title={r.model}>
                      {r.apiModel || r.model}
                    </td>
                    <td className="whitespace-nowrap text-[12px] text-ink-dim">
                      {r.via}
                      {r.source ? ` · ${r.source}` : ""}
                    </td>
                    <td className="num">{r.status === "ok" ? formatNumber(r.totalTokens) : "—"}</td>
                    <td className="num text-ink-dim">{(r.latencyMs / 1000).toFixed(1)}s</td>
                    <td>
                      {r.status === "ok" ? (
                        <Badge tone="ok">ok</Badge>
                      ) : (
                        <span title={r.error}>
                          <Badge tone="danger">{r.httpStatus ?? "error"}</Badge>
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {d.billingEvents.length > 0 && (
        <Card title="Billing events" description="What PayPal told us about this account, newest first." flush>
          <div className="overflow-x-auto">
            <table className="tbl">
              <thead>
                <tr>
                  <th>Received</th>
                  <th>Event</th>
                  <th>Outcome</th>
                </tr>
              </thead>
              <tbody>
                {d.billingEvents.map((b) => (
                  <tr key={b.id}>
                    <td className="whitespace-nowrap text-ink-dim">{timeAgo(b.receivedMs)}</td>
                    <td className="mono text-[12px]">{b.eventType}</td>
                    <td className="max-w-[24rem] truncate text-[12px]" title={b.note}>
                      {b.applied ? <Badge tone="ok">applied</Badge> : <Badge tone="dim">recorded</Badge>} <span className="text-ink-dim">{b.note}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      <Modal open={banOpen} onClose={() => (busy ? undefined : setBanOpen(false))} title={`Ban ${u.email}?`}>
        <div className="space-y-4 text-[13px]">
          <p className="text-ink-dim">
            Every browser session ends now, their API keys and connector stop working, and sign-in is refused until you unban them. Nothing is deleted.
          </p>
          <Field label="Reason" hint="Kept on the account for you. The person is not shown it.">
            <Input value={reason} onChange={setReason} placeholder="e.g. sharing keys, abuse of the gateway" maxLength={300} autoFocus />
          </Field>
          {u.hasSubscription && u.plan !== "free" && u.subscriptionStatus !== "cancelled" && (
            <label className="flex items-start gap-2 text-[12.5px]">
              <input type="checkbox" checked={cancelSub} onChange={(e) => setCancelSub(e.target.checked)} className="mt-0.5 h-3.5 w-3.5 accent-accent" />
              <span>
                Also cancel their {u.planLabel} subscription at PayPal, so they are not charged again.
                <span className="block text-ink-dim">Untick to keep billing them, for example while a dispute is open.</span>
              </span>
            </label>
          )}
          <div className="flex justify-end gap-2">
            <Button tone="ghost" disabled={busy !== null} onClick={() => setBanOpen(false)}>
              Keep the account
            </Button>
            <Button
              tone="danger"
              busy={busy === "ban"}
              disabled={busy !== null}
              onClick={() =>
                void act(
                  "ban",
                  () => banUser(u.id, reason, cancelSub),
                  (r) => `Banned.${r.subscriptionCancelled ? " Their subscription was cancelled at PayPal." : ""}`,
                ).then(() => setBanOpen(false))
              }
            >
              Ban this account
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
