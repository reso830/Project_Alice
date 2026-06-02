# Plan Review Checklist: Profile Schema Refactor (032)

**Purpose**: Gate the plan against the project constitution before `/speckit.tasks`.  
**Plan**: [plan.md](../plan.md) · **Spec**: [spec.md](../spec.md)

## Constitution Compliance

- [ ] Simple, readable code favored over clever abstractions (thin adapter split + two pure model helpers)
- [ ] Business logic separated from UI (split/join/normalize in the model; no UI changed)
- [ ] Validation centralized and reused (031's `validateProfile` / `normaliseProfile` unchanged)
- [ ] No new dependencies (uses existing better-sqlite3 transactions + Supabase RPC pattern)
- [ ] Local-first preserved; no external analytics/tracking added
- [ ] No silent data corruption — migration is loss-free and idempotent; saves replace rows transactionally

## Requirement Coverage

- [ ] Every FR (FR-001…FR-015) maps to a planned component or test
- [ ] Skills are sole source of truth; document has no `skills` key after save/migration (FR-002)
- [ ] Both backends + demo return reassembled skills (FR-003, FR-004)
- [ ] Save is transactional / atomic in both modes (FR-005, FR-011)
- [ ] Auto-migration is idempotent and requires no user action (FR-006, FR-007)
- [ ] Legacy `string` skills default to level 2; junk dropped (FR-009)
- [ ] Defensive de-duplication on migration (FR-010), plus blank-name drop, run **before** insert so the unique index can't abort the migration
- [ ] Store-level case-insensitive unique index present in both DDLs; non-blank enforced by app + migration (no store CHECK)
- [ ] Loss-free scoped to **distinct** skills — duplicate-collapse/blank-drop documented as intentional, not data loss (FR-008/SC-001)
- [ ] No new endpoints; no UI change (FR-012)
- [ ] Skill model (scale/validation/50-cap) unchanged from 031 (FR-013)
- [ ] Unrated skills never persisted (FR-014)

## Test Strategy

- [ ] Model unit tests for `splitProfileForStorage` / `joinProfileWithSkills`
- [ ] SQLite adapter: round-trip, ordering, empty, lazy migration, idempotency
- [ ] Supabase adapter: RPC-based save + reassembly + lazy migration (mocked)
- [ ] Route integration: GET embeds skills, PUT validates + round-trips
- [ ] Health probe for `profile_skill`
- [ ] Demo parity verified unchanged
- [ ] Empty / loading / error states unaffected (no UI change)

## Quality Gates

- [ ] Lint/format pass planned
- [ ] Tasks include Release Prep (version, CHANGELOG, README, REPO_MAP, deployment.md, feature_roadmap, package-lock) as the second-to-last phase
- [ ] Tasks include a light Browser Smoke (transparent-contract proof: load Profile, edit/save a skill) as the final phase
- [ ] `docs/deployment.md` updated for the new hosted SQL block (env/runtime schema change)
- [ ] Any skipped check documented with reason + residual risk

## Notes / Residual Risk

- Hosted save adds a PL/pgSQL RPC → one more operator SQL object (accepted; mirrors `claim_and_seed_starter`). Tracked in [research.md R-2](../research.md).
- Lazy-on-read migration performs a write on first read of an un-migrated profile (one-time, idempotent). Tracked in [research.md R-3](../research.md).
- No down migration (consistent with 019).
