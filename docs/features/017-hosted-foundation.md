# Feature Brief — 017-hosted-foundation

## Summary
Establish the hosted deployment architecture for Project Alice while preserving the existing local-first development workflow and behavior.

This feature introduces the runtime separation between local and hosted environments, defines the backend/data architecture for Vercel + Supabase, and formalizes the environment configuration contract required for deployment.

No major user-facing behavior changes should occur in this feature.

---

## Goals
- Preserve the current local SQLite development workflow.
- Introduce a hosted runtime architecture using Vercel + Supabase.
- Keep business logic centralized in the API layer.
- Define a scalable repository architecture for future persistence adapters.
- Prepare the project for authenticated hosted usage without implementing auth yet.
- Ensure deployment setup is reproducible and documented.

---

## Scope

### Runtime Modes
Define and document supported runtime modes.

#### Local Mode
- Existing Express + SQLite behavior remains intact.
- Intended for local development and fallback usage.
- Uses existing SQLite repositories and storage behavior.

#### Hosted Mode
- Frontend hosted on Vercel.
- API routes/functions hosted on Vercel server runtime.
- Supabase used for Postgres and future authentication.
- Runtime behavior controlled through environment configuration.

---

## Architecture Requirements

### Environment Configuration Contract
Define a centralized runtime configuration strategy.

Environment variables should include:
- App runtime mode
- Supabase project URL
- Supabase anon/public key
- Supabase service role key (server-side only)
- Database connection configuration
- Feature/runtime toggles where necessary

Requirements:
- Clear separation between client-safe and server-only variables.
- Invalid or missing configuration should fail clearly.
- Local mode should continue functioning without hosted variables configured.

---

## Repository Architecture
Define repository abstraction boundaries to support multiple persistence implementations.

Requirements:
- Existing SQLite repositories remain functional.
- Future Supabase repositories should conform to the same interface contract.
- API/business logic should not directly depend on SQLite or Supabase implementations.
- Runtime configuration determines which repository implementation is used.

No Supabase persistence implementation is required yet in this feature.

---

## Supabase Schema Planning
Define hosted schema equivalents for:
- Applications
- Profile
- Related nested profile entities where applicable

Requirements:
- Preserve existing frontend/API field naming where practical.
- Prepare for future `user_id` ownership support.
- Document relationships and ownership assumptions.
- Define fields needed for timestamps and future RLS policies.

No migration tooling is required in this feature.

---

## API Boundary Rules

### Business Rules Stay Server-Side
The frontend should not directly:
- implement status transition logic
- perform ownership/security enforcement
- bypass validation rules
- communicate directly with Supabase for protected operations

The API layer remains the primary enforcement point for:
- validation
- business rules
- authorization
- repository access

---

## Documentation Requirements
Add initial hosted deployment documentation covering:
- Vercel setup
- Supabase setup
- Environment variables
- Local vs hosted runtime behavior
- Hosted architecture overview

Documentation should make onboarding reproducible for future contributors.

---

## Non-Goals
Out of scope for this feature:
- Authentication
- Real hosted persistence
- Demo mode
- Resume upload restrictions
- Existing SQLite data migration
- Row Level Security implementation
- Public deployment polish

---

## UX Expectations
No intentional user-facing UI changes are expected in this feature.

The application should continue behaving similarly to the current local implementation.

---

## Validation And Testing
Include:
- Runtime configuration validation
- Repository contract validation
- Hosted/local boot sanity checks
- Environment fallback handling tests
- Basic hosted deployment smoke verification

---

## Acceptance Criteria
- Local SQLite mode still works without regression.
- Hosted runtime mode can initialize successfully.
- Environment configuration contract is documented and validated.
- Repository abstraction supports future persistence adapters.
- Supabase schema plan is documented.
- API/business-rule boundaries are clearly defined.
- Hosted setup steps are documented and reproducible.