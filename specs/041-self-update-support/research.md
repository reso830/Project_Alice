# Research and Architecture Decisions: Self-Update Support

## Summary of Decisions

1. **Staging & Launcher Swap (Windows Binary Locks)**
   - **Decision**: Download the release ZIP, extract it to `data/update-staging/alice/`, and write a pending flag. The running Node server then exits. The launcher script (`Start-Alice.cmd`) is updated to run a pre-launch check: if the staging folder exists, it swaps the program directories (`app/`, `runtime/`) and the launcher itself, deletes the staging folder, and restarts the launcher.
   - **Rationale**: Node (`node.exe`) and `better-sqlite3` native binaries are locked while the process is alive on Windows. File swapping must be executed *outside* the Node process by the launcher script when Node is stopped.
   - **Alternatives considered**: Writing a separate compiled updater EXE (rejected to avoid Antivirus SmartScreen flags and excessive complexity).

2. **GitHub Releases API Integration & Caching**
   - **Decision**: Query `GET https://api.github.com/repos/reso830/Project_Alice/releases/latest` to check for updates. To protect against the 60 requests/hour unauthenticated IP rate limit, the Express backend acts as a proxy via a new `/api/update/check` endpoint. The backend caches GitHub Release queries in memory for 1 hour.
   - **Rationale**: Direct client-side fetching exposes the user's browser to aggressive rate-limiting if they reload pages. Server-side caching guarantees rate-limit compliance even under active usage.
   - **Alternatives considered**: Direct browser fetches to GitHub (rejected due to rate-limit risks).

3. **Robust Single-Instance Lockfile**
   - **Decision**: Use a versioned JSON lockfile (`data/alice.lock`) containing `pid`, `port`, and `appVersion`. Upon launch, the Express server checks if the lockfile exists. If it does:
     - Query if the `pid` is running (using `process.kill(pid, 0)`).
     - If running, verify by probing `/api/health` on `port`.
     - If both succeed, focus the existing browser and exit.
     - If either fails, the lock is stale; delete `alice.lock` and start the server.
   - **Rationale**: Replaces the minimal port-only health probe from 040. Prevents port collision false-positives and handles fallback port binding correctly.
   - **Alternatives considered**: Keep 040 port-only probe (rejected; spec explicitly requires robust install-identity aware locks).

4. **Pre-Migration Database Backup & Restore**
   - **Decision**: Before executing `db-init.js` or schema migrations on startup, the server copies `data/alice.db` to `data/alice.db.migration-backup`. If the initialization/migration succeeds, the backup is deleted. If it fails, the backup is copied back to `data/alice.db` to restore the pre-migration state, the backup is deleted, the error is logged, and startup halts.
   - **Rationale**: Prevents database corruption or half-migrated states if a migration is aborted, crashed, or contains syntax errors, satisfying the project constitution's safety guidelines.
   - **Alternatives considered**: In-memory database dry-run (rejected; SQLite does not support dry-run migrations for all DDL operations easily).

## Research References

### Windows Command Script File Swapping Behavior
Batch files (`.cmd`/`.bat`) are read line-by-line by `cmd.exe`. Overwriting the running `.cmd` file from within itself works, but to prevent parse failures on the next line, the script should execute `copy` and then immediately re-invoke the batch file via its absolute path:
```cmd
copy /y "%ROOT%data\update-staging\alice\Start-Alice.cmd" "%ROOT%Start-Alice.cmd" >nul
rem Immediately restart the script to run the new launcher code
"%ROOT%Start-Alice.cmd"
exit /b 0
```
This restarts the command interpreter, which clears the command queue and runs the new script cleanly.
