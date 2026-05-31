# Quickstart: Verifying the Skill Proficiency System

**Feature**: `031-skill-proficiency-system` · **Spec**: [spec.md](./spec.md)

Local-mode steps to exercise the three user stories. Run from the repo root.

## Run

```bash
npm install
npm run db:init          # local SQLite schema
npm run db:seed:profile  # seed a profile (legacy string skills → migration check)
npm run server:dev       # API on the Express server
npm run dev              # Vite frontend (separate terminal)
```

Open the printed Vite URL → **Profile** page.

## Automated checks

```bash
npm run test:run         # full vitest suite (incl. profile model tests)
npm run lint
```

## User Story 1 — capture & edit (P1)

1. Profile → **Edit Profile** → Skills section.
2. **Add skill**, type a name; confirm the row appears **unrated** and Save is disabled with a "set a level" message.
3. Tap level segment 4 → caption reads `4 · Strong`; tap segment 4 again → clears to unrated.
4. Rate it, **Save**; reopen the editor → level persisted. Change name/level, Save again → persists. Remove (×), Save → gone.
5. Negative gates: blank name, a second skill with the same name (case-insensitive), and a 51st skill each block Save with a specific message.

## User Story 2 — display (P2)

1. With rated skills, view the Profile page → each skill is a row with a 5-segment meter filled to its level.
2. Hover (desktop) / tap (mobile) a row → meter cross-fades to `"{level} · {Label}"` in place, no reflow; tap auto-reverts after 2.5s.
3. Click **?** → popover lists all five levels (swatch + label + flavor); closes on outside-click / Esc.
4. Toggle **By level** / **Custom**; add >10 skills → only 10 show with **Show all {N} skills**.
5. Accessibility: Tab to a skill row (it is a `<button>`), confirm `aria-label="{name}: {Label}, level {n} of 5"`; level is conveyed by text, not colour alone.

## User Story 3 — migration (P3)

1. The seeded profile stored legacy `skills: string[]`. Load the Profile → every legacy skill renders at **Basic (level 2)**, none dropped.
2. Open the editor → migrated skills show as rated (2) and are re-ratable/savable.
3. (Optional) Resume import: imported skills arrive **unrated** and gate Save until rated; importing a duplicate keeps the existing skill's level.

## Expected

- No console errors; legacy profiles render immediately; saving is impossible while any skill is unrated/blank/duplicate or count > 50; stored skills are `{ name, level }`.
