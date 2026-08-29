/**
 * Docs — pick a model, get the exact request for it. The catalog comes from
 * GET /api/google/catalog, so the ids here are always the ones the gateway
 * actually accepts.
 */

import { useEffect, useMemo, useState } from "react";
import { Check, Copy } from "lucide-react";
import { vendorLogo } from "../components/logos";
import { Badge, Card, Code, Spinner, Tabs } from "../components/ui";
import { copyText, get } from "../lib/api";
import { effortLabel } from "../lib/chat";

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

export default function Docs() {
  const [families, setFamilies] = useState<Family[] | null>(null);
  const [modelId, setModelId] = useState<string>("");
  const [effort, setEffort] = useState<string>("");
  const [lang, setLang] = useState(LANGS[0]);
  const base = `${window.location.origin}/v1`;

  useEffect(() => {
    get<{ families: Family[]; default: string }>("/api/google/catalog")
      .then((d) => {
        setFamilies(d.families);
        const first = d.families.find((f) => f.id === d.default) ?? d.families[0];
        if (first) {
          setModelId(first.id);
          setEffort(first.defaultEffort);
        }
      })
      .catch(() => setFamilies([]));
  }, []);

  const family = useMemo(() => families?.find((f) => f.id === modelId) ?? null, [families, modelId]);
  const resolved = family
    ? (family.variants[effort] ?? family.variants[family.defaultEffort] ?? Object.values(family.variants)[0])
    : "";

  const pick = (f: Family) => {
    setModelId(f.id);
    setEffort(f.defaultEffort);
  };

  return (
    <div className="rise-in space-y-6">
      <header>
        <h1 className="text-2xl font-extrabold tracking-tight">
          Using the <span className="serif-accent">gateway</span>
        </h1>
        <p className="mt-1 text-sm text-ink-dim">
          Any OpenAI-compatible client works. Base URL <code className="mono text-accent">{base}</code>, key from
          the API keys page. Calls run on your default connected Google account.
        </p>
      </header>

      <Card title="1 · Pick a model">
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
                  className={`flex flex-col gap-1 rounded-2xl border px-3.5 py-3 text-left transition-colors ${
                    active
                      ? "border-accent/60 bg-accent/[0.12]"
                      : "border-white/[0.07] bg-white/[0.03] hover:bg-white/[0.06]"
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
                    {f.efforts.length > 0 && ` · ${f.efforts.length} effort levels`}
                  </span>
                </button>
              );
            })}
          </div>
        )}

        {family && family.efforts.length > 0 && (
          <div className="mt-4 border-t border-white/[0.07] pt-4">
            <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.12em] text-ink-dim">
              Reasoning effort
            </p>
            <div className="flex flex-wrap gap-1.5">
              {family.efforts.map((e) => (
                <button
                  key={e}
                  type="button"
                  onClick={() => setEffort(e)}
                  className={`rounded-full px-3 py-1 text-xs font-semibold transition-colors ${
                    e === effort
                      ? "bg-accent text-accent-ink"
                      : "bg-white/[0.08] text-ink-dim hover:bg-white/15 hover:text-ink"
                  }`}
                >
                  {effortLabel(e)}
                  {e === family.defaultEffort && " ·"}
                </button>
              ))}
            </div>
            <p className="mt-2.5 text-[11px] text-ink-dim">
              Effort is baked into the model id upstream, so{" "}
              <code className="mono text-ink">{family.id}</code> +{" "}
              <code className="mono text-ink">{effort}</code> is served as{" "}
              <code className="mono text-accent">{resolved}</code>. You can also send that id directly.
            </p>
          </div>
        )}
      </Card>

      {family && (
        <Card
          title="2 · Send the request"
          aside={<Tabs tabs={LANGS} active={lang} onChange={setLang} />}
        >
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
    model="${family?.id ?? "gemini-3.6-flash"}",
    messages=[{"role": "user", "content": "hello"}],
    stream=True,
):
    print(chunk.choices[0].delta.content or "", end="")`}</Code>
          </div>
          <div>
            <p className="mb-2 text-[13px] font-semibold">Tool calling</p>
            <Code>{`client.chat.completions.create(
    model="${family?.id ?? "gemini-3.6-flash"}",
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
              <code className="mono text-ink">authentication_error</code> — missing, wrong or revoked API key.
            </span>
          </li>
          <li className="flex gap-2">
            <Badge tone="warn">409/403</Badge>
            <span>
              <code className="mono text-ink">google_account_error</code> — no Google account connected, or it
              needs reconnecting. The accounts page shows which.
            </span>
          </li>
          <li className="flex gap-2">
            <Badge tone="warn">429</Badge>
            <span>
              <code className="mono text-ink">rate_limit_error</code> — quota exhausted on every Code Assist
              endpoint. The message lists what was tried, and <code className="mono text-ink">Retry-After</code>{" "}
              is set when Google gives one.
            </span>
          </li>
          <li className="flex gap-2">
            <Badge tone="dim">404</Badge>
            <span>
              <code className="mono text-ink">invalid_request_error</code> — that model isn't on this Google plan.
            </span>
          </li>
        </ul>
        <p className="mt-4 text-[11px] text-ink-dim">
          <code className="mono text-ink">GET {base}/models</code> lists every family and concrete variant the
          gateway accepts.
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
        className="absolute right-3 top-3 z-10 inline-flex items-center gap-1.5 rounded-full bg-white/10 px-2.5 py-1 text-[11px] font-semibold text-ink-dim transition-colors hover:bg-white/20 hover:text-ink"
      >
        {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
        {copied ? "Copied" : "Copy"}
      </button>
      <Code>{props.code}</Code>
    </div>
  );
}

function snippetFor(lang: string, base: string, f: Family, effort: string): string {
  const effortLine = f.efforts.length > 0;
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
