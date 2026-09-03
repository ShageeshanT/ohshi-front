# Ohshi — frontend

The web app for **Ohshi**: a chat UI over the models behind your own Gemini
API key, DeepSeek API key or connected Google account (Gemini / DeepSeek /
Claude / GPT-OSS), plus the pages that manage those sources and the API keys
your agents use.

The API lives in **[ohshi-back](https://github.com/ShageeshanT/ohshi-back)**.

## Pages

| Route | What it does |
|---|---|
| `/` · `/c/:chatId` | The chat: collapsible sidebar (search, new chat, date-grouped history with rename/delete), a pill composer with a **model picker showing live remaining quota per model**, streaming replies rendered as Markdown with copyable code blocks, collapsible reasoning, stop (keeps the partial reply) and regenerate |
| `/accounts` | Connected Google accounts: connect / disconnect / make default, a real **Test** call, per-model remaining-usage bars with reset countdowns, a per-account **Run on my machine** switch, the **Connector** card (Beta: tokens, online status, the one-liner to run on your computer), and what your agents used through the gateway |
| `/keys` | Create and revoke `ohs_…` API keys (shown once) |
| `/docs` | Copy-paste snippets for the OpenAI SDK, curl and JS, plus the live model table |

Ctrl+K opens search across chat titles and message text.

## Stack

Vite · React 19 · TypeScript (strict) · Tailwind 4 · react-router · lucide-react.
Markdown rendering (`react-markdown` + `remark-gfm`) is a lazily loaded chunk, so
it stays out of the initial bundle.

## Development

```bash
npm install
npm run dev        # http://localhost:5173
```

The dev server proxies `/api`, `/v1` and `/health` to `http://127.0.0.1:8000`,
so run the backend (`python -m ohshi serve --reload`) alongside it and the
session cookie just works — one origin, no CORS.

```bash
npm run typecheck  # tsc -b
npm run build      # -> dist/
```

## Production

`Dockerfile` builds the bundle and serves it with **Caddy**, which also proxies
`/api`, `/v1` and `/health` to the backend service — so the browser still sees a
single origin (first-party cookie, no CORS) and chat replies stream through
untouched (`flush_interval -1`). The image idles at ~18 MiB.

| Variable | Default | Notes |
|---|---|---|
| `BACKEND_URL` | `http://ohshi-back.railway.internal:8000` | where Caddy forwards the API paths |
| `PORT` | `8080` | injected by Railway |

Nothing is baked into the bundle at build time — the app calls same-origin
relative paths, so one image works for every environment.

```bash
docker build -t ohshi-frontend .
docker run --rm -p 8080:8080 -e BACKEND_URL=http://host.docker.internal:8000 ohshi-frontend
```

Deploy steps (both services, from scratch) are in the backend repo:
[`docs/DEPLOY.md`](https://github.com/ShageeshanT/ohshi-back/blob/main/docs/DEPLOY.md).

## Layout

```
src/
  App.tsx              auth gate, chat-list context, sidebar shell, routes
  pages/               Chat · Dashboard (Google accounts + usage) · Keys · Docs · Login
  components/          ui primitives, Sidebar, ModelPicker, SearchDialog,
                       ConnectGoogleModal, Markdown (lazy), brand
  lib/                 api.ts (fetch + SSE reader + formatters), chat.ts (types/helpers)
  index.css            design tokens + chat/markdown styling
Caddyfile              static serving + API proxy for production
```

## License

MIT
