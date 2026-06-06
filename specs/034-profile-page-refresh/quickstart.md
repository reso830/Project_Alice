# Quickstart: Profile Page Refresh (034)

How to run the app and exercise every state this feature touches. No new env vars,
no DB changes, no new dependencies.

## Run the app

```bash
npm install            # if not already
npm run dev            # Vite frontend (http://localhost:5173 by default)
# in a second terminal, for full profile persistence:
npm run server:dev     # Express + local SQLite
```

Optional local data helpers:
```bash
npm run db:init            # initialise local SQLite
npm run db:seed:profile    # seed a populated profile (exercise "profile exists")
npm run db:clear:profile   # clear the profile (exercise empty state / setup gate)
```

## Tests & lint (run before closing each phase)

```bash
npm run test:run    # vitest (jsdom) — full suite
npm run lint        # eslint src tests server shared
# focused while iterating:
npx vitest run tests/data/aiSettings.test.js
npx vitest run tests/pages/Profile.test.js tests/pages/ProfileEdit.test.js
npx vitest run tests/components/ResumeImport.test.js
```

## Manual test map

### Read-only Profile page (mostly shipped — verify no regression)
1. **Profile exists** — seed a profile → Welcome shows the first name; Basic Info,
   all sub-sections render; Skills show graded meters; hover/tap a skill reveals
   `{level} · {Label}`; Sort toggles Custom / By level ▾▴; >10 skills collapse with
   "Show all"; "?" opens the scale popover.
2. **Empty state** — clear the profile → Profile section shows the empty state +
   **Set Up Profile**.
3. **Archived link** — "Archived applications · N →" always present; navigates to the
   Tracker archived view; degrades to 0 if the archived fetch fails.
4. **Mobile collapse** — at < 640px, sub-section labels collapse/expand; desktop stays
   expanded.

### Settings card (§4.5 redesign — net-new)
5. **Unified card** — one **Settings** card with **ARTIFICIAL INTELLIGENCE** and
   **ACCOUNT** sub-groups (the old two separate cards are gone).
6. **Master toggle off** — connection panel + all feature toggles dimmed/inert.
7. **Save key** — status pill → `Connected` (saving the key *is* consent; no separate
   consent prompt). Eye reveals/masks; **Test** → `Testing…` → resolves; **Replace**
   re-opens the input; **Delete** → `Not connected`.
8. **Model field** — free-text `provider/model-slug` with datalist suggestions.
9. **Feature toggles** — Resume parsing functional + on by default; **JD** and
   **Compatibility** rendered **disabled** ("coming soon").
10. **Account sub-group** — mode-aware (hosted Delete account / local Clear all data /
    demo disabled); confirmation modal behaves as feature 030.
11. **Returning 033 user** — with a pre-existing key + consent in `localStorage`, the
    card loads master **on**, key preserved, default model, CV on — no re-entry.

### Edit / Setup Profile page proposed flow (net-new)
> The reference prototype `Edit Profile Flow.html` deep-links states via URL params
> (see `docs/design/edit_profile_page.md` §0). In the real app, drive equivalents:

12. **First-time (no profile)** → **Set Up Profile** → split-card **mode gate**.
    - **Manual entry** / dismiss (X/Esc/backdrop) → blank form.
    - **Smart entry** → upload (PDF/DOCX/TXT ≤ 5 MB) or paste → **Process résumé**
      (disabled until a file or >~20 chars) → spinner → form filled → **✦ AI FILLED**
      on every populated section.
13. **Existing profile** → **Edit Profile** → populated form, no gate, collapsed
    **Import Bar** at top → expand → Process → parsed items **appended** (nothing
    overwritten) → only touched sections tagged → **Undo** toast restores pre-import.
14. **AI parser unavailable** → ask-first dialog with the reason **code chip**
    (`HTTP 429` / `TIMEOUT` / `HTTP 401` …): wait-reasons offer **Try AI again**,
    settings-reasons offer **Update key in Settings →**; **Use basic parser** fills
    with the neutral **⚙ Auto-filled** tag (never the sparkle).
15. **Unreadable file** → amber dead-end dialog (`NO_TEXT`): Try again / different
    file / Enter manually (first-time) or Try again / Cancel (existing).
16. **AI off / CV off** → Smart entry & Import Bar disabled with **"Enable AI in
    Settings →"**; manual entry unaffected.
17. **Safety** — a failed import makes **no** changes; existing-profile **Cancel**
    leaves the form unchanged. Dirty Back/Cancel → discard-confirmation.
18. **Reduced motion** — enable OS "reduce motion"; the skill reveal, import flash,
    and bottom-sheet slide present without animation, end-states intact.

## Common issues
- **Status pill shows "Not connected" after saving** — confirm `setKey` ran and the
  derived status reads key presence (status is computed, never stored).
- **Smart entry stays disabled** — master toggle off, no key, or CV feature off →
  check the "Enable AI in Settings →" link path.
- **Returning user lost AI access** — verify the migration ran once and didn't clear
  `alice.ai.openrouterKey`; check `alice.ai.enabled`/`model`/`features` were written.
- **Import mutated an existing profile on failure** — a bug: imports must be
  all-or-nothing; verify the snapshot/apply order.
- **No server needed for AI** — the OpenRouter call is browser-direct; only profile
  persistence needs `server:dev`.
