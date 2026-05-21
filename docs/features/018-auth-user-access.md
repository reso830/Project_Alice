# Feature Brief — 018-auth-user-access

## Summary
Add authenticated hosted user accounts to Project Alice using Supabase Auth.

This feature introduces account login, session-aware navigation, ownership-aware data models, and API authorization rules for hosted mode.

The goal is to enable real hosted user accounts while maintaining the architecture separation established in the hosted foundation feature.

---

## Goals
- Add secure hosted authentication.
- Restrict signup access using an allowed-email list.
- Introduce user-owned hosted data.
- Add authorization enforcement to the API layer.
- Add defense-in-depth protection through Supabase RLS policies.
- Keep demo/public access behavior separate from authenticated usage.

---

## Scope

### Authentication
Implement:
- Email/password login
- Session persistence
- Sign out flow
- Session-aware frontend state

Requirements:
- Authentication should only apply in hosted mode.
- Local SQLite mode should continue functioning independently.
- Authentication state should survive page refreshes.

---

## Allowed Email Signup Restriction
Only approved email addresses may create accounts.

Requirements:
- Signup attempts from non-allowlisted emails should fail clearly.
- Restriction logic should exist server-side.
- Messaging should be user-friendly without exposing internal details.

No public/open registration is allowed in v1.

---

## Navigation And Session UX
Update navigation and application behavior based on authentication state.

Authenticated users should:
- Access their hosted data
- Access resume import functionality
- See signed-in state in navigation

Unauthenticated users should:
- Remain in demo/public behavior
- Not access protected hosted features

---

## User Ownership Model
Add ownership-aware hosted records.

Requirements:
- Hosted applications belong to a user.
- Hosted profile belongs to a user.
- Ownership should be enforced consistently across API operations.
- Frontend should not be trusted for ownership enforcement.

---

## Authorization Rules
API routes should enforce:
- authenticated access where required
- ownership validation
- forbidden access handling
- protected mutation restrictions

Requirements:
- Unauthorized access attempts should fail cleanly.
- Authenticated users should only access their own hosted data.

---

## Supabase RLS Policies
Implement Row Level Security policies for hosted data.

Requirements:
- Users can only read/write their own records.
- Policies should support future scalability.
- API authorization remains primary enforcement.
- RLS acts as defense in depth rather than the only protection layer.

---

## UX Expectations

### Signed-In Experience
Authenticated users should experience:
- Persistent hosted data
- Personalized application/profile records
- Resume import availability

### Public Visitor Experience
Public visitors should:
- Remain in demo mode behavior
- Not encounter forced login walls for basic exploration

---

## Non-Goals
Out of scope:
- OAuth/social login providers
- Multi-user collaboration
- Admin dashboards
- Password reset enhancements beyond baseline support
- Account profile management systems
- Local SQLite authentication

---

## Validation And Testing
Include:
- Login/logout flow tests
- Allowed-email restriction tests
- Ownership authorization tests
- Unauthorized request handling tests
- Session persistence tests
- RLS validation tests
- Demo/public separation tests

---

## Acceptance Criteria
- Hosted users can authenticate successfully.
- Non-allowlisted users cannot register.
- Hosted data is user-owned.
- API authorization checks are enforced.
- RLS policies protect hosted records.
- Signed-in state updates the UI correctly.
- Local mode remains functional and unaffected.