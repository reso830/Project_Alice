# Quickstart: Portable Distribution Package

**Feature**: 040-portable-distribution-package | **Date**: 2026-06-22

Two audiences: the **maintainer** who builds/releases the package, and the **end user** who runs it.

---

## A. Maintainer — build a portable package locally

From a clean checkout on Windows:

```bash
npm ci
npm run build:portable
```

Produces, under the build output directory:
- `alice/` — the staged standardized layout (`app/ runtime/ data/ config/ logs/` + `Start-Alice.cmd` + `VERSION`)
- `alice-v<version>-win-x64.zip`
- `alice-v<version>-win-x64.zip.sha256`

**Verify the build (dry run / acceptance):**
1. The ZIP extracts to `alice/` with all five directories + launcher + `VERSION`.
2. `app/` excludes `.env`, Supabase creds, and any AI key.
3. `runtime/node.exe` exists and runs (`runtime\node.exe -v` prints the pinned version).
4. The checksum matches: recompute SHA-256 of the ZIP and compare to `.sha256`.
5. DB smoke: launching the staged `alice/` opens `data/alice.db` without a native-module error.

---

## B. Maintainer — cut a release (CI)

Releases are deliberate and infrequent (free-tier quota):

```bash
# bump version (Release Prep), then:
git tag v<version>
git push origin v<version>
# or trigger the workflow manually (workflow_dispatch)
```

The `release-portable.yml` workflow (windows-latest) runs `npm ci` → `npm run build:portable` and attaches the ZIP + `.sha256` to the GitHub Release. It does **not** run on ordinary pushes/PRs.

---

## C. End user — run Alice

1. Download `alice-v<version>-win-x64.zip` from GitHub Releases.
2. Extract anywhere (e.g. Desktop). No install, no admin rights.
3. Double-click **`Start-Alice.cmd`**. A console window opens ("close this window to stop Alice"), the server starts, and your default browser opens to `http://127.0.0.1:3001`.
4. Use Alice. Your data is saved in `data\alice.db`.
5. To stop: close the console window (or press Ctrl+C in it).

**Optional AI (BYOK):** open Settings and paste your OpenRouter key — it is stored in your browser, not in the package. Without a key, AI features are disabled; everything else works.

**Notes:**
- Windows may show a one-time SmartScreen prompt for the downloaded launcher — expected.
- Double-clicking the launcher again while Alice is already running just **re-opens your browser to the existing instance** — it doesn't start a second copy (single instance).
- If port 3001 is busy with a *different* (non-Alice) program, Alice automatically uses the next free local port and opens the browser there. To keep a fixed port (and keep your saved AI key stable), set `port` in `config\settings.json`.
- Alice is reachable only from this PC (`127.0.0.1`); it is not exposed to your network.

---

## D. Independent-test mapping (Browser Smoke Test, final phase)

| Story | Quickstart step that exercises it |
|---|---|
| US1 zero-prereq launch | C1–C3 on a machine with no global Node |
| US2 data persists | add data → stop (C5) → relaunch (C3) → data present |
| US3 single action + stop | C3 (one double-click, browser opens) + C5 (close to stop) |
| US4 startup errors | remove an `app/` file / occupy port → relaunch |
| US5 reproducible build | A + B |
| US6 AI BYOK | C "Optional AI" — disabled without key, works after entering key |
| US7 041 foundation | inspect `VERSION` + `app`/`data` separation (A1–A2) |
| US8 hosted compatibility | confirm hosted build unaffected; `npm run test:run` + `npm run lint` green |
