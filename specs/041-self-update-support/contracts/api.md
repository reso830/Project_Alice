# API Contracts: Self-Update Support

All routes are mounted relative to the backend Express server under `/api/update`.

---

## 1. Health Status (`GET /api/health`)

Updated to expose the version for single-instance checks, updates capability gating, and updater handoffs.

* **Response (200 OK)**:
  ```json
  {
    "status": "ok",
    "runtime": "local",
    "version": "v1.9.0",
    "updateSupported": true,
    "updateChannel": "git"
  }
  ```

* **Fields**:
  - `status` (String): Overall status indicator (`"ok"`).
  - `runtime` (String): Runtimes environment mode (`"local"` | `"hosted"`).
  - `version` (String): Current display version of the running application (prefixed with `v`, e.g., `"v1.9.0"`).
  - `updateSupported` (Boolean): Dynamically computed capability flag. Evaluates to `true` only for (a) the portable channel on Windows (`updateChannel === 'portable'` and `process.platform === 'win32'`) **or** (b) a launcher-run git clone (`updateChannel === 'git'`). Evaluates to `false` for raw `npm run dev` / `server:start`, Hosted, and Demo. *(Increment 2 — supersedes the v1 "local Windows only" rule.)*
  - `updateChannel` (String | null): The resolved self-update channel — `"portable"` (ZIP swap) or `"git"` (git fetch/checkout) — derived from a launcher-set environment flag; `null`/omitted when no self-update-capable launcher is in effect.

---

## 2. Check for Updates (`GET /api/update/check`)

Checks for newer releases, proxying the GitHub Releases API. Implements 1-hour in-memory cache.

* **Response (200 OK)**:
  ```json
  {
    "updateAvailable": true,
    "currentVersion": "1.9.0",
    "latestVersion": "1.10.0",
    "releaseNotesUrl": "https://github.com/reso830/Project_Alice/releases/tag/v1.10.0",
    "publishedAt": "2026-06-26T15:08:27Z"
  }
  ```

---

## 3. Trigger Update Download (`POST /api/update/download`)

Asynchronously initiates downloading and staging of the latest release package.

* **Response (202 Accepted)**:
  ```json
  {
    "status": "downloading",
    "progress": 0
  }
  ```

---

## 4. Poll Update Status (`GET /api/update/status`)

Exposes the current state of the download and staging state machine.

* **Response (200 OK)**:
  ```json
  {
    "status": "idle",
    "progress": 64,
    "bytesTotal": 12400000,
    "bytesDownloaded": 7936000,
    "error": null
  }
  ```
  *Note: `status` values by channel:*
  - *Shared: `idle`, `checking`, `available`, `ready-to-restart`, `installing` (restart-wait — copy adapts by channel: "waiting for Alice to come back online…" / "Updating via git…"), `failed`, `check-failed` (amber "Connection Error").*
  - *Portable channel only: `downloading`, `verifying`, `extracting`.*
  - *Git channel only: `fetching` (during `git fetch --tags` — the git analogue of the portable download/verify/extract phase).*

---

## 5. Request Restart & Installation (`POST /api/update/restart`)

Signals the active server to initiate graceful shutdown and write the pending update flag, triggering the launcher file-swap sequence.

* **Behavior**:
  1. Writes the update metadata file `data/update-pending.json` (see the **UpdatePending** schema in [data-model.md §4](../data-model.md) — carries `channel`, and either `stagedPath` for the portable channel or `targetTag` + `previousRef` for the git channel).
  2. Responds with `200 OK` (payload below).
  3. Schedules a 500ms delay.
  4. Invokes the registered `onShutdown` callback. The callback gracefully closes the HTTP listener (`server.close()`), closes the active SQLite database connection (`db.close()`), and exits the process (`process.exit(0)`).

* **Response (200 OK)**:
  ```json
  {
    "status": "restarting"
  }
  ```

---

## 6. Get Update Settings (`GET /api/update/settings`)

Reads configuration preferences from `config/settings.json`.

* **Response (200 OK)**:
  ```json
  {
    "autoCheckUpdates": true,
    "updateMode": "ask"
  }
  ```

---

## 7. Save Update Settings (`POST /api/update/settings`)

Saves configuration preferences back to `config/settings.json`.

* **Request Body**:
  ```json
  {
    "autoCheckUpdates": false,
    "updateMode": "notify"
  }
  ```
* **Response (200 OK)**:
  ```json
  {
    "success": true
  }
  ```
