/**
 * Docs — pick a model, get the exact request for it. Three paths reach the
 * same /v1: a Gemini API key, a DeepSeek API key (both supported) and a
 * connected Google account (Beta). The page opens on whichever the account is
 * set to and lists that path's models: the key's live list from GET
 * /api/chat/models, or the static catalogs from /api/gemini/catalog,
 * /api/deepseek/catalog and /api/google/catalog.
 */

import { useEffect, useMemo, useState, type ReactNode } from "react";
import { Check, Copy, ExternalLink } from "lucide-react";
import { vendorLogo } from "../components/logos";
import { Badge, Card, Code, PageHeader, Spinner, Tabs } from "../components/ui";
import { copyText, get } from "../lib/api";
import { effortLabel, familyName, isKeyRoute, routeLabel, type ChatModelsPayload, type RouteKind } from "../lib/chat";

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

const VENDOR_LABEL: Record<string, string> = { google: "Gemini", anthropic: "Claude", openai: "GPT-OSS", deepseek: "DeepSeek" };
const LANGS = ["Python", "curl", "JavaScript"];
const PATHS: { kind: RouteKind; tab: string }[] = [
  { kind: "gemini_api", tab: "Gemini key" },
  { kind: "deepseek_api", tab: "DeepSeek key" },
  { kind: "code_assist", tab: "Google (Beta)" },
];
const STUDIO_URL = "https://aistudio.google.com/apikey";
const PLATFORM_URL = "https://platform.deepseek.com/api_keys";
const GEMINI_EFFORTS = ["low", "medium", "high"];
const DEEPSEEK_EFFORTS = ["low", "high", "max"];
const DEFAULT_ID: Record<RouteKind, string> = {
  gemini_api: "gemini-2.5-flash",
  deepseek_api: "deepseek-v4-flash",
  code_assist: "gemini-3.6-flash",
};

/** Gemini 2.5 and later accept thinkingConfig; earlier ids and Gemma do not. */
function geminiThinks(id: string): boolean {
  const hit = /^gemini-(\d+(?:\.\d+)?)/.exec(id.toLowerCase());
  return hit !== null && Number(hit[1]) >= 2.5;
}

/** Every DeepSeek V4 id thinks; the legacy deepseek-chat never did. */
function deepseekThinks(id: string): boolean {
  const lowered = id.toLowerCase();
  const hit = /^deepseek-v(\d+(?:\.\d+)?)/.exec(lowered);
  return (hit !== null && Number(hit[1]) >= 4) || lowered.includes("reasoner");
}

/** A key's live list, in the static catalog's shape, so one picker serves every path. */
function liveKeyFamilies(models: ChatModelsPayload, kind: RouteKind): Family[] {
  const deepseek = kind === "deepseek_api";
  return models.families.map((f) => ({
    id: f.id,
    label: familyName(f),
    vendor: deepseek ? "deepseek" : "google",
    efforts: deepseek ? (deepseekThinks(f.id) ? DEEPSEEK_EFFORTS : []) : geminiThinks(f.id) ? GEMINI_EFFORTS : [],
    defaultEffort: "",
    variants: { "": f.id },
    description: "",
    recommended: f.id === models.default,
  }));
}

const chip = (active: boolean) =>
  `rounded-md px-2.5 py-1 text-[12px] font-medium transition-colors ${
    active ? "bg-ink text-panel" : "bg-ink/[0.05] text-ink-dim hover:bg-ink/10 hover:text-ink"
  }`;

export default function Docs() {
  const [geminiCatalog, setGeminiCatalog] = useState<Family[] | null>(null);
  const [deepseekCatalog, setDeepSeekCatalog] = useState<Family[] | null>(null);
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
    get<{ families: Family[]; default: string }>("/api/deepseek/catalog")
      .then((d) => setDeepSeekCatalog(d.families))
      .catch(() => setDeepSeekCatalog([]));
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
      if (models && models.route === "gemini_api" && models.families.length > 0) return liveKeyFamilies(models, path);
      return geminiCatalog;
    }
    if (path === "deepseek_api") {
      if (models && models.route === "deepseek_api" && models.families.length > 0) return liveKeyFamilies(models, path);
      return deepseekCatalog;
    }
    return googleCatalog;
  }, [path, models, geminiCatalog, deepseekCatalog, googleCatalog]);

  // Keep the selection on a model of the current path.
  useEffect(() => {
    if (!families || families.length === 0) return;
    if (families.some((f) => f.id === modelId)) return;
    const preferred = isKeyRoute(path)
      ? (families.find((f) => f.recommended) ?? families[0])
      : (families.find((f) => f.id === googleDefault) ?? families[0]);
    setModelId(preferred.id);
    setEffort(preferred.defaultEffort);
  }, [families, modelId, path, googleDefault]);

  const family = useMemo(() => families?.find((f) => f.id === modelId) ?? null, [families, modelId]);
  const keyPath = isKeyRoute(path);
  const deepseek = path === "deepseek_api";
  const resolved = family
    ? (family.variants[effort] ?? family.variants[family.defaultEffort] ?? Object.values(family.variants)[0])
    : "";
  const live = keyPath && !!models && models.route === path && models.families.length > 0;
  const vendorName = deepseek ? "DeepSeek" : "Google";

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
    <div className="rise-in space-y-5">
      <PageHeader
        title="Using the gateway"
        description={
          <>
            Any OpenAI compatible client works. Base URL <code className="mono text-[12px] text-ink">{base}</code>, key
            from the API keys page.{" "}
            {models?.route
              ? `Right now your calls run on ${routeLabel(models)}.`
              : "Add a Gemini or DeepSeek API key, or connect a Google account, on the Model access page first."}{" "}
            Nothing in your code says which one; switching the default on the Model access page is enough.
          </>
        }
      />

      <Card title="Before you start" aside={<Tabs tabs={PATHS.map((p) => p.tab)} active={pathTab} onChange={onPathTab} />}>
        <div className="grid gap-3 md:grid-cols-3">
          <PathBox active={path === "gemini_api"} title="Gemini API key" badge={<Badge tone="ok" dot>Live</Badge>}>
            <li>
              Create a key at{" "}
              <a href={STUDIO_URL} target="_blank" rel="noreferrer" className="font-medium text-accent underline-offset-2 hover:underline">
                Google AI Studio <ExternalLink className="inline h-3 w-3 align-[-1px]" />
              </a>
              . Google bills it for what you use.
            </li>
            <li>Paste it once on the Model access page. It is stored encrypted and never shown again.</li>
            <li>
              Create an <code className="mono text-ink">ohs_</code> key and call <code className="mono text-ink">/v1</code>.
              The Gemini key stays on the server.
            </li>
          </PathBox>
          <PathBox active={deepseek} title="DeepSeek API key" badge={<Badge tone="ok" dot>Live</Badge>}>
            <li>
              Create a key at{" "}
              <a href={PLATFORM_URL} target="_blank" rel="noreferrer" className="font-medium text-accent underline-offset-2 hover:underline">
                platform.deepseek.com <ExternalLink className="inline h-3 w-3 align-[-1px]" />
              </a>{" "}
              and top up the balance. DeepSeek bills it per token; there is no subscription.
            </li>
            <li>Paste it once on the Model access page. The balance behind it shows there.</li>
            <li>
              Same <code className="mono text-ink">ohs_</code> key, same <code className="mono text-ink">/v1</code>. Thinking
              streams as <code className="mono text-ink">reasoning_content</code>.
            </li>
          </PathBox>
          <PathBox active={path === "code_assist"} title="Google account" badge={<Badge tone="violet">Beta</Badge>}>
            <li>Connect the Google account behind your Google AI plan and paste back the code.</li>
            <li>Calls run on that plan through Google Code Assist, with live remaining quota per model.</li>
            <li>Beta: not a guaranteed API entitlement. Keep an API key for anything that must not break.</li>
          </PathBox>
        </div>
      </Card>

      <Card
        title="1. Pick a model"
        description={
          families === null
            ? undefined
            : keyPath
              ? live
                ? `What your key lists on the ${vendorName === "Google" ? "Gemini" : "DeepSeek"} API right now (${families.length} chat models). Anything ${vendorName} adds appears here by itself.`
                : `The built-in ${deepseek ? "DeepSeek" : "Gemini API"} list. Once a key is saved, this shows what that key can actually call.`
              : "The Code Assist families a connected Google account serves. Effort levels are separate backend ids."
        }
      >
        {families === null ? (
          <Spinner label="Loading the catalog…" />
        ) : (
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {families.map((f) => {
              const Logo = vendorLogo(f.vendor);
              const active = f.id === modelId;
              return (
                <button
                  key={f.id}
                  type="button"
                  onClick={() => pick(f)}
                  className={`flex flex-col gap-0.5 rounded-lg border px-3 py-2.5 text-left transition-colors ${
                    active ? "border-ink bg-ink/[0.03] ring-1 ring-ink" : "border-edge hover:border-edge-strong"
                  }`}
                >
                  <span className="flex items-center gap-2">
                    <Logo className={`h-3.5 w-3.5 shrink-0 ${active ? "text-ink" : "text-ink-dim"}`} />
                    <span className="truncate text-[13px] font-medium">{f.label}</span>
                    {f.recommended && <Badge tone="accent">Default</Badge>}
                  </span>
                  <span className="mono truncate text-[11px] text-ink-dim">{f.id}</span>
                  <span className="text-[11.5px] text-ink-dim">
                    {VENDOR_LABEL[f.vendor] ?? f.vendor}
                    {f.efforts.length > 0 && (keyPath ? ", thinking" : `, ${f.efforts.length} effort levels`)}
                  </span>
                </button>
              );
            })}
          </div>
        )}

        {family && family.efforts.length > 0 && (
          <div className="mt-4 border-t border-edge pt-4">
            <p className="mb-2 text-[12.5px] font-medium">Reasoning effort</p>
            <div className="flex flex-wrap gap-1.5">
              {keyPath && (
                <button type="button" onClick={() => setEffort("")} className={chip(effort === "")}>
                  Model default
                </button>
              )}
              {family.efforts.map((e) => (
                <button key={e} type="button" onClick={() => setEffort(e)} className={chip(e === effort)}>
                  {effortLabel(e)}
                  {!keyPath && e === family.defaultEffort && <Check className="ml-1 inline h-3 w-3 align-[-1px]" />}
                </button>
              ))}
            </div>
            <p className="mt-2.5 text-[12px] leading-relaxed text-ink-dim">
              {deepseek ? (
                <>
                  On the DeepSeek API the id goes to DeepSeek unchanged and{" "}
                  <code className="mono text-ink">reasoning_effort</code> sets the thinking depth in DeepSeek&apos;s own
                  words: low, high or max (medium counts as high; none switches thinking off). Leave it out for the
                  model&apos;s own default, which is high.
                </>
              ) : keyPath ? (
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
        <Card title="2. Send the request" aside={<Tabs tabs={LANGS} active={lang} onChange={setLang} />}>
          <Snippet code={snippetFor(lang, base, family, effort)} />
          <p className="mt-2.5 text-[12px] text-ink-dim">
            Drop <code className="mono text-ink">stream</code> for a single JSON reply. Tool calling uses the standard
            OpenAI <code className="mono text-ink">tools</code> array.
          </p>
        </Card>
      )}

      <Card title="Streaming, tools and everything else">
        <div className="grid gap-4 md:grid-cols-2">
          <div className="min-w-0">
            <p className="mb-1.5 text-[12.5px] font-medium">Streaming</p>
            <Code>{`for chunk in client.chat.completions.create(
    model="${family?.id ?? DEFAULT_ID[path]}",
    messages=[{"role": "user", "content": "hello"}],
    stream=True,
):
    print(chunk.choices[0].delta.content or "", end="")`}</Code>
          </div>
          <div className="min-w-0">
            <p className="mb-1.5 text-[12.5px] font-medium">Tool calling</p>
            <Code>{`client.chat.completions.create(
    model="${family?.id ?? DEFAULT_ID[path]}",
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
        {deepseek && (
          <p className="mt-3 text-[12px] leading-relaxed text-ink-dim">
            In a tool loop, send the assistant message back as you received it, including{" "}
            <code className="mono text-ink">reasoning_content</code>: DeepSeek continues its reasoning from it and
            answers 400 when it is missing.
          </p>
        )}
      </Card>

      <Card title="Errors" flush>
        <div className="overflow-x-auto">
        <table className="tbl">
          <tbody>
            <ErrorRow code="401" tone="danger" name="authentication_error">
              Missing, wrong or revoked API key.
            </ErrorRow>
            <ErrorRow code="403 / 409" tone="warn" name="gemini_api_key_error">
              Google rejected your Gemini API key, or you have none saved. Paste a fresh one on the Model access page.
            </ErrorRow>
            <ErrorRow code="403 / 409" tone="warn" name="deepseek_api_key_error">
              DeepSeek rejected your API key, or you have none saved. Paste a fresh one on the Model access page.
            </ErrorRow>
            <ErrorRow code="402" tone="warn" name="insufficient_quota">
              The DeepSeek account behind the key has no balance left. Top up at platform.deepseek.com; the key stays.
            </ErrorRow>
            <ErrorRow code="409 / 403" tone="warn" name="google_account_error">
              No Google account connected, or it needs reconnecting. The Model access page shows which.
            </ErrorRow>
            <ErrorRow code="429" tone="warn" name="rate_limit_error">
              The provider&apos;s limit on your key, quota exhausted on every Code Assist endpoint, or this key over its
              per minute burst limit. <code className="mono">Retry-After</code> says when to try again.
            </ErrorRow>
            <ErrorRow code="404" tone="dim" name="invalid_request_error">
              That model isn&apos;t available on this key or plan.
            </ErrorRow>
          </tbody>
        </table>
        </div>
        <p className="border-t border-edge px-4 py-2 text-[12px] text-ink-dim">
          <code className="mono text-ink">GET {base}/models</code> lists what your current route accepts.
        </p>
      </Card>
    </div>
  );
}

function PathBox(props: { active: boolean; title: string; badge: ReactNode; children: ReactNode }) {
  return (
    <div className={`rounded-lg border px-3.5 py-3 ${props.active ? "border-ink ring-1 ring-ink" : "border-edge"}`}>
      <p className="flex items-center gap-2 text-[13px] font-medium">
        {props.title} {props.badge}
      </p>
      <ol className="mt-1.5 list-decimal space-y-1 pl-4 text-[12.5px] leading-relaxed text-ink-dim">{props.children}</ol>
    </div>
  );
}

function ErrorRow(props: { code: string; tone: "danger" | "warn" | "dim"; name: string; children: ReactNode }) {
  return (
    <tr>
      <td className="w-24 whitespace-nowrap">
        <Badge tone={props.tone}>{props.code}</Badge>
      </td>
      <td className="mono w-56 whitespace-nowrap text-[12px]">{props.name}</td>
      <td className="text-ink-dim">{props.children}</td>
    </tr>
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
        className="absolute right-2 top-2 z-10 inline-flex items-center gap-1 rounded-md bg-white/10 px-2 py-1 text-[11px] font-medium text-[#d5dae3] transition-colors hover:bg-white/20 hover:text-white"
      >
        {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
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
