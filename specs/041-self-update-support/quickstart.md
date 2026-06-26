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

## 2. Testing Update Checks (Mock Version)

1. Open `VERSION` at the package root and change the content to:
   ```text
   1.7.0
   ```
2. Also change `appMeta.js` version constant to `'v1.7.0'`.
3. Start the application. The system will check GitHub (or a mocked release page) and display a toast: **"A new version is available: v1.8.0"**.
4. In Settings > Updates, observe the current version shows `v1.7.0` and the status block displays `Update available v1.8.0`.

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
3. The parent CMD process (`Start-Alice.cmd`) will detect `data/update-staging/alice`, copy the files, overwrite `VERSION` and `Start-Alice.cmd`, clean up staging, and re-execute itself.
4. Verify the application automatically boots into version `v1.8.0`.
