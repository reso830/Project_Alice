# Research: Responsive Job Application Tracker Web App

**Feature**: `001-app-tracker-ui`  
**Date**: 2026-04-25  
**Status**: Complete — all NEEDS CLARIFICATION resolved

---

## Decision 1: JavaScript Framework

**Decision**: Vanilla JavaScript (ES2022 modules), no UI framework  
**Rationale**: The constitution favours "readable, direct web application structure over clever abstractions." This is a read-heavy, single-user, local-only app with well-defined DOM targets (cards, modals, toasts). Vanilla JS with explicit DOM manipulation is simpler to debug, has zero framework churn risk, and requires no compilation step for the runtime logic itself.  
**Alternatives considered**:
- React/Vue/Svelte — rejected; introduces virtual DOM, component lifecycle complexity, and a heavier build for a feature set that does not require reactive graphs or component trees at this scale
- Alpine.js — considered; removed as even a CDN dependency is unnecessary when the interaction surface is bounded and well-understood

---

## Decision 2: Build Tooling

**Decision**: Vite 5.x  
**Rationale**: Vite provides a zero-config dev server with hot module replacement, native ES module support in development, and a production bundle via Rollup. It is the minimal viable build tool that satisfies the constitution's testing requirement (Vitest runs natively inside Vite). No webpack config, no Babel transforms needed.  
**Alternatives considered**:
- No build tool (raw HTML + `<script type="module">`) — rejected; makes Vitest integration impossible and eliminates hot reload during development
- Webpack — rejected; significantly more configuration overhead for no additional benefit at this scale
- Parcel — rejected; less ecosystem momentum, less Vitest alignment

---

## Decision 3: Persistence / Storage

**Decision**: `localStorage` with JSON serialisation  
**Rationale**: The spec explicitly states local-first, single-user, no server. `localStorage` is synchronous, always available offline, requires no setup, and is sufficient for < 500 application records (well within the ~5–10 MB browser limit). Data is read once on app start and written on every mutation.  
**Alternatives considered**:
- IndexedDB — rejected; asynchronous API adds complexity for a data volume that does not justify it; no structured query need at this stage
- In-memory only (no persistence) — rejected; spec FR-014 requires star state to persist across reloads
- Remote API — rejected; spec explicitly prohibits external data sharing and requires no server

---

## Decision 4: Testing Framework

**Decision**: Vitest 1.x  
**Rationale**: Runs natively with Vite (same config, same transforms). Provides Jest-compatible API so tests are familiar. Covers the constitution's requirement for automated tests on validation logic, status defaults, and date utilities. No additional runner setup needed.  
**Alternatives considered**:
- Jest — rejected; requires separate Babel/transform configuration to work with ES modules; Vitest is a drop-in replacement with better Vite integration
- No testing — rejected; constitution hard-requires automated tests for validation and status behaviour

---

## Decision 5: CSS Approach

**Decision**: Vanilla CSS with custom properties (design tokens)  
**Rationale**: `design/tracker.md` already defines all color tokens, spacing, shadow, and typography values as CSS custom properties. Implementing them directly as CSS variables in a single `main.css` is the most direct path and requires no additional tooling. Responsive breakpoints are implemented with standard media queries.  
**Alternatives considered**:
- Tailwind CSS — rejected; design system is already fully specified as custom properties; Tailwind would add a build step and fight with the existing token names
- CSS Modules — rejected; unnecessary module isolation for a single-page app with bounded component scope

---

## Decision 6: State Management

**Decision**: A single `store.js` module — in-memory array with localStorage sync  
**Rationale**: There is one data entity (Job Application), one list view, and one modal open at a time. A simple module that holds a mutable array in memory, reads from localStorage on init, and writes back on every change is sufficient. Components receive data as arguments and call store methods for mutations; no reactive graph needed.  
**Alternatives considered**:
- Redux/Zustand/Pinia — rejected; overkill for one entity and one page; all state fits in a single module
- Custom event-based reactivity — considered but deferred; standard function calls between store and components are readable enough at this scale

---

## Decision 7: Scroll Position Management

**Decision**: Save `window.scrollY` before modal open; restore via `window.scrollTo` after modal close  
**Rationale**: The spec requires scroll position preservation when a modal closes (US-2 scenario 4). `window.scrollY` captures the exact offset. Restoring it after re-enabling scroll is a standard pattern with no library needed. Scroll lock is implemented by setting `document.body.style.overflow = 'hidden'` and restoring on close.  
**Alternatives considered**:
- CSS `overflow: hidden` on `<html>` — tested; causes layout shift on some browsers when scrollbar disappears. `body` overflow with explicit scroll restoration is more reliable.

---

## Decision 8: Click vs Scroll Disambiguation (FR-007)

**Decision**: Use a `pointerdown`/`pointerup` distance threshold (< 5 px movement = click, ≥ 5 px = scroll/drag)  
**Rationale**: FR-007 requires that scrolling through the list does not accidentally open a modal. Standard `click` events fire even after scroll on touch devices. Measuring pointer movement between `pointerdown` and `pointerup` and only firing the modal open if movement is below the threshold prevents accidental opens on both mouse and touch.  
**Alternatives considered**:
- `click` event only — rejected; fires after touch scroll on mobile, violating FR-007
- `touchend` with `e.cancelable` check — rejected; less portable than Pointer Events API

---

## Resolution Summary

All NEEDS CLARIFICATION items from the Technical Context are resolved. No further unknowns remain before Phase 1 design.
