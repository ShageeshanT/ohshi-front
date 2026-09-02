import { useCallback, useEffect, useState } from "react";
import { Check, Copy, Plus, Trash2 } from "lucide-react";
import { Link } from "react-router-dom";
import { useAuth } from "../App";
import { Badge, Button, Card, EmptyState, Field, Input, Modal, Notice, PageHeader, Spinner } from "../components/ui";
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
  const { me } = useAuth();
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

  const closeModal = () => {
    setCreateOpen(false);
    setFresh(null);
    setCopied(false);
  };

  const visible = (keys ?? []).filter((k) => showRevoked || k.revokedMs === null);
  const revokedCount = (keys ?? []).filter((k) => k.revokedMs !== null).length;
  const activeCount = (keys ?? []).length - revokedCount;
  const lockedCount = (keys ?? []).filter((k) => k.revokedMs === null && k.locked).length;
  const usableCount = activeCount - lockedCount;
  const atCap = maxKeys !== null && activeCount >= maxKeys;

  return (
    <div className="rise-in space-y-5">
      <PageHeader
        title="API keys"
        description={
          <>
            Your agents send one as <code className="mono text-[12px] text-ink">Authorization: Bearer ohs_…</code> to{" "}
            <code className="mono text-[12px] text-ink">/v1</code>. Keys are stored hashed and shown once.
          </>
        }
        actions={
          <Button onClick={() => setCreateOpen(true)}>
            <Plus className="h-3.5 w-3.5" /> New key
          </Button>
        }
      />

      {error && (
        <Notice tone="danger" onClose={() => setError(null)}>
          {error}
        </Notice>
      )}

      <Card flush>
        {keys === null ? (
          <div className="flex justify-center py-8 text-ink-dim">
            <Spinner />
          </div>
        ) : visible.length === 0 ? (
          <div className="p-4">
            <EmptyState
              title="No API keys yet"
              hint="Create one, paste it into your agent's OpenAI client config, and you're live."
              action={
                <Button onClick={() => setCreateOpen(true)}>
                  <Plus className="h-3.5 w-3.5" /> New key
                </Button>
              }
            />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="tbl">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Key</th>
                  <th>Created</th>
                  <th>Last used</th>
                  <th>Status</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {visible.map((k) => (
                  <tr key={k.id} className={k.revokedMs !== null ? "opacity-60" : ""}>
                    <td className="font-medium">{k.name || "Untitled key"}</td>
                    <td className="mono text-[12px] text-ink-dim">{k.prefix}…</td>
                    <td className="whitespace-nowrap text-ink-dim">{timeAgo(k.createdMs)}</td>
                    <td className="whitespace-nowrap text-ink-dim">{timeAgo(k.lastUsedMs)}</td>
                    <td>
                      {k.revokedMs !== null ? (
                        <Badge tone="danger">Revoked {timeAgo(k.revokedMs)}</Badge>
                      ) : k.locked ? (
                        <Badge tone="warn">Locked on your plan</Badge>
                      ) : (
                        <Badge tone="ok" dot>
                          Active
                        </Badge>
                      )}
                    </td>
                    <td className="num">
                      {k.revokedMs === null && (
                        <Button size="sm" tone="danger" onClick={() => void revoke(k)}>
                          <Trash2 className="h-3.5 w-3.5" /> Revoke
                        </Button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {keys !== null && keys.length > 0 && (
          <div className="flex items-center justify-between border-t border-edge px-4 py-2 text-[11.5px] text-ink-dim">
            <span>
              {maxKeys !== null ? (
                <>
                  {usableCount} of {maxKeys} active key{maxKeys === 1 ? "" : "s"} on your plan
                  {lockedCount > 0 && `, ${lockedCount} locked`}
                  {atCap && me?.config.billingEnabled && (
                    <>
                      {" · "}
                      <Link to="/app/billing" className="font-medium text-ink hover:underline">
                        Upgrade for more
                      </Link>
                    </>
                  )}
                </>
              ) : (
                <>
                  {activeCount} active key{activeCount === 1 ? "" : "s"}
                </>
              )}
            </span>
            {revokedCount > 0 && (
              <button type="button" onClick={() => setShowRevoked((v) => !v)} className="font-medium hover:text-ink">
                {showRevoked ? "Hide" : "Show"} {revokedCount} revoked
              </button>
            )}
          </div>
        )}
      </Card>

      {/* While the one-time key is on screen the modal closes only through Done:
          a stray click on the backdrop must not throw the secret away. */}
      <Modal
        open={createOpen}
        onClose={fresh ? () => undefined : closeModal}
        title={fresh ? "Copy your new key" : "Create an API key"}
      >
        {fresh ? (
          <div className="space-y-4">
            <p className="text-[13px] leading-relaxed text-ink-dim">
              This is the only time the full key is shown. Store it in your agent's secrets now.
            </p>
            <div className="flex items-center gap-2 rounded-lg bg-code p-3 text-[#e6e8eb]">
              <code className="mono min-w-0 flex-1 break-all text-[12px]">{fresh}</code>
              <button
                type="button"
                className="shrink-0 rounded-md bg-white/10 p-1.5 transition-colors hover:bg-white/20"
                onClick={() => {
                  void copyText(fresh).then((ok) => setCopied(ok));
                }}
                aria-label="Copy key"
              >
                {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
              </button>
            </div>
            <Button onClick={closeModal}>Done</Button>
          </div>
        ) : (
          <div className="space-y-4">
            <Field label="Name" hint="Something you'll recognise, like “support bot (prod)”.">
              <Input value={name} onChange={setName} placeholder="my agent" autoFocus onEnter={create} />
            </Field>
            <div className="flex gap-2">
              <Button onClick={create} busy={creating}>
                Create key
              </Button>
              <Button tone="ghost" onClick={closeModal}>
                Cancel
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
