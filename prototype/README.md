# Daluyan — Phase 1 Prototype

Working reference implementation of the Phase 1 spec: resident registry → multilingual
templates (+ NTC linter) → two-way keyword SMS → EVAC route-status auto-replies →
operator console with live reply board, triage queue, unreached list → retry/backoff
outbox → full audit log (CSV export).

**Gateway is stubbed by default (MOCK mode)** — you can run a full drill end-to-end with
zero SMS spend using the built-in Phone Simulator.

## Quick start

Windows: double-click `run.bat`  (needs Python 3.10+ on PATH)
Mac/Linux: `./run.sh`

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

## Going live (pilot checklist)

1. **Outbound**: Semaphore account → register a `BRGY…` sender ID (needs the barangay
   resolution; ≤5 business days) → set env `SEMAPHORE_API_KEY` + `SEMAPHORE_SENDER`.
   Semaphore is **outbound-only** (verified Jul 2026) — it cannot receive SMS.
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
| `SEMAPHORE_API_KEY` | (unset → MOCK mode) | live outbound via Semaphore |
| `SEMAPHORE_SENDER` | account default | registered sender name |
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
