# Quickstart: Hosted Startup Performance

**Feature**: [plan.md](./plan.md) · **Date**: 2026-07-04

How to build, measure, and verify 044. Runtime changes are **hosted-only**; a plain local checkout will not reproduce the cold-start behavior.

---

## Prerequisites
- **042 (Welcome & Brand Refresh) merged first** — WS1 reuses its `alice-sigil-full.svg` + Sora setup.
- Node deps installed in this worktree (`npm install` — already done for the 044 worktree).
- A hosted (Vercel + Supabase) deployment for real FCP/LCP; local mode is for logic/unit verification only.

## Commands
```bash
npm run test:run     # Vitest unit/integration (boot, loader, navigate, skeleton)
npm run lint         # eslint (no `npm run format` exists in this repo)
npm run build        # Vite production build (bundle chunks for WS4 verification)
npm run dev          # local dev (logic only — not representative of hosted cold start)
```

## WS0 — Capture the baseline (do this first, and after each phase)
- **Field**: read Speed Insights p75 FCP/LCP/CLS/INP/TTFB from the hosted deployment.
- **Lab**: DevTools → Performance → **cold** load (disable cache, throttle if standardizing). Segment: TTFB, bundle download, parse/exec, `/api/health`, `getSession`, Tracker fetch. Record **cold vs. warm** `/api/health` separately.
- Write the numbers into [metrics.md](./metrics.md) as the `baseline` row.

## Per-phase verification walkthrough
- **WS1 (loader)**: hosted cold load with cache disabled → branded loader paints before the bundle finishes; no blank white page. Confirm the glow is static (no motion at any breakpoint) and, under `prefers-reduced-motion`, the loader→app swap is instant (no crossfade). Re-measure (expect FCP ~8s → ~1s, LCP roughly unchanged).
- **WS2 (handshake)**: signed-out cold load → loader → Welcome without waiting on `/api/health`. Remove hosted env vars → ConfigError with no Welcome/app flash. Block `/api/health` + session → after ~10s, Retry (full reload). Re-measure (expect LCP drop, signed-out especially).
- **WS3 (skeleton)**: signed-in cold load → shell + Tracker skeleton before data → rows replace skeleton on data arrival, no blank gap.
- **WS4 (lazy-load)**: `npm run build`; confirm `Calendar`/`Profile`/`ProfileEdit` are separate chunks and `Tracker` is in the initial chunk. Navigate rapidly between routes (latest-wins holds). Simulate a stale chunk (404) → reload fallback fires.
- **WS5 (fonts)**: confirm no render-blocking `fonts.googleapis.com` stylesheet on the critical path; loader background + sigil paint independent of Sora.

## Definition of done (feature)
- All Independent Tests (US0–US8 in [spec.md](./spec.md)) pass in a real browser against the to-be-merged state.
- [metrics.md](./metrics.md) shows a documented, measured FCP/LCP improvement vs. baseline (targets directional; cold-start floor noted).
- `npm run test:run` and `npm run lint` clean; `npm run build` succeeds.
- Release Prep done (version bump from post-042 baseline, CHANGELOG, README, roadmap tick, REPO_MAP for new files, deployment.md if runtime/env changed).
