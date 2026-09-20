<img src="https://capsule-render.vercel.app/api?type=waving&color=141210&height=230&section=header&text=STOCKPROOF&fontSize=62&fontColor=D9A441&fontAlignY=36&desc=Grain%20warehouse%20stock%20verification%20for%20agricultural%20credit&descSize=17&descAlignY=62&animation=fadeIn" alt="STOCKPROOF header" width="100%" />

<div align="center">

<a href="https://git.io/typing-svg"><img src="https://readme-typing-svg.demolab.com?size=25&duration=3000&pause=1300&color=D9A441&center=true&vCenter=true&width=640&lines=Is+the+grain+really+there%3F;Geometry+in%2C+defensible+range+out.;Never+false+precision.;One+photo+against+the+paper+receipt." alt="typing story" /></a>

<br />

<img src="https://img.shields.io/badge/React-19-141210?style=flat&logo=react&logoColor=D9A441" alt="React 19" />
<img src="https://img.shields.io/badge/Vite-6-141210?style=flat&logo=vite&logoColor=D9A441" alt="Vite 6" />
<img src="https://img.shields.io/badge/Tailwind-4-141210?style=flat&logo=tailwindcss&logoColor=D9A441" alt="Tailwind 4" />
<img src="https://img.shields.io/badge/Express-API-141210?style=flat&logo=express&logoColor=D9A441" alt="Express" />
<img src="https://img.shields.io/badge/Redis-store-141210?style=flat&logo=redis&logoColor=D9A441" alt="Redis" />
<img src="https://img.shields.io/badge/Node-20%2B-141210?style=flat&logo=node.js&logoColor=D9A441" alt="Node 20+" />
<img src="https://img.shields.io/badge/License-Apache--2.0-141210?style=flat&logoColor=D9A441" alt="Apache 2.0" />

<br />
<br />

<img src="https://images.unsplash.com/photo-1574323347407-f5e1ad6d020b?auto=format&fit=crop&w=1600&q=80" alt="Golden wheat pile at rest" width="100%" />

*Warehouse-receipt verification for agricultural credit — banks, NBFCs, FPOs, and field auditors use it to confirm that the grain backing a loan physically exists, in the quantity the receipt claims.*

</div>

---

## 🧭 Journey

- [🎭 The problem](#-the-problem)
- [⚖️ The solution](#️-the-solution)
- [🌾 Season curves](#-season-curves)
- [✨ Features](#-features)
- [🧱 Tech stack](#-tech-stack)
- [🗂️ Project structure](#️-project-structure)
- [🚀 Run locally](#-run-locally)
- [🔑 Environment variables](#-environment-variables)
- [☁️ Deploy to Vercel](#️-deploy-to-vercel)
- [🔌 API overview](#-api-overview)

---

## 🎭 The problem

> Commodity collateral disappears in **boring, physical ways** — not through clever financial engineering.

| 🎭 Fraud vector | How it works |
|---|---|
| **Hollow-core stacking** | Bags stacked around empty drums or pallets. Looks full from the doorway; the center is air. |
| **Moisture inflation** | Grain received at 18–19% moisture inflates weighbridge tickets, then evaporates down to 12% in storage — tonnes vanish while the paper stays the same. |
| **Double-pledged receipts** | One 100-tonne heap pledged to three different banks. No lender reconciles against the others. |

The result is a **warehouse blind spot**: weeks or months between disbursement and anyone physically re-checking the stock.

---

## ⚖️ The solution

Every verification run follows one defensible pipeline — **geometry in, defensible range out, never false precision**:

| Step | What happens |
|---|---|
| 📸 **1 · Optical ground truth** | Auditor captures the heap (photo or video frame) with a reference scale; pile geometry (height, base/top diameter, cone vs frustum) is measured or laser/AR-assisted. |
| 📐 **2 · Volume** | Cone `V = ⅓πr²h` or frustum `V = ⅓πh(r₁² + r₁r₂ + r₂²)` (see the in-app Physics explainer). |
| 🌾 **3 · Agronomic physics engine** (`server/estimation-service.ts`) | Base bulk density per crop (wheat 0.77, paddy 0.75, maize 0.72, soybean 0.77, pulses 0.80, barley 0.62 t/m³), corrected for moisture, compaction, storage duration, **and season**. |
| ⚖️ **4 · Honest output** | A tonnage *range* with a confidence score, compared against the declared receipt (see verdicts below). |

**Verdicts**

| | Meaning |
|---|---|
| 🟢 `consistent` | Declared tonnage sits inside physical bounds. |
| 🟡 `review` | Touches or slightly exceeds the bounds. |
| 🔴 `high_priority` | Exceeds the upper bound by > 5% (classic over-declaration). Mismatches auto-open items in the review queue. |

> The system **supports the auditor — it never replaces the physical audit**.
> No model can smell fermentation or feel gravel under a tarp; STOCKPROOF just triages auditor time toward statistical outliers.

---

## 🌾 Season curves

The same photo fill reads differently by season:

| Season | Air | Settling | Typical humidity |
|---|---|---|---|
| 🌧️ **Kharif** (monsoon) | Humid, fast settling | ~1.4%/30d | 13.0–15.5% |
| ❄️ **Rabi** (winter, reference) | Dry, stable, slow settling | ~1.1%/30d | 11.0–13.0% |
| ☀️ **Zaid** (summer) | Hot, dry, aerated, loose | ~0.8%/30d | 9.5–12.0% |

---

## ✨ Features

- 🎬 **Marketing landing** — hero, live audit specimen, field case records, fraud vectors, agronomic matrix, plans, auditor testimonials, Partner CTA.
- 🖥️ **Audit console** — portfolio summary (exposure in ₹ Cr, tonnage at risk), warehouse ledger with status filters and search.
- 📝 **4-step verification flow** — capture → geometry → context (crop, season, moisture, compaction, storage days) → defensible estimate with plain-language reasoning and audit recommendation.
- 🧾 **Review queue** — resolve / escalate / annotate flagged verifications.
- 🖨️ **Reports** — printable audit ledger + CSV export.
- 📴 **Offline-first** — field cache for silo dead-zones; records sync when connectivity returns. Demo data resets from the console.

---

## 🧱 Tech stack

| Layer | Choice |
|---|---|
| Frontend | React 19, Vite 6, Tailwind CSS 4, Motion, Lenis smooth scroll |
| Backend (local) | Express (`server.ts`), JSON file store (`data/storage.json`) |
| Backend (Vercel) | Serverless functions in `api/`, Redis-backed store (`lib/persistentStore.ts`) |
| Persistence | Upstash Redis on Vercel (Vercel Marketplace Redis); file store locally |
| API contract | Same-origin `fetch('/api/…')` — no CORS, no hardcoded hosts |

---

## 🗂️ Project structure

<details>
<summary><i>Click to unfold the map</i></summary>

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

</details>

---

## 🚀 Run locally

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

---

## 🔑 Environment variables

See `.env.example`. All optional for a local demo:

| Variable | Purpose |
|---|---|
| `GEMINI_API_KEY` | AI-assisted flows (injected by host when used) |
| `APP_URL` | Public URL (callbacks, self-links) |
| `KV_REST_API_URL` / `KV_REST_API_TOKEN` | Upstash/Vercel Redis — makes data persist on Vercel. Without them the API runs on seeded in-memory storage |
| `PORT` | Express listen port (default `3000`; ignored on Vercel) |

---

## ☁️ Deploy to Vercel

```bash
vercel        # preview deploy
vercel --prod # production deploy
```

Then in the Vercel dashboard:

1. **Connect Git** — Project → Settings → Git → connect this repo. Every `git push` to `main` then auto-deploys production; PRs get preview URLs.
2. **Add persistence** — Storage tab → Create **Redis** → Connect to the project (injects `KV_REST_API_*`). Redeploy once.
3. **Verify** — `GET /api/health` should report `"storage": "redis"`.

> Local `data/storage.json` never leaves your machine (git-ignored). On Vercel without Redis, data is per-instance memory that reseeds on cold start — fine for demos, not for real ledgers.

---

## 🔌 API overview

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

<div align="center">

*The system supports the auditor — it never replaces the physical audit.*

*Working prototype for field-demo use. Agronomic tables reference USDA/FAO standards; estimates are decision-support ranges, not certified weighments.*

</div>

<img src="https://capsule-render.vercel.app/api?type=waving&color=141210&height=120&section=footer&animation=fadeIn" alt="footer wave" width="100%" />
