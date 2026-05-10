# Quickstart: Smart Application Creation Flow

**Branch**: `013-application-smart-parser` | **Date**: 2026-05-09

## Dev Setup

No new dependencies. Standard project setup applies:

```powershell
npm install
npm run dev          # Vite dev server — frontend at http://localhost:5173
npm run server:dev   # Express backend (separate terminal)
```

## Running Tests

```powershell
npm run test:run                                        # all tests
npx vitest run tests/utils/jobPostParser.test.js        # parser unit tests only
npx vitest run tests/components/Modal.test.js           # modal prefill tests only
```

## Linting

```powershell
npm run lint
```

## Manual Test Steps

### Happy Path — Smart Parser

1. Open the app in a browser (`http://localhost:5173`)
2. Click **New Application**
3. Verify a selection overlay appears with two cards (Smart Parser, Manual Entry)
4. Click the **Smart Parser** card
5. Paste the sample job post below into the textarea
6. Verify the **Process** button becomes enabled
7. Click **Process**
8. Verify a loading indicator appears briefly
9. Verify the application form opens pre-filled:
   - Company: `Acme Corp`
   - Job Title: `Senior Frontend Engineer`
   - Location: `Manila, Philippines`
   - Work Setup: `Remote`
   - Salary: `120000`
   - Skills: includes `React`, `TypeScript`
10. Edit any field to verify inline editing still works
11. Click **Create** — record appears in the list

**Sample job post for step 5:**
```
Senior Frontend Engineer
Acme Corp

Location: Manila, Philippines
Work Setup: Remote
Salary: ₱100,000 – ₱120,000 per month

About the Role:
We're looking for a Senior Frontend Engineer to join our growing team. You will
be responsible for building and maintaining our customer-facing web applications.

Responsibilities:
- Architect and implement scalable React components
- Collaborate with designers on UI/UX improvements
- Write and maintain unit and integration tests
- Conduct code reviews and mentor junior developers

Required Skills:
React, TypeScript, CSS, Jest, REST APIs

Preferred Skills:
GraphQL, Docker, CI/CD experience

Contact: Jane Reyes – jane@acmecorp.com
```

---

### Error State — Empty Input

1. Click **New Application** → Smart Parser card
2. Leave the textarea empty
3. Verify **Process** button is disabled or clicking shows a validation message
4. Paste a few characters (< 20) — button should remain disabled

---

### Error State — Parse Failure

1. Click **New Application** → Smart Parser card
2. Paste plaintext with no recognizable fields (e.g., `lorem ipsum dolor sit amet consectetur`)
3. Click **Process**
4. Verify error message: "Unable to extract application details. Please review the pasted content or enter details manually."
5. Click **Retry** — verify textarea is still editable
6. Click **Enter manually** — verify the standard application form opens

---

### Manual Entry Path

1. Click **New Application**
2. Click **Manual Entry**
3. Verify the existing application form opens exactly as before this feature
4. Fill fields and save normally

---

### Mobile Viewport

1. Open browser DevTools → mobile viewport (e.g., 390×844, iPhone 14)
2. Click **New Application**
3. Verify the two cards are stacked vertically (not side-by-side)
4. Complete the Smart Parser flow — verify textarea and form are usable at mobile width

---

## Common Issues

| Issue | Likely cause | Fix |
|-------|-------------|-----|
| Process button stays disabled | textarea < 20 chars | Paste more content |
| Fields not pre-populated after parse | Text format not recognized | Check that sample post has labeled sections |
| Form opens blank after parse | Zero useful fields extracted (error path) | Verify error state appears instead |
| Existing tests fail | Import not updated in Tracker.test.js | Update to stub CreationPicker instead of Modal |
