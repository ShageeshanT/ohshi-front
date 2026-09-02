/**
 * Connected accounts — the Gemini API keys and Google accounts your chat and
 * /v1 calls run on, whether each one actually answers, and the optional
 * connector. Quota per model lives on the Models page; the ledger on Usage.
 *
 * The Google OAuth callback lands here with ?connected=… or ?connect_error=…;
 * the Overview's Get started strip links here with ?add=key or ?connect=1 to
 * open the matching dialog.
 */

import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { ExternalLink, Laptop, Plug, Plus, RefreshCw } from "lucide-react";
import ConnectGoogleModal from "../components/ConnectGoogleModal";
import { ConnectionCard } from "../components/ConnectionCard";
import ConnectorCard from "../components/ConnectorCard";
import GeminiKeysCard from "../components/GeminiKeysCard";
import { GeminiLogo, GoogleLogo } from "../components/logos";
import { Badge, Button, Card, EmptyState, Notice, PageHeader, SectionTitle, Spinner, type Tone } from "../components/ui";
import { friendly, post } from "../lib/api";
import {
  quotaFor,
  useConnections,
  useGeminiKeys,
  useQuotas,
  useRunner,
  type Connection,
  type ExecuteMode,
} from "../lib/workspace";

export default function Accounts() {
  const [params, setParams] = useSearchParams();
  const { connections, setConnections, error: loadError, reload: loadConnections } = useConnections();
  const { gemini, error: geminiError, reload: loadGemini } = useGeminiKeys();
  const { runner, error: runnerError, reload: loadRunner } = useRunner();
  const { quotas, loadQuota, forget } = useQuotas(connections);
  const [connectOpen, setConnectOpen] = useState(() => params.get("connect") === "1");
  const [addKeyOpen, setAddKeyOpen] = useState(() => params.get("add") === "key");
  const [refreshing, setRefreshing] = useState(false);
  const [flash, setFlash] = useState<{ tone: Tone; text: string } | null>(() => {
    const connected = params.get("connected");
    const error = params.get("connect_error");
    if (connected) return { tone: "ok", text: `Connected ${connected}.` };
    if (error) return { tone: "danger", text: error };
    return null;
  });

  useEffect(() => {
    if (["connected", "connect_error", "add", "connect"].some((k) => params.has(k))) setParams({}, { replace: true });
  }, [params, setParams]);

  const activeConnections = (connections ?? []).filter((c) => c.status === "active");
  const preferLocalCount = activeConnections.filter((c) => c.executeMode === "prefer_local").length;
  const route = gemini?.route ?? null;
  const studioUrl = gemini?.studioUrl ?? "https://aistudio.google.com/apikey";

  const onConnected = (email: string) => {
    setConnectOpen(false);
    setFlash({ tone: "ok", text: `Connected ${email}.` });
    void loadConnections();
    void loadGemini();
  };

  const disconnect = async (c: Connection) => {
    if (!window.confirm(`Disconnect ${c.email}? Agents using this account will stop until you reconnect.`)) return;
    try {
      await post(`/api/google/connections/${c.id}/disconnect`);
      forget(c.id);
      await Promise.all([loadConnections(), loadGemini()]);
    } catch (e) {
      setFlash({ tone: "danger", text: friendly(e) });
    }
  };

  const makeDefault = async (c: Connection) => {
    try {
      await post(`/api/google/connections/${c.id}/default`);
      setFlash({ tone: "ok", text: `Chat and /v1 now run on ${c.email} (Beta).` });
      await Promise.all([loadConnections(), loadGemini()]);
    } catch (e) {
      setFlash({ tone: "danger", text: friendly(e) });
    }
  };

  const setExecuteMode = async (c: Connection, mode: ExecuteMode) => {
    // Flip at once; the server's row (with its health note) replaces it when it answers.
    setConnections((list) => list?.map((x) => (x.id === c.id ? { ...x, executeMode: mode } : x)) ?? list);
    try {
      const { connection } = await post<{ connection: Connection }>(`/api/google/connections/${c.id}/execute-mode`, {
        executeMode: mode,
      });
      setConnections((list) => list?.map((x) => (x.id === c.id ? connection : x)) ?? list);
      void loadQuota(c.id, true);
    } catch (e) {
      setFlash({ tone: "danger", text: friendly(e) });
      void loadConnections();
    }
  };

  const refresh = async () => {
    setRefreshing(true);
    try {
      await Promise.all([loadConnections(), loadGemini(), loadRunner(), ...activeConnections.map((c) => loadQuota(c.id, true))]);
    } finally {
      setRefreshing(false);
    }
  };

  return (
    <div className="rise-in space-y-7">
      <PageHeader
        title="Google access"
        description="The Gemini keys and Google accounts your chat and /v1 calls run on. Add several and pick a default."
        actions={
          <>
            <Button tone="ghost" busy={refreshing} onClick={() => void refresh()}>
              <RefreshCw className="h-3.5 w-3.5" /> Refresh
            </Button>
            <Button tone="ghost" onClick={() => setConnectOpen(true)}>
              <GoogleLogo className="h-3.5 w-3.5" /> Connect Google
            </Button>
            <Button onClick={() => setAddKeyOpen(true)}>
              <Plus className="h-3.5 w-3.5" /> Add key
            </Button>
          </>
        }
      />

      {flash && (
        <Notice tone={flash.tone} onClose={() => setFlash(null)}>
          {flash.text}
        </Notice>
      )}
      {loadError && <Notice tone="danger">{loadError}</Notice>}

      <section id="sources" className="scroll-mt-4 space-y-3">
        <SectionTitle
          icon={GeminiLogo}
          title="Gemini API keys"
          badge={
            <Badge tone="ok" dot>
              Live
            </Badge>
          }
          description="Your own key from Google AI Studio. Google bills the key, Ohshi routes chat and /v1 to it."
          aside={
            <div className="flex gap-2">
              <a href={studioUrl} target="_blank" rel="noreferrer" className="inline-flex">
                <Button size="sm" tone="ghost">
                  <ExternalLink className="h-3.5 w-3.5" /> Get a key
                </Button>
              </a>
              <Button size="sm" onClick={() => setAddKeyOpen(true)}>
                <Plus className="h-3.5 w-3.5" /> Add key
              </Button>
            </div>
          }
        />
        <GeminiKeysCard
          payload={gemini}
          error={geminiError}
          addOpen={addKeyOpen}
          onAddOpen={setAddKeyOpen}
          onChanged={() => {
            void loadGemini();
            void loadConnections();
          }}
          onFlash={setFlash}
        />
      </section>

      <section id="connections" className="scroll-mt-4 space-y-3">
        <SectionTitle
          icon={GoogleLogo}
          title="Google accounts"
          badge={<Badge tone="violet">Beta</Badge>}
          description="Sign in with the account behind your Google AI plan. Health and routing here, live quota on the Models page."
          aside={
            <Button size="sm" tone="ghost" onClick={() => setConnectOpen(true)}>
              <Plug className="h-3.5 w-3.5" /> Add account
            </Button>
          }
        />

        {connections === null ? (
          <Card>
            <Spinner label="Checking your Google accounts…" />
          </Card>
        ) : connections.length === 0 ? (
          <Card>
            <EmptyState
              title="No Google account connected"
              hint="Optional, and in Beta. Sign in with the Google account whose plan you want to use and paste back the code. Live health and quota show up once it is connected."
              action={
                <Button tone="ghost" onClick={() => setConnectOpen(true)} arrow>
                  <Plug className="h-3.5 w-3.5" /> Connect account
                </Button>
              }
            />
          </Card>
        ) : (
          <div className="space-y-3">
            {connections.map((c) => (
              <ConnectionCard
                key={c.id}
                connection={c}
                quota={quotaFor(quotas, c.id)}
                runner={runner}
                canMakeDefault={!c.isDefault && (connections.length > 1 || route?.kind === "gemini_api")}
                onDisconnect={() => disconnect(c)}
                onMakeDefault={() => makeDefault(c)}
                onReconnect={() => setConnectOpen(true)}
                onExecuteMode={(mode) => void setExecuteMode(c, mode)}
                onTested={() => {
                  void loadConnections();
                  void loadQuota(c.id, true);
                }}
              />
            ))}
          </div>
        )}
      </section>

      <section id="connector" className="scroll-mt-4 space-y-3">
        <SectionTitle
          icon={Laptop}
          title="Connector"
          badge={<Badge tone="violet">Beta</Badge>}
          description="Optional. Make your model calls from your own computer instead of Ohshi's servers."
        />
        <ConnectorCard status={runner} error={runnerError} preferLocalCount={preferLocalCount} onChanged={() => void loadRunner()} />
      </section>

      <ConnectGoogleModal open={connectOpen} onClose={() => setConnectOpen(false)} onDone={onConnected} />
    </div>
  );
}
