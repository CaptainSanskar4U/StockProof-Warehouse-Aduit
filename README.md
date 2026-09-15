# STOCKPROOF — Grain Warehouse Stock Verification

> **Is the grain *really* there?** Farmers borrow money against grain stored in
> warehouses. Sometimes the paper says 100 tonnes and the heap is smaller.
> StockProof checks a phone photo of the heap against the paper — before the
> bank lends.

STOCKPROOF is a warehouse-receipt verification layer for agricultural credit:
banks, NBFCs, FPOs, and field auditors use it to confirm that the grain
backing a loan physically exists, in the quantity the receipt claims.

---

## The problem

Commodity collateral disappears in boring, physical ways — not through clever
financial engineering:

| Fraud vector | How it works |
|---|---|
| **Hollow-core stacking** | Bags stacked around empty drums or pallets. Looks full from the doorway; the center is air. |
| **Moisture inflation** | Grain received at 18–19% moisture inflates weighbridge tickets, then evaporates down to 12% in storage — tonnes vanish while the paper stays the same. |
| **Double-pledged receipts** | One 100-tonne heap pledged to three different banks. No lender reconciles against the others. |

The result is a **warehouse blind spot**: weeks or months between disbursement
and anyone physically re-checking the stock.

## The solution

Every verification run follows one defensible pipeline — **geometry in,
defensible range out, never false precision**:

1. **Optical ground truth** — auditor captures the heap (photo or video frame)
   with a reference scale; pile geometry (height, base/top diameter, cone vs
   frustum) is measured or laser/AR-assisted.
2. **Volume** — cone `V = ⅓πr²h` or frustum
   `V = ⅓πh(r₁² + r₁r₂ + r₂²)` (see the in-app Physics explainer).
3. **Agronomic physics engine** (`server/estimation-service.ts`) — base bulk
   density per crop (wheat 0.77, paddy 0.75, maize 0.72, soybean 0.77,
   pulses 0.80, barley 0.62 t/m³), corrected for moisture, compaction, storage
   duration, **and season** (Kharif packs fast and humid, Zaid stays dry and
   aerated — the same photo fill reads differently).
4. **Honest output** — a tonnage *range* with a confidence score, compared
   against the declared receipt:
   - `consistent` — declared tonnage sits inside physical bounds.
   - `review` — touches or slightly exceeds the bounds.
   - `high_priority` — exceeds the upper bound by > 5% (classic
     over-declaration). Mismatches auto-open items in the review queue.

The system **supports the auditor — it never replaces the physical audit**.
No model can smell fermentation or feel gravel under a tarp; STOCKPROOF just
triages auditor time toward statistical outliers.

---

## Features

- **Marketing landing** — hero, live audit specimen, field case records, fraud
  vectors, agronomic matrix, plans, auditor testimonials, Partner CTA.
- **Audit console** — portfolio summary (exposure in ₹ Cr, tonnage at risk),
  warehouse ledger with status filters and search.
- **4-step verification flow** — capture → geometry → context (crop, season,
  moisture, compaction, storage days) → defensible estimate with
  plain-language reasoning and audit recommendation.
- **Review queue** — resolve / escalate / annotate flagged verifications.
- **Reports** — printable audit ledger + CSV export.
- **Offline-first** — field cache for silo dead-zones; records sync when
  connectivity returns. Demo data resets from the console.

## Tech stack

| Layer | Choice |
|---|---|
| Frontend | React 19, Vite 6, Tailwind CSS 4, Motion, Lenis smooth scroll |
| Backend (local) | Express (`server.ts`), JSON file store (`data/storage.json`) |
| Backend (Vercel) | Serverless functions in `api/`, Redis-backed store (`lib/persistentStore.ts`) |
| Persistence | Upstash Redis on Vercel (Vercel Marketplace Redis); file store locally |
| API contract | Same-origin `fetch('/api/…')` — no CORS, no hardcoded hosts |

## Project structure

```
├── api/                    # Vercel serverless functions (one per route)
├── lib/
│   ├── persistentStore.ts  # Redis-backed store (memory fallback, seeded)
│   └── apiHelpers.ts       # Method guards, body parsing, season defaults
├── server/
│   ├── store.ts            # Local Express file store (seed data lives here)
│   └── estimation-service.ts  # Pure physics engine (shared by both backends)
├── src/
│   ├── components/         # Console views (Dashboard, VerificationFlow, …)
│   ├── components/landing/ # Landing sections (Hero, Specimen, PartnerCTA, …)
│   ├── services/api.ts     # Typed fetch client (API_BASE = '/api')
│   └── seasonProfiles.ts   # Kharif / Rabi / Zaid calibration curves
├── data/storage.json       # Local dev database (seeded, git-ignored pattern)
├── server.ts               # Express app (dev + non-Vercel hosts)
└── vercel.json             # Build (vite → dist), SPA rewrites, function limits
```

## Run locally

**Prerequisites:** Node.js 20+

```bash
npm install
npm run dev        # Express + Vite middleware on http://localhost:3000
```

| Command | What it does |
|---|---|
| `npm run dev` | Dev server (Express API + Vite HMR) |
| `npm run lint` | `tsc --noEmit` type check |
| `npm run build` | `vite build` + bundle `server.ts` → `dist/` |
| `npm start` | Serve production build (`NODE_ENV=production`) |

## Environment variables

See `.env.example`. All optional for a local demo:

| Variable | Purpose |
|---|---|
| `GEMINI_API_KEY` | AI-assisted flows (injected by host when used) |
| `APP_URL` | Public URL (callbacks, self-links) |
| `KV_REST_API_URL` / `KV_REST_API_TOKEN` | Upstash/Vercel Redis — makes data persist on Vercel. Without them the API runs on seeded in-memory storage |
| `PORT` | Express listen port (default `3000`; ignored on Vercel) |

## Deploy to Vercel

```bash
vercel        # preview deploy
vercel --prod # production deploy
```

Then in the Vercel dashboard:

1. **Connect Git** — Project → Settings → Git → connect this repo.
   Every `git push` to `main` then auto-deploys production; PRs get preview URLs.
2. **Add persistence** — Storage tab → Create **Redis** → Connect to the
   project (injects `KV_REST_API_*`). Redeploy once.
3. **Verify** — `GET /api/health` should report `"storage": "redis"`.

> Local `data/storage.json` never leaves your machine (git-ignored). On Vercel
> without Redis, data is per-instance memory that reseeds on cold start — fine
> for demos, not for real ledgers.

## API overview

| Method & path | Description |
|---|---|
| `GET /api/health` | Liveness + storage backend (`redis`/`memory`) |
| `GET /api/warehouses?status=&search=` | Warehouse ledger |
| `GET /api/warehouses/:id` | Single warehouse |
| `GET /api/verifications?warehouseId=` | Verification runs |
| `POST /api/verifications/estimate` | Sandbox estimate (no save) |
| `POST /api/verifications` | Commit a verification run (auto-queues reviews) |
| `GET /api/verifications/latest` | Latest run per warehouse |
| `GET /api/reviews?status=` | Review queue |
| `PATCH /api/reviews/:id` | Resolve / escalate / annotate |
| `GET /api/portfolio-summary` | Exposure, tonnage at risk, flag counts |
| `POST /api/reset-demo` | Reseed demo data |
| `GET /api/grain-profiles`, `GET /api/season-profiles` | Reference tables |

---

*Working prototype for field-demo use. Agronomic tables reference USDA/FAO
standards; estimates are decision-support ranges, not certified weighments.*
