# Plan Review Checklist (021)

Run this checklist as a P0 gate before accepting the plan and
starting implementation.

---

## Constitution compliance

- [X] No new external dependencies introduced (constitution: "New
      dependencies require justification")
- [X] No analytics, tracking, or third-party data sharing added
      (constitution: "Local-first; no external analytics or tracking")
- [X] Local mode behavior is preserved unchanged (the plan applies
      hardening to hosted only; local-mode `PARSE_FAILED` sanitization
      is a benign inherited improvement)
- [X] Required-field validation is unchanged (this feature does not
      touch application or profile data models)
- [X] Testing requirements covered: every FR has at least one paired
      automated test (FR-001 through FR-013)
- [X] Release Prep is included as a final-2 phase (Phase 06)
      per Amendment 1.3.0
- [X] Browser Smoke Test is not required (no UI changes; documented
      decision in `research.md §10`)

## Spec ↔ plan alignment

- [X] Every spec FR (001–013) is addressed by at least one phase or
      explicitly mapped to existing code/test infrastructure
- [X] Every spec SC (001–010) has a clear test pinning it
- [X] Spec edge cases are accounted for in `research.md` or
      `contracts/api.md`
- [X] Non-goals are not silently expanded in the plan

## Architecture decisions

- [X] The PARSE_FAILED catch is **scoped to the resume route** —
      does not modify `server/index.js`'s global 500 handler
- [X] The server-side log shape uses a redacted filename
      (`nameSha8`), not the raw filename
- [X] The fs-spy regression test covers all plausible write APIs
      (`fs.writeFile`, `fs.writeFileSync`, `fs.createWriteStream`,
      `fs.open`, `fs.promises.writeFile`)
- [X] The hosted-no-token regression test uses the existing
      `createApp({ requireAuth: stubReject })` pattern from
      `tests/server/routes-protected.test.js` — does not require a
      live Supabase project
- [X] The service-role-key grep test runs via vitest +
      `fs.readFileSync`, not a shell script (cross-platform)
- [X] `contracts/api.md` documents the four-layer defense, the
      explicit guarantees, and the explicit non-guarantees

## Risks

- [X] Risk 1 (masking unexpected errors) — mitigated by server-side
      logging via `console.error`; accepted with documented tradeoff
- [X] Risk 2 (test brittleness around library error strings) —
      mitigated by asserting fixed message string positively
- [X] Risk 3 (fs-spy false negatives via alternative APIs) — accepted
      residual; documented in `plan.md §Risks` and `research.md §7`
- [X] Risk 4 (global 500 handler still echoes `err.message`) —
      flagged in `research.md §11.1` as future work; out of scope per
      spec Non-Goal §2

## Out-of-scope discipline

- [X] Plan does not touch local-mode auth
- [X] Plan does not modify the global 500 handler in `server/index.js`
- [X] Plan does not introduce malware scanning, OCR, cloud storage,
      export, or rate limiting
- [X] Plan does not change the parsed-data response shape (only
      adds a new error code)

## Quality gates (deferred to implementation phases)

- [X] `npm run test:run` exits clean at the end of every phase
- [X] `npm run lint` exits clean at the end of every phase
- [X] No new ESLint warnings introduced (existing pre-feature
      allowlist tolerated)

## Release prep readiness (Phase 06)

- [X] Version bump target identified: 0.10.0 → 0.11.0 (MINOR; new
      error code is additive)
- [X] CHANGELOG entry drafted with Added / Changed / Internal blocks
      per the project convention
- [X] README current-version line updated
- [X] `docs/REPO_MAP.md` — new rows for `specs/021-…/*` added; the
      same backfill also added missing rows for 019 and 020 so the
      Spec Packages section is now consistent across 018–021
- [X] `docs/deployment.md` — no change needed (no new env vars, no
      new runtime modes)

---

## Sign-off

- [X] All P0 items above are checked
- [X] Any unchecked item has a documented reason in the PR description
      *(N/A — no items left unchecked)*

**Note on REPO_MAP backfill**: Task 06.4 of `tasks.md` had an escape
clause that allowed deferring the row addition if 019 and 020 had
not been added either. During Phase 06 finalization the decision
was made to backfill all three features at once (019, 020, 021)
rather than continue deferring, so the Spec Packages section in
`docs/REPO_MAP.md` is now consistent across features 018–021.

Reviewer: Phase 06 implementation pass (Claude Code) — Codex review pending
Date: 2026-05-20
