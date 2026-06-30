# Developer Quickstart: Self-Update Support

This guide outlines how to manually test update checks, staging, Windows file swaps, and single-instance locks in development.

---

## 1. Testing Single-Instance Locks

1. Start the Express server locally:
   ```bash
   npm run start
   ```
2. Open another terminal and attempt to start the server again:
   ```bash
   node server/portable.js
   ```
3. Observe that the second execution detects the PID lock in `data/alice.lock`, opens the browser to the running instance's port, and exits without launching a second server.

---

## 2. Testing Update Checks (Offline Mock / Local Fixture)

To run a fully repeatable offline smoke test of the update flow:
1. Start a local server (or mock endpoint) serving the mock release metadata JSON pointing to the test fixture zip `tests/fixtures/update-v1.10.0.zip` and checksum file `tests/fixtures/update-v1.10.0.zip.sha256`.
2. Start the Alice application with the following environment variables:
   ```bash
   ALICE_VERSION_OVERRIDE=v1.9.0
   ALICE_UPDATE_SOURCE_OVERRIDE=http://localhost:3000/mock-release-metadata.json
   ```
   *(Note: The frontend dynamically fetches the application version from `/api/health`, so there is no need to manually edit `src/pages/welcome/shared/appMeta.js` when these overrides are active).*
3. Start the application. The system will check the mock release endpoint and display a toast: **"A new version is available: v1.10.0"**.
4. In Settings > Updates, observe the current version shows `v1.9.0` and the status block displays `Update available v1.10.0`.

---

## 3. Testing Staging and Download

1. Click **Install now** on the toast or in Settings.
2. Verify that `data/update-staging/` is created.
3. Check that the ZIP is downloaded and extracted inside `data/update-staging/alice/`, preserving `app/` and `runtime/` directories.
4. Verify that the SHA256 verification logs print matching signatures.

---

## 4. Testing Windows Binary Swapping

1. Click **Restart to finish**.
2. The active Node process will exit, releasing locks on `runtime/node.exe` and SQLite binary.
3. The parent CMD process (`Start-Alice.cmd`) will detect `data/update-staging/alice`, copy the files, overwrite `Start-Alice.cmd` (if modified in the update), clean up staging, and re-execute itself.
4. Verify the application automatically boots into version `v1.10.0`.

---

## 5. Testing the Git Channel (Clone Self-Update — Increment 2)

The git channel applies updates on a `git clone` install via the cross-platform launcher (macOS/Linux/Windows) instead of a ZIP swap.

1. **Launch via the launcher** — the only clone run mode that enables self-update:
   ```bash
   npm start    # node scripts/start-alice.mjs — builds dist, serves it, marks update channel = git
   ```
   Verify `GET /api/health` returns `updateSupported: true` and `updateChannel: "git"`. Launching instead via `npm run dev` or `npm run server:start` MUST report `updateSupported: false` and hide the updater (raw-dev gating).

2. **Advertise a newer release** with the same override used by the portable channel:
   ```bash
   ALICE_UPDATE_SOURCE_OVERRIDE=<path or URL to a mock release JSON advertising a newer tag>
   ```
   The check reuses the GitHub Releases comparison; an "update available" toast appears.

3. **Fetch phase** — click **Update**. The server runs `git fetch --tags` (non-disruptive); the UI shows a **"Fetching…"** state, then transitions to **ready-to-restart**. Disconnect the network to confirm it fails fast into the amber **"Connection Error"** (`check-failed`) state *without restarting*. No `data/update-staging/` ZIP staging and no SHA256 step occur on this channel.

4. **Apply phase** — click **Restart to finish**. Confirm `data/update-pending.json` is written with `channel: "git"`, `targetTag`, and `previousRef` (the UpdatePending schema). The launcher stashes tracked changes if dirty → `git checkout <targetTag>` → `npm install` → `npm run build` → relaunch. Verify the footer shows the new version, `data/alice.db` is intact, and migrations ran on boot.

5. **Rollback** — force an apply failure (e.g. a deliberate build error) and verify the launcher restores `previousRef`, reinstalls, relaunches the previous version, and the UI shows the red **"Update failed — rolled back"** state.
