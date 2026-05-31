# Plan Review Checklist: Skill Proficiency System

**Feature**: `031-skill-proficiency-system` · **Plan**: [plan.md](../plan.md)  
**Purpose**: Gate the plan before `/speckit.tasks`.

## Scope & alignment

- [ ] Plan covers every FR in the spec (FR-001…FR-014) and the three user stories.
- [ ] Non-goals respected: no compatibility-scoring engine, no feature flag, no application-skills changes, language proficiency untouched.
- [ ] Design doc §4.4 / §5 behaviours mapped to display vs editor work.

## Architecture & data

- [ ] Single chokepoint (`normaliseProfile`) handles migration for both client save and Supabase upsert.
- [ ] `SkillEntry` shape and normalisation rules match data-model.md (string→2, null preserved, bad level coerced).
- [ ] No DB schema/migration introduced (skills inside the profile JSON blob).
- [ ] Scale defined once in the model; colours/flavor kept UI-side.

## Affected areas accuracy

- [ ] Modify list is precise (model, ProfileEdit, Profile, demoSeed profile array, main.css).
- [ ] Application-skills paths (Modal.js, Card.js, store.js, application.js) confirmed out of scope.
- [ ] `\.skills` re-grep planned before merge to catch string-assuming call sites.

## Validation

- [ ] Model unit tests enumerated for: migration, null-preserve, coercion, blank, duplicate, max-50, mergeResumeData unrated + duplicate-preserve.
- [ ] Persistence round-trip test for object skills (local + Supabase adapter).
- [ ] Accessibility check (button rows, aria-label, non-colour-only) in the manual/smoke plan.

## Constitution gates

- [ ] Core validation logic has automated tests.
- [ ] Empty / loading / error (Save-gated) states handled explicitly.
- [ ] Release Prep is the second-to-last phase; Browser Smoke Test is last.
- [ ] Any skipped artifact (e.g. contracts/api.md) documented with reason + residual risk.

## Notes

- Items unchecked block progression to `/speckit.tasks`.
