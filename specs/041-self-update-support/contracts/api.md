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
    "portable": true
  }
  ```

* **Fields**:
  - `status` (String): Overall status indicator (`"ok"`).
  - `runtime` (String): Runtimes environment mode (`"local"` | `"hosted"`).
  - `version` (String): Current display version of the running application (prefixed with `v`, e.g., `"v1.9.0"`).
  - `updateSupported` (Boolean): Dynamically computed flag indicating capability support. Evaluates to `true` only if `runtime === 'local'` and `process.platform === 'win32'` and launched via the launcher. Evaluates to `false` on all other platform/mode configurations.
  - `portable` (Boolean): Indicates whether the server is running as the portable package/distribution (evaluates to `true` when launched via `server/portable.js` or with the portable launcher flag, and `false` otherwise).

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
  *Note: `status` values include `idle`, `checking`, `available`, `downloading`, `installing`, `ready-to-restart`, `failed`.*

---

## 5. Request Restart & Installation (`POST /api/update/restart`)

Signals the active server to initiate graceful shutdown and write the pending update flag, triggering the launcher file-swap sequence.

* **Behavior**:
  1. Writes the update metadata file `data/update-pending.json`.
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
  Amended by #85: `updateMode` is limited to `"notify"` or `"ask"`; legacy on-disk `"auto"` values normalize to `"ask"` when read.

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
  Amended by #85: `updateMode: "auto"` is rejected as invalid.
* **Response (200 OK)**:
  ```json
  {
    "success": true
  }
  ```
