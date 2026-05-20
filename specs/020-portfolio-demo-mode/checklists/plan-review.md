# Plan Review Checklist — 020 Portfolio Demo Mode

Reviewed before `/speckit.tasks` generates the task breakdown. Each item
maps to a constitutional principle, an FR/SC pairing in spec.md, or a
risk in plan.md. A single unchecked P0 item blocks task generation.

---

## P0 — Must be resolved before tasks

- [x] **Spec ↔ plan consistency**: every FR in spec.md is addressed by
  at least one concrete element in plan.md (file, contract, test, or
  data shape). Verified during spec review.
- [x] **Limited, bounded server work**: server changes are confined to
  two categories — (a) **deletions** of the dead `APP_RUNTIME=demo`
  scaffolding reserved by 019 (FR-016, Phase 01), and (b) a small
  **data-only extraction** of `DEMO_RECORDS` / `DEMO_PROFILE` to
  side-effect-free modules under `server/seeds/` to unblock the
  parity test (Task 02.0). 019's `local` and `hosted` dispatcher
  branches, Supabase adapters, RLS policies, route handlers, and
  starter seed are byte-equivalent post-020.
- [x] **Server cleanup complete and consistent**: Phase 01 deletes every
  reference to `'demo'` in `VALID_RUNTIMES`, `config.isDemo`,
  `DemoRepositoryNotImplementedError`, `createDemoStub`, and the
  related test/doc lines. Booting with `APP_RUNTIME=demo` after 020
  produces the standard "Invalid APP_RUNTIME" error naming `local`
  and `hosted` (Task 10.7 smoke-verifies). Search invariant after
  merge: `grep -rin "APP_RUNTIME=demo\|DemoRepositoryNotImplementedError\|createDemoStub\|isDemo" server/ tests/server/ docs/`
  returns zero hits.
- [x] **No new persistent storage for demo content**: Tasks 02.2 +
  02.3 confirm `demoStore` is module-level state only and the test
  spies assert zero `localStorage.setItem` / `sessionStorage.setItem` /
  `indexedDB.open` calls across a full CRUD pass. Task 05.4
  additionally gates `apptracker_filters` so no project-namespaced
  `localStorage` write happens during a demo session.
- [x] **No-network-in-demo test contract**: Task 04.3 mandates
  `globalThis.fetch` spies across every `services/api.js` and
  `services/resumeApi.js` export with `authStore` stubbed to
  `'demo'` — fetch must never be called. This is the canonical
  regression guard called out in [plan.md](../plan.md) risk #1.
- [x] **`requireAuth` defense in depth preserved**: Phase 01 changes
  do not touch `server/auth/middleware.js`, `server/routes/*`, or any
  protected route's auth flow. The dispatcher and `assertHostedSchema`
  edits remove only the `demo` runtime branch.
- [x] **Validation reuse**: Task 02.2 explicitly reuses
  `normalizeApplication` + `validateApplication` from
  `src/models/application.js`, and the profile model from
  `src/models/profile.js`. No demo-specific rules.
- [x] **Required application fields enforced**: Task 02.1's seed
  fixture satisfies all constitution-required fields (company, title,
  status, last status update, responsibilities) on every seeded row;
  demo writes route through the same validators (Task 02.2).
- [x] **Resume Import gating in demo**: `src/components/ResumeImport.js`
  promotes the existing `VISIBLE_STATUSES` `const` to an **export**
  so the demo test can assert `!VISIBLE_STATUSES.has(DEMO_STATUS)` as
  a design-by-contract guard (Task 07.2). The inline replacement note
  is placed in the `ProfileEdit.js` slot (Task 07.1) with the agreed
  copy "Resume import is available after signing in."
- [x] **Refresh-as-reset is the mechanism**: demo state is module-level
  JS only (Task 02.2); `authStore.init()` has no demo restore path
  (Task 03.1); refresh reinitializes the bundle and returns the
  visitor to `'unauthenticated'`.
- [x] **Authenticated regression**: plan §Validation Approach calls
  out that existing Tracker/Modal/Profile/ProfileEdit tests and
  post-019 server runtime tests pass without modification. The
  server tests modified by Phase 01 (config, dispatcher, stubs,
  health) and the seed scripts modified by Task 02.0 are explicitly
  scoped deletions / refactors that preserve runtime behavior.
- [x] **Release Prep + Browser Smoke Test phases**: tasks.md ends with
  Phase 09 (Release Prep — version bump, CHANGELOG, README,
  deployment docs, REPO_MAP) followed by Phase 10 (Browser Smoke
  Test, six user stories + the `APP_RUNTIME=demo` rejection check),
  in that order. Constitution Amendments 1.1.0 + 1.3.0.

---

## P1 — Should be resolved before tasks; document residual risk if not

- [x] **`apptracker_filters` localStorage write**: **gate it.** Task 05.4
  applies an early-return on `status === 'demo'` inside both
  `persistFilterState` and `loadPersistedFilterState`. See
  [research.md §10](../research.md).

   *Decision*: Gate on `status !== 'demo'` (zero `localStorage` writes during demo).

- [x] **Demo mode badge / banner**: **ship the compact Navbar badge.**
  Task 06.1 implements badge + Exit demo button as one render branch.

   *Decision*: Compact "Demo mode" badge adjacent to the Exit demo button in `renderIdentityCluster`.

- [x] **Resume-import inline note copy**: copy fixed in Task 07.1.

   *Final copy*: "Resume import is available after signing in."

- [x] **Exit demo button copy + accessibility**: label is **Exit demo**;
  `aria-label` is `"Exit demo"`; visual treatment parallel to the
  existing Sign-out button via reused `createDoorArrowIcon()`. Task 06.1.

- [x] **Seed fixture mirrors SQLite seed**: per data-model.md §3 and
  research.md §13, the demo applications mirror the 23 records (now
  imported from `server/seeds/applicationsData.js`'s `DEMO_RECORDS`)
  translated to frontend shape, with dates shifted relative to today.
  The demo profile mirrors `DEMO_PROFILE` (now in
  `server/seeds/profileData.js`) verbatim.
- [x] **Parity test wired**: Task 02.3 includes the parity assertions
  (length === 23; index-aligned `(companyName, jobTitle, status)`
  triples; `getProfile()` deep-equals `DEMO_PROFILE`) routed through
  `getAll()` / `getProfile()` (not the module-private state).

---

## P2 — Optional / future-watch

- [ ] **Service-method discipline note in CLAUDE.md**: consider adding a
  one-line rule that "new service methods in `src/services/api.js` must
  include the demo branch and an assertion in `api.demo.test.js`".
  Documents the discipline for future contributors.
- [ ] **Demo telemetry / kill-switch**: the spec is silent on whether
  the demo should ever be remotely disable-able. Default: no. Record
  the decision so it doesn't recur.
- [ ] **Future feature: "save your demo to a new account"**: explicitly
  out of scope per spec. If asked later, treat as a new spec.

---

## Sign-off

| Reviewer            | P0 ✓ | P1 ✓ | Notes                                                                                                                          |
|---------------------|------|------|--------------------------------------------------------------------------------------------------------------------------------|
| Spec author (Claude)| ✓    | ✓    | Drafted spec/plan/tasks; resolved findings from `claude-spec-review.md` and Codex cross-review (2026-05-19).                   |
| Cross-reviewer (Codex)| ✓  | ✓    | Independent review found one MAJOR (Task 02.0 contradiction — resolved A1) and three MINOR items (all resolved C1/C2/D pass).  |
| Implementer (TBD)   |      |      | Implementer signs here before merging Phase 09. Confirms automated tests pass and the smoke-test results from Phase 10.        |
| Constitution / user | ✓    | ✓    | User confirmed: A1 (accept Task 02.0), B1 (complete checklist), C1/C2/D bulk update (2026-05-19).                              |
