/**
 * Docs — pick a model, get the exact request for it. Two paths reach the same
 * /v1: a Gemini API key (the supported path) and a connected Google account
 * (Beta). The page opens on whichever the account is set to and lists that
 * path's models: the key's live list from GET /api/chat/models, or the static
 * catalogs from /api/gemini/catalog and /api/google/catalog.
 */

import { useEffect, useMemo, useState } from "react";
import { Check, Copy, ExternalLink } from "lucide-react";
import { vendorLogo } from "../components/logos";
import { Badge, Card, Code, Spinner, Tabs } from "../components/ui";
import { copyText, get } from "../lib/api";
import { effortLabel, familyName, routeLabel, type ChatModelsPayload, type RouteKind } from "../lib/chat";

interface Family {
  id: string;
  label: string;
  vendor: string;
  efforts: string[];
  defaultEffort: string;
  variants: Record<string, string>;
  description: string;
  recommended: boolean;
}

const VENDOR_LABEL: Record<string, string> = { google: "Gemini", anthropic: "Claude", openai: "GPT-OSS" };
const LANGS = ["Python", "curl", "JavaScript"];
const PATHS: { kind: RouteKind; tab: string }[] = [
  { kind: "gemini_api", tab: "Gemini key" },
  { kind: "code_assist", tab: "Google (Beta)" },
];
const STUDIO_URL = "https://aistudio.google.com/apikey";
const EFFORTS = ["low", "medium", "high"];

/** Gemini 2.5 and later accept thinkingConfig; earlier ids and Gemma do not. */
function geminiThinks(id: string): boolean {
  const hit = /^gemini-(\d+(?:\.\d+)?)/.exec(id.toLowerCase());
  return hit !== null && Number(hit[1]) >= 2.5;
}

/** The key's live list, in the static catalog's shape, so one picker serves both. */
function liveGeminiFamilies(models: ChatModelsPayload): Family[] {
  return models.families.map((f) => ({
    id: f.id,
    label: familyName(f),
    vendor: "google",
    efforts: geminiThinks(f.id) ? EFFORTS : [],
    defaultEffort: "",
    variants: { "": f.id },
    description: "",
    recommended: f.id === models.default,
  }));
}

export default function Docs() {
  const [geminiCatalog, setGeminiCatalog] = useState<Family[] | null>(null);
  const [googleCatalog, setGoogleCatalog] = useState<Family[] | null>(null);
  const [googleDefault, setGoogleDefault] = useState("");
  const [models, setModels] = useState<ChatModelsPayload | null | undefined>(undefined);
  const [path, setPath] = useState<RouteKind>("gemini_api");
  const [pathChosen, setPathChosen] = useState(false);
  const [modelId, setModelId] = useState<string>("");
  const [effort, setEffort] = useState<string>("");
  const [lang, setLang] = useState(LANGS[0]);
  const base = `${window.location.origin}/v1`;

  useEffect(() => {
    get<{ families: Family[]; default: string }>("/api/gemini/catalog")
      .then((d) => setGeminiCatalog(d.families))
      .catch(() => setGeminiCatalog([]));
    get<{ families: Family[]; default: string }>("/api/google/catalog")
      .then((d) => {
        setGoogleCatalog(d.families);
        setGoogleDefault(d.default);
      })
      .catch(() => setGoogleCatalog([]));
    get<ChatModelsPayload>("/api/chat/models")
      .then(setModels)
      .catch(() => setModels(null));
  }, []);

  // Open on the path the account is actually set to (once).
  useEffect(() => {
    if (models === undefined || pathChosen) return;
    setPathChosen(true);
    if (models?.route) setPath(models.route);
  }, [models, pathChosen]);

  const families = useMemo<Family[] | null>(() => {
    if (path === "gemini_api") {
      if (models && models.route === "gemini_api" && models.families.length > 0) return liveGeminiFamilies(models);
      return geminiCatalog;
    }
    return googleCatalog;
  }, [path, models, geminiCatalog, googleCatalog]);

  // Keep the selection on a model of the current path.
  useEffect(() => {
    if (!families || families.length === 0) return;
    if (families.some((f) => f.id === modelId)) return;
    const preferred =
      path === "gemini_api"
        ? (families.find((f) => f.recommended) ?? families[0])
        : (families.find((f) => f.id === googleDefault) ?? families[0]);
    setModelId(preferred.id);
    setEffort(preferred.defaultEffort);
  }, [families, modelId, path, googleDefault]);

  const family = useMemo(() => families?.find((f) => f.id === modelId) ?? null, [families, modelId]);
  const gemini = path === "gemini_api";
  const resolved = family
    ? (family.variants[effort] ?? family.variants[family.defaultEffort] ?? Object.values(family.variants)[0])
    : "";
  const live = gemini && !!models && models.route === "gemini_api" && models.families.length > 0;

  const pick = (f: Family) => {
    setModelId(f.id);
    setEffort(f.defaultEffort);
  };

  const pathTab = PATHS.find((p) => p.kind === path)?.tab ?? PATHS[0].tab;
  const onPathTab = (tab: string) => {
    const next = PATHS.find((p) => p.tab === tab);
    if (next) setPath(next.kind);
  };

  return (
    <div className="rise-in space-y-6">
      <header>
        <h1 className="text-2xl font-extrabold tracking-tight">Using the gateway</h1>
        <p className="mt-1 text-sm text-ink-dim">
          Any OpenAI compatible client works. Base URL <code className="mono text-accent">{base}</code>, key from
          the API keys page.{" "}
          {models?.route
            ? `Right now your calls run on ${routeLabel(models)}.`
            : "Add a Gemini API key or connect a Google account on the dashboard first."}{" "}
          Nothing in your code says which one; switching the default on the dashboard is enough.
        </p>
      </header>

      <Card title="Before you start" aside={<Tabs tabs={PATHS.map((p) => p.tab)} active={pathTab} onChange={onPathTab} />}>
        <div className="grid gap-4 md:grid-cols-2">
          <div className={`rounded-2xl border px-4 py-3.5 ${gemini ? "border-accent/60 bg-accent/[0.08]" : "border-edge bg-ink/[0.03]"}`}>
            <p className="flex items-center gap-2 text-[13px] font-semibold">
              Gemini API key <Badge tone="ok">Live</Badge>
            </p>
            <ol className="mt-2 list-decimal space-y-1 pl-4 text-[13px] text-ink-dim">
              <li>
                Create a key at{" "}
                <a href={STUDIO_URL} target="_blank" rel="noreferrer" className="font-semibold text-accent underline-offset-2 hover:underline">
                  Google AI Studio <ExternalLink className="inline h-3 w-3 align-[-1px]" />
                </a>
                . Google bills it for what you use.
              </li>
              <li>Paste it once on the dashboard. It is stored encrypted and never shown again.</li>
              <li>
                Create an <code className="mono text-ink">ohs_</code> key and call <code className="mono text-ink">/v1</code>. The
                Gemini key stays on the server.
              </li>
            </ol>
          </div>
          <div className={`rounded-2xl border px-4 py-3.5 ${!gemini ? "border-accent/60 bg-accent/[0.08]" : "border-edge bg-ink/[0.03]"}`}>
            <p className="flex items-center gap-2 text-[13px] font-semibold">
              Google account <Badge tone="violet">Beta</Badge>
            </p>
            <ol className="mt-2 list-decimal space-y-1 pl-4 text-[13px] text-ink-dim">
              <li>Connect the Google account behind your Google AI plan and paste back the code.</li>
              <li>Calls run on that plan through Google Code Assist, with live remaining quota per model.</li>
              <li>Beta: not a guaranteed API entitlement. Keep a Gemini API key for anything that must not break.</li>
            </ol>
          </div>
        </div>
      </Card>

      <Card title="Step 1. Pick a model">
        {families === null ? (
          <Spinner label="Loading the catalog…" />
        ) : (
          <>
            <p className="mb-3 text-[11px] text-ink-dim">
              {gemini
                ? live
                  ? `What your key lists on the Gemini API right now (${families.length} chat models). Anything Google adds appears here by itself.`
                  : "The built-in Gemini API list. Once a key is saved, this shows what that key can actually call."
                : "The Code Assist families a connected Google account serves. Effort levels are separate backend ids."}
            </p>
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {families.map((f) => {
                const Logo = vendorLogo(f.vendor);
                const active = f.id === modelId;
                return (
                  <button
                    key={f.id}
                    type="button"
                    onClick={() => pick(f)}
                    className={`flex flex-col gap-1 rounded-2xl border px-3.5 py-3 text-left transition-colors ${
                      active ? "border-accent/60 bg-accent/[0.12]" : "border-edge bg-ink/[0.03] hover:bg-ink/[0.06]"
                    }`}
                  >
                    <span className="flex items-center gap-2">
                      <Logo className={`h-4 w-4 shrink-0 ${active ? "text-accent" : "text-ink-dim"}`} />
                      <span className="truncate text-[13px] font-semibold">{f.label}</span>
                      {f.recommended && <Badge tone="accent">Default</Badge>}
                    </span>
                    <span className="mono truncate text-[11px] text-ink-dim">{f.id}</span>
                    <span className="text-[11px] text-ink-dim">
                      {VENDOR_LABEL[f.vendor] ?? f.vendor}
                      {f.efforts.length > 0 && (gemini ? ", thinking" : `, ${f.efforts.length} effort levels`)}
                    </span>
                  </button>
                );
              })}
            </div>
          </>
        )}

        {family && family.efforts.length > 0 && (
          <div className="mt-4 border-t border-edge pt-4">
            <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.12em] text-ink-dim">
              Reasoning effort
            </p>
            <div className="flex flex-wrap gap-1.5">
              {gemini && (
                <button
                  type="button"
                  onClick={() => setEffort("")}
                  className={`rounded-full px-3 py-1 text-xs font-semibold transition-colors ${
                    effort === "" ? "bg-accent text-accent-ink" : "bg-ink/[0.07] text-ink-dim hover:bg-ink/15 hover:text-ink"
                  }`}
                >
                  Model default
                </button>
              )}
              {family.efforts.map((e) => (
                <button
                  key={e}
                  type="button"
                  onClick={() => setEffort(e)}
                  className={`rounded-full px-3 py-1 text-xs font-semibold transition-colors ${
                    e === effort ? "bg-accent text-accent-ink" : "bg-ink/[0.07] text-ink-dim hover:bg-ink/15 hover:text-ink"
                  }`}
                >
                  {effortLabel(e)}
                  {!gemini && e === family.defaultEffort && <Check className="ml-1 inline h-3 w-3 align-[-1px]" />}
                </button>
              ))}
            </div>
            <p className="mt-2.5 text-[11px] text-ink-dim">
              {gemini ? (
                <>
                  On the Gemini API the id goes to Google unchanged and{" "}
                  <code className="mono text-ink">reasoning_effort</code> sets the thinking depth: a token budget
                  on Gemini 2.5, a thinking level on Gemini 3. Leave it out for the model&apos;s own default.
                </>
              ) : (
                <>
                  Effort is baked into the model id upstream, so <code className="mono text-ink">{family.id}</code> +{" "}
                  <code className="mono text-ink">{effort}</code> is served as{" "}
                  <code className="mono text-accent">{resolved}</code>. You can also send that id directly.
                </>
              )}
            </p>
          </div>
        )}
      </Card>

      {family && (
        <Card title="Step 2. Send the request" aside={<Tabs tabs={LANGS} active={lang} onChange={setLang} />}>
          <Snippet code={snippetFor(lang, base, family, effort)} />
          <p className="mt-3 text-[11px] text-ink-dim">
            Drop <code className="mono text-ink">stream</code> for a single JSON reply. Tool calling uses the
            standard OpenAI <code className="mono text-ink">tools</code> array.
          </p>
        </Card>
      )}

      <Card title="Streaming, tools and everything else">
        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <p className="mb-2 text-[13px] font-semibold">Streaming</p>
            <Code>{`for chunk in client.chat.completions.create(
    model="${family?.id ?? "gemini-2.5-flash"}",
    messages=[{"role": "user", "content": "hello"}],
    stream=True,
):
    print(chunk.choices[0].delta.content or "", end="")`}</Code>
          </div>
          <div>
            <p className="mb-2 text-[13px] font-semibold">Tool calling</p>
            <Code>{`client.chat.completions.create(
    model="${family?.id ?? "gemini-2.5-flash"}",
    messages=[...],
    tools=[{
        "type": "function",
        "function": {
            "name": "get_weather",
            "parameters": {"type": "object",
                "properties": {"city": {"type": "string"}}},
        },
    }],
)`}</Code>
          </div>
        </div>
      </Card>

      <Card title="Errors">
        <ul className="space-y-2 text-sm text-ink-dim">
          <li className="flex gap-2">
            <Badge tone="danger">401</Badge>
            <span>
              <code className="mono text-ink">authentication_error</code>: missing, wrong or revoked API key.
            </span>
          </li>
          <li className="flex gap-2">
            <Badge tone="warn">403/409</Badge>
            <span>
              <code className="mono text-ink">gemini_api_key_error</code>: Google rejected your Gemini API key, or
              you have none saved. Paste a fresh one on the dashboard.
            </span>
          </li>
          <li className="flex gap-2">
            <Badge tone="warn">409/403</Badge>
            <span>
              <code className="mono text-ink">google_account_error</code>: no Google account connected, or it
              needs reconnecting. The dashboard shows which.
            </span>
          </li>
          <li className="flex gap-2">
            <Badge tone="warn">429</Badge>
            <span>
              <code className="mono text-ink">rate_limit_error</code>: Google&apos;s limit on your key, quota
              exhausted on every Code Assist endpoint, or this key over its per minute burst limit.{" "}
              <code className="mono">Retry-After</code> says when to try again.
            </span>
          </li>
          <li className="flex gap-2">
            <Badge tone="dim">404</Badge>
            <span>
              <code className="mono text-ink">invalid_request_error</code>: that model isn&apos;t available on this
              key or plan.
            </span>
          </li>
        </ul>
        <p className="mt-4 text-[11px] text-ink-dim">
          <code className="mono text-ink">GET {base}/models</code> lists what your current route accepts.
        </p>
      </Card>
    </div>
  );
}

function Snippet(props: { code: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => {
          void copyText(props.code).then((ok) => {
            setCopied(ok);
            window.setTimeout(() => setCopied(false), 1500);
          });
        }}
        className="absolute right-3 top-3 z-10 inline-flex items-center gap-1.5 rounded-full bg-ink/10 px-2.5 py-1 text-[11px] font-semibold text-ink-dim transition-colors hover:bg-ink/20 hover:text-ink"
      >
        {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
        {copied ? "Copied" : "Copy"}
      </button>
      <Code>{props.code}</Code>
    </div>
  );
}

function snippetFor(lang: string, base: string, f: Family, effort: string): string {
  const effortLine = f.efforts.length > 0 && effort !== "";
  if (lang === "curl") {
    const body = effortLine
      ? `{"model": "${f.id}", "reasoning_effort": "${effort}", "messages": [{"role": "user", "content": "hello"}]}`
      : `{"model": "${f.id}", "messages": [{"role": "user", "content": "hello"}]}`;
    return `curl ${base}/chat/completions \\
  -H "Authorization: Bearer $OHSHI_KEY" \\
  -H "Content-Type: application/json" \\
  -d '${body}'`;
  }
  if (lang === "JavaScript") {
    return `import OpenAI from "openai";

const client = new OpenAI({
  baseURL: "${base}",
  apiKey: process.env.OHSHI_KEY,
});

const res = await client.chat.completions.create({
  model: "${f.id}",${effortLine ? `\n  reasoning_effort: "${effort}",` : ""}
  messages: [{ role: "user", content: "hello" }],
});
console.log(res.choices[0].message.content);`;
  }
  return `from openai import OpenAI

client = OpenAI(base_url="${base}", api_key="ohs_…")

resp = client.chat.completions.create(
    model="${f.id}",${effortLine ? `\n    reasoning_effort="${effort}",` : ""}
    messages=[{"role": "user", "content": "hello"}],
)
print(resp.choices[0].message.content)`;
}
