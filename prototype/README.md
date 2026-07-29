# Daluyan — Phase 1 Prototype

Working reference implementation of the Phase 1 spec: resident registry → multilingual
templates (+ NTC linter) → two-way keyword SMS → EVAC route-status auto-replies →
operator console with live reply board, triage queue, unreached list → retry/backoff
outbox → full audit log (CSV export).

**Gateway is stubbed by default (MOCK mode)** — you can run a full drill end-to-end with
zero SMS spend using the built-in Phone Simulator.

## Setup (terminal only)

```bash
cd prototype
python -m venv .venv
.venv\Scripts\activate          # Windows;  source .venv/bin/activate on mac/linux
pip install -r requirements.txt
cp .env.example .env             # then edit .env with your provider + API key
```

`.env` is read automatically at startup (real environment variables override it, so
`SMS_PROVIDER=mock python -m daluyan.main` works for a one-off).

## Send ONE test SMS to your own number

```bash
python smstest.py 09171234567
python smstest.py 09171234567 "custom message"
```

Bypasses the registry, zones, retry queue and web console entirely — one message straight
through the configured gateway. Prints provider, credit balance, segment count, and the
result. Guards: rejects malformed numbers, warns on zero balance, rewrites messages starting
with "TEST" (PH networks drop those silently).

```
Provider   : semaphore
Balance    : 200 credits
Recipient  : 09171234567
Length     : 114 chars (1 SMS segment(s))
Sending...
RESULT     : ACCEPTED by semaphore
```

## Run the server

```bash
python -m daluyan.main                    # uses .env
# one-off overrides:
SMS_PROVIDER=iprog python -m daluyan.main         # mac/linux
set SMS_PROVIDER=iprog && python -m daluyan.main  # Windows cmd
$env:SMS_PROVIDER="iprog"; python -m daluyan.main # PowerShell
```

Then open http://127.0.0.1:8787 (console UI at `/ui/`, classic at `/legacy`).

## Build the web console (one time)

```bash
cd frontend && npm install && npm run build && cd ..
```

## New console UI (React + shadcn)

The modern operator console lives in `frontend/` (Vite + React + TypeScript + Tailwind +
shadcn/ui components). One-time build on your machine (needs Node 18+):

1. Run `cd frontend && npm install && npm run build`.
2. Start the server with `python -m daluyan.main` — the new UI is served at **http://127.0.0.1:8787/ui/**
   (the root URL redirects there once a build exists; the old console stays at `/legacy`).

Design: hybrid of task-first flows (big actions, 4-step send wizard, one question per screen)
and a command-console live event board (delivery bar, reply triage, unreached list) that takes
over the home screen while an alert is active. EN/FIL label toggle in the header.

Dev mode: `cd frontend && npm run dev` → http://localhost:5173/ui/ (proxies API to :8787).

## Quick start

Then open http://127.0.0.1:8787

Dependencies: `tornado`, `jinja2`, `requests` (pure-Python; installs anywhere).
The brief allows Node/Express or Python — Tornado was used so the prototype runs with zero
build tooling; porting to FastAPI later is mechanical (handlers are thin).

## 5-minute demo script

1. **Dashboard** — 14 seeded households across 3 zones (2 Cebuano speakers), consent recorded.
2. **Send alert** — template `EVACUATE`, zones `1,2,3`, severity `critical`, route status
   `Open but road affected`, note `use Riverside-Chapel path`. Hit **Preview**: exact
   Filipino + Cebuano SMS, segment counts, linter verdict. Then **SEND WAVE**.
3. **Alert board** — watch delivery tick up live (the mock gateway simulates ~8% transient
   network failures; the retry worker re-sends with exponential backoff).
4. **Phone simulator** — act as any resident. Reply `EVAC` → auto-reply with the
   operator-set route status. Reply `TULONG` → routed as HELP into the red triage queue.
   Reply free text (`nasa bubong kami`) → logged raw as UNRECOGNIZED, never dropped —
   operators must eyeball these (no NLP by design).
5. **Dashboard triage** — HELP/MEDICINE/STRANDED queue with vulnerability flags visible
   (operator-only, never used for automated routing). Mark handled after dispatching tanods.
6. **Alert board lists** — "Unreached" (delivery failed after 5 attempts → door-knock list)
   and "Delivered but no reply" (non-reply is treated as signal, not absence).
7. **Audit log** — every send/reply, exportable CSV (the COA-friendly artifact).

## Free 30-person validation test (no aggregator account needed)

Goal: prove the dashboard really sends and receives SMS, then run a 30-household test — total cost ≈ ₱15.

**Option A — Play-Store-safe, send-only (recommended first): Traccar SMS Gateway**
1. Android phone + SIM with load/unli-text promo.
2. Play Store → **"Traccar SMS Gateway"** (`org.traccar.gateway`, publisher Tananaev Solutions —
   the open-source Traccar project, running since 2009). No sideloading.
3. Open the app, enable the gateway, copy the **cloud token** → double-click `SMS_PROVIDER=traccar`,
   paste the token. Done — the dashboard now sends real SMS through your SIM.
4. Limitation: send-only. Replies won't reach the dashboard (use the Phone simulator for the
   reply flow, or Option B).

**Option B — full two-way, requires sideloading: SMSGate (capcom6)**
Official install is an APK from GitHub releases (docs.sms-gate.app) — NOT on the Play Store;
Android may ask to pause Play Protect. Open-source and auditable, but use a spare phone if
sideloading on your daily phone feels wrong. Setup: app shows login/password →
`SMS_PROVIDER=smsgate SMSGATE_LOGIN=... SMSGATE_PASSWORD=...`; set the app's `sms:received`
webhook to `http://<your-pc-ip>:8787/inbound` (same Wi-Fi) and replies land on the live board.

Either way: send yourself one alert first (a zone containing only your number), then enroll the
30 volunteers (with consent) and run the drill. Messages arrive from the SIM's normal 09xx number —
fine for validation; the registered "BRGY/DALUYAN" sender name comes with the paid aggregator step.

Limits: consumer SIM = keep it ≤30–50 recipients and don't blast repeatedly (telco spam heuristics);
this proves the loop, it does not replace the aggregator bake-off for production waves.

## One-number smoke test (do this first with any paid provider)

Before touching the registry, prove the pipe with a single SMS to your own phone:

- `python smstest.py 09171234567` (see the section above).

It bypasses the registry, zones, retry queue and console entirely — so a green ACCEPTED
means the gateway path a real alert uses is working. Guards built in: rejects malformed
numbers, warns on zero balance, and rewrites messages starting with "TEST" (PH networks
drop those silently).

## Going live (pilot checklist)

1. **Outbound** — three real providers are wired in (pick with `SMS_PROVIDER`, add a
   hot-standby with `SMS_FALLBACK`, e.g. `SMS_PROVIDER=unisms SMS_FALLBACK=semaphore`):
   - `unisms` — unismsapi.com, ₱0.50/₱0.35 VAT-inc, ₱500 min top-up, no expiry, free sender IDs.
     Cheapest documented API (verified 2026-07-15). Young service — bake-off before trusting alone.
   - `philsms` — app.philsms.com, "from ₱0.35", no min top-up, free sender IDs (2–3 day approval).
     Documented Bearer-token API. Rate table is behind signup; two-way claim unverified.
   - `semaphore` — ₱0.56, the proven incumbent; priority route used for `critical` severity.
   ALL of them are outbound-only in practice, and ALL require a REGISTERED sender ID
   (telcos hard-block unregistered alphanumeric IDs since Apr 2025). Register `DALUYAN`/BRGY
   name FIRST — it is the critical path. Cast.ph looks cheap but has NO public API docs yet.
2. **Inbound (pilot)**: spare Android + unli-text SIM running an SMS-gateway app
   (capcom6/android-sms-gateway or httpSMS) → point its webhook at `POST /inbound`
   (accepts capcom6 JSON, generic JSON `{from,message}`, or form data). Graduation path:
   engageSPARK toll-free 22585 number (reverse-billed — free for residents to text).
3. **Governance**: sangguniang barangay resolution adopting Daluyan into the BDRRM plan;
   consent script at enrollment (barangay = personal-information controller, you = processor);
   templates re-written/approved by native speakers + punong barangay (seeded copy is DRAFT).
4. **Hosting**: any always-on host (Railway/Render paid tier — webhooks must not sleep).
   Do NOT expose the console publicly without adding auth (none in this prototype).
5. **Drill**: internal dry run first (simulator), then the live barangay drill against the
   Gate 2 KPIs (≥90% delivery in 10 min, ≥30% reply rate — see MVP Pack §7).

## Env vars

| Var | Default | Meaning |
|---|---|---|
| `SMS_PROVIDER` | semaphore if key set, else mock | mock \| semaphore \| unisms \| philsms \| smsgate |
| `SMS_FALLBACK` | (none) | second provider tried automatically when primary fails |
| `SEMAPHORE_API_KEY` / `SEMAPHORE_SENDER` | — | semaphore.co credentials |
| `UNISMS_API_KEY` / `UNISMS_SENDER` | — | unismsapi.com secret key (Basic auth) + registered sender |
| `PHILSMS_API_TOKEN` / `PHILSMS_SENDER` | — | app.philsms.com Bearer token + registered sender |
| `SMSGATE_LOGIN` / `SMSGATE_PASSWORD` / `SMSGATE_URL` | cloud URL | SMSGate app (sideload; two-way free path) |
| `TRACCAR_TOKEN` / `TRACCAR_URL` | cloud URL | Traccar SMS Gateway app (Play Store; send-only free path) |
| `IPROG_API_TOKEN` | — | IPROG SMS: ₱1/SMS, packages from ₱100, no expiry, free KYC trial credits (Globe/TM/DITO on shared sender; Smart/TNT needs own sender name) |
| `DALUYAN_BRGY` | Brgy Mahogany, Marilao | barangay name in messages |
| `DALUYAN_DB` | ./daluyan.db | SQLite path |
| `DEMO_FAST` | off | retry backoff in seconds (demo) instead of minutes |
| `PORT` | 8787 | web port |

## Layout

```
daluyan/            core package
  main.py           routes + console (Tornado)
  db.py             5 flat tables + seed (schema in one screen)
  keywords.py       SAFE/EVAC/HELP/MEDICINE/STRANDED + Tagalog/Cebuano aliases
  linter.py         NTC MO 005-04-2023 + safety-copy rules (blocks links/numbers/"all clear")
  gateway.py        MockGateway / SemaphoreGateway adapters
  retry.py          outbox worker: exponential backoff, max 5, then UNREACHED
templates/          Jinja2 console pages (server-rendered, no build step)
```

Phase 1 guardrails honored: no app, no AI voice, no NLP, no payments, flags never automated,
no "all clear" copy possible (linter blocks it), every message cites source + as-of time.
