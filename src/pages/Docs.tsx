import { useEffect, useState } from "react";
import { Badge, Card, Code } from "../components/ui";
import { get } from "../lib/api";

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

export default function Docs() {
  const [families, setFamilies] = useState<Family[]>([]);
  const base = `${window.location.origin}/v1`;

  useEffect(() => {
    get<{ families: Family[] }>("/api/google/catalog")
      .then((d) => setFamilies(d.families))
      .catch(() => setFamilies([]));
  }, []);

  return (
    <div className="rise-in space-y-6">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">Using the gateway</h1>
        <p className="mt-1 text-sm text-ink-dim">
          Any OpenAI-compatible client works. Base URL <code className="mono">{base}</code>, key from the API keys
          page. Calls run on your default connected Google account.
        </p>
      </header>

      <Card title="Python (openai SDK)">
        <Code>{`from openai import OpenAI

client = OpenAI(base_url="${base}", api_key="ohs_...")

resp = client.chat.completions.create(
    model="gemini-3.6-flash",        # see the model table below
    reasoning_effort="high",         # low / medium / high where the family supports it
    messages=[{"role": "user", "content": "Summarise this in one line: ..."}],
)
print(resp.choices[0].message.content)

# streaming
for chunk in client.chat.completions.create(model="gemini-3.6-flash", messages=[...], stream=True):
    print(chunk.choices[0].delta.content or "", end="")`}</Code>
      </Card>

      <Card title="curl">
        <Code>{`curl ${base}/chat/completions \\
  -H "Authorization: Bearer ohs_..." \\
  -H "Content-Type: application/json" \\
  -d '{"model": "gemini-3.6-flash", "messages": [{"role": "user", "content": "hello"}]}'`}</Code>
      </Card>

      <Card title="JavaScript / TypeScript">
        <Code>{`import OpenAI from "openai";

const client = new OpenAI({ baseURL: "${base}", apiKey: process.env.OHSHI_KEY });
const res = await client.chat.completions.create({
  model: "claude-sonnet-4-6",
  messages: [{ role: "user", content: "hello" }],
  tools: [/* OpenAI function tools work as-is */],
});`}</Code>
      </Card>

      <Card title="Models">
        <p className="mb-3 text-sm text-ink-dim">
          Ask for a family id and optionally a <code className="mono">reasoning_effort</code>; Ohshi maps it to the
          concrete backend id (also accepted directly). <code className="mono">GET /v1/models</code> lists everything.
        </p>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-left text-[11px] uppercase tracking-wide text-ink-dim">
              <tr>
                <th className="pb-2 font-semibold">Model</th>
                <th className="pb-2 font-semibold">Vendor</th>
                <th className="pb-2 font-semibold">Efforts</th>
                <th className="pb-2 font-semibold">Notes</th>
              </tr>
            </thead>
            <tbody>
              {families.map((f) => (
                <tr key={f.id} className="border-t border-edge align-top">
                  <td className="py-2">
                    <code className="mono text-xs">{f.id}</code>
                    {f.recommended && (
                      <Badge tone="accent" className="ml-2">
                        default
                      </Badge>
                    )}
                  </td>
                  <td className="py-2 text-ink-dim">{f.vendor}</td>
                  <td className="py-2 text-xs text-ink-dim">
                    {f.efforts.length ? f.efforts.map((e) => `${e}${e === f.defaultEffort ? "*" : ""}`).join(" / ") : "—"}
                  </td>
                  <td className="py-2 text-xs text-ink-dim">{f.description || f.label}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <Card title="Errors">
        <ul className="space-y-1.5 text-sm text-ink-dim">
          <li>
            <code className="mono">401 authentication_error</code> — missing, wrong or revoked API key.
          </li>
          <li>
            <code className="mono">409 / 403 google_account_error</code> — no Google account connected, or it needs
            reconnecting (the dashboard shows which).
          </li>
          <li>
            <code className="mono">429 rate_limit_error</code> — quota exhausted on every Code Assist endpoint; the
            message lists what was tried and <code className="mono">Retry-After</code> is set when Google gave one.
          </li>
          <li>
            <code className="mono">404 invalid_request_error</code> — that model isn't on this Google plan.
          </li>
        </ul>
      </Card>
    </div>
  );
}
