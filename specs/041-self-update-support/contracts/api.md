# API Contracts: Self-Update Support

All routes are mounted relative to the backend Express server under `/api/update`.

---

## 1. Health Status (`GET /api/health`)

Updated to expose the version for single-instance checks and updater handoffs.

* **Response (200 OK)**:
  ```json
  {
    "status": "ok",
    "runtime": "local",
    "version": "1.8.0"
  }
  ```

---

## 2. Check for Updates (`GET /api/update/check`)

Checks for newer releases, proxying the GitHub Releases API. Implements 1-hour in-memory cache.

* **Response (200 OK)**:
  ```json
  {
    "updateAvailable": true,
    "currentVersion": "1.7.1",
    "latestVersion": "1.8.0",
    "releaseNotesUrl": "https://github.com/reso830/Project_Alice/releases/tag/v1.8.0",
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
