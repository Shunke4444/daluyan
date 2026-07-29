# Deploying Daluyan (live showcase)

The app is one always-on service: **Python (Tornado)** serves the JSON API, the two-way
SMS webhook (`/inbound`), and the built React console at `/ui/`. A `Dockerfile` at the repo
root builds the frontend and packages everything into one image, so Railway and Render both
deploy it with zero dashboard config.

Default gateway is **MOCK** — no SMS spend. The whole drill runs off the built-in phone
simulator. Add provider keys later (see below) to send real messages.

## Why not Vercel?

Vercel is serverless + static. This backend needs a long-lived process (the retry/backoff
worker), a persistent inbound webhook, and on-disk SQLite — none survive on serverless.
Use an always-on host.

---

## Option A — Railway (recommended)

1. Push this repo to GitHub (already on `origin/main`).
2. railway.app → **New Project → Deploy from GitHub repo** → pick this repo.
3. Railway detects the root `Dockerfile` and builds. No start command needed
   (`CMD python -m daluyan.main` is baked in). Railway injects `$PORT`; the app reads it.
4. **Settings → Networking → Generate Domain** → that URL is your showcase link
   (root redirects to `/ui/`).

## Option B — Render

1. render.com → **New → Web Service** → connect the repo.
2. Runtime **Docker** (auto-detected from the Dockerfile). Region/name as you like.
3. Instance type: use a **paid/Starter** plan for the showcase — the free tier sleeps after
   ~15 min idle, and a slept service drops the retry worker + inbound webhook.
4. Deploy → the `onrender.com` URL is your link.

---

## Env vars (set in the host dashboard)

| Var | For the showcase | Meaning |
|---|---|---|
| `DEMO_FAST` | `1` (already default in Dockerfile) | retry backoff in seconds, not minutes |
| `DALUYAN_BRGY` | your barangay name | shown in messages |
| `SMS_PROVIDER` | leave unset = `mock` | `mock \| semaphore \| unisms \| philsms \| smsgate` |
| `PORT` | leave unset | injected by the platform |

### Going live with real SMS (later)
Set `SMS_PROVIDER` + that provider's keys (see `prototype/README.md` → Env vars), and point
your SMS-gateway app / aggregator webhook at `https://<your-domain>/inbound`. A **registered
sender ID** is the critical path — telcos hard-block unregistered alphanumeric IDs.

## Data persistence (optional)

SQLite (`daluyan.db`) lives on the container's ephemeral disk — it **reseeds fresh on every
restart/redeploy**. Fine for a demo. To persist across restarts, attach a volume and point the
DB at it: mount a volume at e.g. `/data`, set `DALUYAN_DB=/data/daluyan.db`.

## Local build check (optional)

With Docker Desktop running:

```bash
docker build -t daluyan .
docker run -p 8787:8787 daluyan
# open http://127.0.0.1:8787/ui/
```
