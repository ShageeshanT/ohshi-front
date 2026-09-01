import { useCallback, useEffect, useState } from "react";
import { Check, Copy, KeyRound, Plus, Trash2 } from "lucide-react";
import { Link } from "react-router-dom";
import { Badge, Button, Card, EmptyState, Field, Input, Modal, Notice, Spinner } from "../components/ui";
import { copyText, friendly, get, post, timeAgo } from "../lib/api";

interface ApiKeyRow {
  id: string;
  name: string;
  prefix: string;
  createdMs: number;
  lastUsedMs: number | null;
  revokedMs: number | null;
  locked?: boolean;
}

export default function Keys() {
  const [keys, setKeys] = useState<ApiKeyRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [name, setName] = useState("");
  const [creating, setCreating] = useState(false);
  const [fresh, setFresh] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [showRevoked, setShowRevoked] = useState(false);
  const [maxKeys, setMaxKeys] = useState<number | null>(null);

  const load = useCallback(async () => {
    try {
      const payload = await get<{ keys: ApiKeyRow[]; maxApiKeys?: number }>("/api/keys");
      setKeys(payload.keys);
      setMaxKeys(payload.maxApiKeys ?? null);
      setError(null);
    } catch (e) {
      setError(friendly(e));
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const create = () => {
    setCreating(true);
    post<{ key: string }>("/api/keys", { name: name.trim() })
      .then((d) => {
        setFresh(d.key);
        setName("");
        void load();
      })
      .catch((e) => setError(friendly(e)))
      .finally(() => setCreating(false));
  };

  const revoke = async (k: ApiKeyRow) => {
    if (!window.confirm(`Revoke "${k.name || k.prefix}"? Agents using it will get 401 immediately.`)) return;
    try {
      await post(`/api/keys/${k.id}/revoke`);
      await load();
    } catch (e) {
      setError(friendly(e));
    }
  };

  const visible = (keys ?? []).filter((k) => showRevoked || k.revokedMs === null);
  const revokedCount = (keys ?? []).filter((k) => k.revokedMs !== null).length;

  return (
    <div className="rise-in space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">API keys</h1>
          <p className="mt-1 text-sm text-ink-dim">
            Your agents send one of these as <code className="mono">Authorization: Bearer ohs_…</code> to{" "}
            <code className="mono">/v1</code>.
          </p>
          {maxKeys !== null && keys !== null && (
            <p className="mt-1 text-xs text-ink-dim">
              {keys.filter((k) => k.revokedMs === null).length} of {maxKeys} active key
              {maxKeys === 1 ? "" : "s"} on your plan
              {keys.filter((k) => k.revokedMs === null).length >= maxKeys && (
                <>
                  {" · "}
                  <Link to="/app/profile" className="font-semibold text-accent hover:underline">
                    Upgrade for more
                  </Link>
                </>
              )}
            </p>
          )}
        </div>
        <Button onClick={() => setCreateOpen(true)}>
          <Plus className="h-4 w-4" /> New key
        </Button>
      </header>

      {error && (
        <Notice tone="danger" onClose={() => setError(null)}>
          {error}
        </Notice>
      )}

      <Card>
        {keys === null ? (
          <div className="flex justify-center py-6 text-ink-dim">
            <Spinner />
          </div>
        ) : visible.length === 0 ? (
          <EmptyState
            title="No API keys yet"
            hint="Create one, paste it into your agent's OpenAI client config, and you're live."
            action={
              <Button onClick={() => setCreateOpen(true)}>
                <Plus className="h-4 w-4" /> New key
              </Button>
            }
          />
        ) : (
          <ul className="divide-y divide-edge">
            {visible.map((k) => (
              <li key={k.id} className="flex flex-wrap items-center justify-between gap-3 py-3 first:pt-0 last:pb-0">
                <div className="flex min-w-0 items-center gap-3">
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-panel-2">
                    <KeyRound className="h-4 w-4 text-ink-dim" />
                  </span>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold">{k.name || "Untitled key"}</p>
                    <p className="text-xs text-ink-dim">
                      <span className="mono">{k.prefix}…</span>, created {timeAgo(k.createdMs)}, last used{" "}
                      {timeAgo(k.lastUsedMs)}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {k.locked && k.revokedMs === null && <Badge tone="warn">Locked on your plan</Badge>}
                  {k.revokedMs !== null ? (
                    <Badge tone="danger">Revoked {timeAgo(k.revokedMs)}</Badge>
                  ) : (
                    <Button size="sm" tone="danger" onClick={() => void revoke(k)}>
                      <Trash2 className="h-3.5 w-3.5" /> Revoke
                    </Button>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
        {revokedCount > 0 && (
          <button
            type="button"
            onClick={() => setShowRevoked((v) => !v)}
            className="mt-4 text-xs font-semibold text-ink-dim hover:text-ink"
          >
            {showRevoked ? "Hide" : "Show"} {revokedCount} revoked key{revokedCount > 1 ? "s" : ""}
          </button>
        )}
      </Card>

      <Modal
        open={createOpen}
        onClose={() => {
          setCreateOpen(false);
          setFresh(null);
          setCopied(false);
        }}
        title={fresh ? "Copy your new key" : "Create an API key"}
      >
        {fresh ? (
          <div className="space-y-4">
            <p className="text-sm text-ink-dim">
              This is the only time the full key is shown. Store it in your agent's secrets now.
            </p>
            <div className="flex items-center gap-2 rounded-xl bg-night p-3 text-white">
              <code className="mono min-w-0 flex-1 break-all text-xs">{fresh}</code>
              <button
                type="button"
                className="shrink-0 rounded-lg bg-white/10 p-2 hover:bg-white/20"
                onClick={() => {
                  void copyText(fresh).then((ok) => setCopied(ok));
                }}
                aria-label="Copy key"
              >
                {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
              </button>
            </div>
            <Button
              onClick={() => {
                setCreateOpen(false);
                setFresh(null);
                setCopied(false);
              }}
            >
              Done
            </Button>
          </div>
        ) : (
          <div className="space-y-4">
            <Field label="Name" hint="Something you'll recognise, like “support bot (prod)”.">
              <Input value={name} onChange={setName} placeholder="my agent" autoFocus onEnter={create} />
            </Field>
            <Button onClick={create} busy={creating}>
              Create key
            </Button>
          </div>
        )}
      </Modal>
    </div>
  );
}
