# Feature Brief — 022-deployment-polish-docs

## Summary
Finalize the hosted portfolio experience with deployment documentation, operational checklists, and hosted deployment validation steps.

This feature focuses on making Project Alice reproducible, deployable, and presentation-ready for portfolio usage.

---

## Goals
- Improve hosted deployment onboarding.
- Reduce deployment/setup ambiguity.
- Add operational deployment validation guidance.
- Make the hosted portfolio experience easier to maintain and showcase.

---

## Scope

### README Improvements
Add hosted deployment documentation covering:
- local mode
- hosted mode
- demo mode
- runtime behavior overview
- development workflow expectations

Requirements:
- Documentation should be newcomer-friendly.
- Hosted/local separation should be clearly explained.

---

## Environment Variable Checklist
Add deployment-ready environment documentation.

Include:
- required variables
- optional variables
- server-only variables
- client-safe variables
- example configuration structure

Requirements:
- Missing critical variables should be easy to identify.
- Secrets handling guidance should be documented clearly.

---

## Supabase Setup Checklist
Document:
- project creation
- database setup
- authentication setup
- allowlist configuration
- RLS policy setup
- deployment integration expectations

Requirements:
- Setup steps should be reproducible from scratch.

---

## Demo/Free-Tier Notes
Document:
- expected limitations of Vercel Hobby
- expected limitations of Supabase Free
- demo-mode expectations
- hosted cold-start considerations where relevant

Requirements:
- Expectations should remain realistic for portfolio hosting.

---

## Hosted Smoke-Test Checklist
Add deployment verification guidance for:
- login flow
- demo flow
- application CRUD
- profile editing
- authorization behavior
- resume import restrictions
- mobile layout sanity checks

Requirements:
- Smoke-test flow should support pre-production verification before promotion.

---

## Migration Clarification
Document clearly:
- Local SQLite data is not migrated automatically.
- Hosted users start from seeded data.
- Migration tooling is future work.

This expectation should be visible and explicit.

---

## Portfolio Presentation Expectations
The hosted deployment should:
- feel stable
- feel intentional
- feel production-like despite free-tier constraints

Documentation should support future portfolio reviewers or contributors.

---

## Non-Goals
Out of scope:
- Custom domains
- CI/CD automation beyond current workflow
- Monitoring/analytics systems
- Paid infrastructure optimization
- Production-scale hardening

---

## Validation And Testing
Include:
- Hosted deployment verification
- Environment setup validation
- Smoke-test execution verification
- Documentation sanity review
- Fresh-environment reproducibility checks

---

## Acceptance Criteria
- Hosted deployment documentation is complete.
- Environment setup is reproducible.
- Supabase setup checklist is documented.
- Smoke-test verification checklist exists.
- Free-tier limitations are documented clearly.
- Migration expectations are documented explicitly.
- Project Alice is presentation-ready for hosted portfolio usage.