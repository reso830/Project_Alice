# Design Fidelity Checklist: [FEATURE NAME]

**Purpose**: Gate a visual-fidelity feature (implemented against a design
prototype / high-fidelity handoff) before its visual phase is accepted.
**Created**: [DATE]
**Feature**: [Link to spec.md]
**Canonical design source**: [path to prototype/handoff — the source of truth]

**When to use**: ONLY for visual-fidelity features (plan.md Visual-Fidelity Mode
filled in). Skip for logic features. For a small visual tweak, apply the Source &
Translation and Tier 2 items with judgment and drop the harness — proportionality
governs (constitution Principle V). Every item below must map to a real failure it
prevents; if one doesn't apply to this feature, mark it `N/A` with a one-line why.

## Source & Translation

- [ ] CHK001 Tasks reference the prototype directly (file + section/lines); no
      pixel/motion detail was paraphrased into prose.
- [ ] CHK002 On any spec/plan/tasks vs prototype conflict, the prototype won (or
      the ambiguity was raised, not guessed).
- [ ] CHK003 (Cross-stack) Prototype stylesheet and design tokens lifted wholesale,
      not re-typed from the token list.
- [ ] CHK004 (Cross-stack) DOM structure replicated element-for-element; no wrapper
      nodes dropped or "cleaned up" that the lifted CSS depends on.

## Decomposition

- [ ] CHK005 Each animated scene / distinct component is its own task (no
      several-in-one visual tasks).

## Tier 1 — Automated geometry (mandatory)

- [ ] CHK006 `npm run test:visual` exists and runs headless (harness reused or a
      setup task added this feature).
- [ ] CHK007 Geometry assertions authored per component from the prototype's actual
      measured geometry, using ranges (not exact pixels).
- [ ] CHK008 Tier 1 green at every declared breakpoint — sizing, non-overlap, and
      responsive show/hide all pass.

## Tier 2 — Visual judgment (artifacts always produced)

- [ ] CHK009 Frozen-state screenshots captured for built AND prototype at every
      breakpoint/checkpoint, animations paused, identical mock data seeded.
- [ ] CHK010 Screenshots compared against the prototype; choreography, color, and
      motion intent match (or an accepted deviation is logged — see CHK012).
- [ ] CHK011 Tier 2 judge recorded: implementing agent self-served after an
      in-session image-view preflight, OR artifacts handed to a named
      vision-capable reviewer / operator.

## Conditional artifacts (only when triggered)

- [ ] CHK012 Deviation ledger entry exists for each intentional difference from the
      prototype (what / why / approved-by). `N/A` if there are no deviations.
- [ ] CHK013 `visual-artifacts.md` manifest present. `N/A` if Tier 2 was
      self-served (no cross-party handoff).

## Confirmation, not discovery

- [ ] CHK014 The gate ran per-task DURING implementation; the Browser Smoke Test is
      expected to confirm, not to surface a wave of "align to prototype" fixes.

## Notes

- Check items off as completed: `[x]`; mark inapplicable items `N/A` with a reason.
- The point of this checklist is to keep appearance drift inside the implementation
  loop (cheap, caught by the implementer) instead of at merge (expensive, caught by
  the operator). Do not let it become ceremony — an item that never catches
  anything for your feature type is `N/A`, not a ritual tick.

---

## Appendix — `npm run test:visual` harness spec (Tier 1)

Build this once per project (reused across features); author only the per-component
assertions per feature. Reference spec, not prescriptive implementation:

- **Runner**: Playwright headless. Loads both the built app and the prototype
  (`Welcome (Modernized).html`-style self-contained page) at each breakpoint.
- **Freeze animations before measuring** — inject before geometry/screenshot:
  ```css
  *, *::before, *::after {
    animation-play-state: paused !important;
    animation-delay: -1s !important;
    transition: none !important;
  }
  ```
- **Deterministic data** — load pages with a test flag (e.g. `?testMode=true`) that
  seeds identical mock content so dynamic values (version string, dates, records)
  don't cause geometry/screenshot drift. Alternatively crop dynamic regions.
- **Geometry assertions** (the non-flaky core) — assert layout, not pixels, e.g.:
  - a column's width is within a viewport-relative range (`.pitch` ≈ 44–48% at
    desktop);
  - two elements' bounding boxes are disjoint (CTA buttons don't overlap);
  - responsive visibility (`.foot-desktop-only` hidden ≤620px, shown >900px).
- **Screenshot output** — write built + prototype snapshots to the task artifact
  dir with a stable naming convention: `[task-id]_prototype.png` /
  `[task-id]_built.png`, one pair per breakpoint/checkpoint, so a Tier 2 judge
  (agent or human) finds them predictably.
- **Optional** static-state comparison via SSIM or `pixelmatch` with a tolerance
  (5–10%) — for settled/static frames only, never as the sole judge, and never on
  live animation frames (subpixel/anti-aliasing/OS differences cause false fails).
