# Plan Review Checklist (021)

Run this checklist as a P0 gate before accepting the plan and
starting implementation.

---

## Constitution compliance

- [ ] No new external dependencies introduced (constitution: "New
      dependencies require justification")
- [ ] No analytics, tracking, or third-party data sharing added
      (constitution: "Local-first; no external analytics or tracking")
- [ ] Local mode behavior is preserved unchanged (the plan applies
      hardening to hosted only; local-mode `PARSE_FAILED` sanitization
      is a benign inherited improvement)
- [ ] Required-field validation is unchanged (this feature does not
      touch application or profile data models)
- [ ] Testing requirements covered: every FR has at least one paired
      automated test (FR-001 through FR-013)
- [ ] Release Prep is included as a final-2 phase (Phase 06)
      per Amendment 1.3.0
- [ ] Browser Smoke Test is not required (no UI changes; documented
      decision in `research.md §10`)

## Spec ↔ plan alignment

- [ ] Every spec FR (001–013) is addressed by at least one phase or
      explicitly mapped to existing code/test infrastructure
- [ ] Every spec SC (001–010) has a clear test pinning it
- [ ] Spec edge cases are accounted for in `research.md` or
      `contracts/api.md`
- [ ] Non-goals are not silently expanded in the plan

## Architecture decisions

- [ ] The PARSE_FAILED catch is **scoped to the resume route** —
      does not modify `server/index.js`'s global 500 handler
- [ ] The server-side log shape uses a redacted filename
      (`nameSha8`), not the raw filename
- [ ] The fs-spy regression test covers all plausible write APIs
      (`fs.writeFile`, `fs.writeFileSync`, `fs.createWriteStream`,
      `fs.open`, `fs.promises.writeFile`)
- [ ] The hosted-no-token regression test uses the existing
      `createApp({ requireAuth: stubReject })` pattern from
      `tests/server/routes-protected.test.js` — does not require a
      live Supabase project
- [ ] The service-role-key grep test runs via vitest +
      `fs.readFileSync`, not a shell script (cross-platform)
- [ ] `contracts/api.md` documents the four-layer defense, the
      explicit guarantees, and the explicit non-guarantees

## Risks

- [ ] Risk 1 (masking unexpected errors) — mitigated by server-side
      logging via `console.error`; accepted with documented tradeoff
- [ ] Risk 2 (test brittleness around library error strings) —
      mitigated by asserting fixed message string positively
- [ ] Risk 3 (fs-spy false negatives via alternative APIs) — accepted
      residual; documented in `plan.md §Risks` and `research.md §7`
- [ ] Risk 4 (global 500 handler still echoes `err.message`) —
      flagged in `research.md §11.1` as future work; out of scope per
      spec Non-Goal §2

## Out-of-scope discipline

- [ ] Plan does not touch local-mode auth
- [ ] Plan does not modify the global 500 handler in `server/index.js`
- [ ] Plan does not introduce malware scanning, OCR, cloud storage,
      export, or rate limiting
- [ ] Plan does not change the parsed-data response shape (only
      adds a new error code)

## Quality gates (deferred to implementation phases)

- [ ] `npm run test:run` exits clean at the end of every phase
- [ ] `npm run lint` exits clean at the end of every phase
- [ ] No new ESLint warnings introduced (existing pre-feature
      allowlist tolerated)

## Release prep readiness (Phase 06)

- [ ] Version bump target identified: 0.10.0 → 0.11.0 (MINOR; new
      error code is additive)
- [ ] CHANGELOG entry drafted with Added / Changed / Internal blocks
      per the project convention
- [ ] README current-version line updated
- [ ] `docs/REPO_MAP.md` — new row for `specs/021-…/contracts/api.md`
- [ ] `docs/deployment.md` — no change needed (no new env vars, no
      new runtime modes)

---

## Sign-off

- [ ] All P0 items above are checked
- [ ] Any unchecked item has a documented reason in the PR description

Reviewer: ____
Date: ____
