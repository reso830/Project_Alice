import { execFileSync } from 'node:child_process';
import process from 'node:process';
import { describe, expect, it } from 'vitest';

// Phase 05 note: `HostedRepositoryNotImplementedError` and `createHostedStub`
// were removed when the hosted-mode dispatcher branch was replaced with the
// real Supabase adapters. Feature 020 removed the parallel demo-mode stub
// (reserved by 019) when the portfolio demo landed entirely client-side.
// The cold-start invariants below remain important (the Supabase adapters
// and client factory must also stay free of any `better-sqlite3` / PDF/DOCX
// runtime imports), so these tests stay.

describe('local dispatcher cold-start invariants', () => {
  it('does NOT load @supabase/supabase-js during local-mode startup', () => {
    // Regression guard for the Codex finding (Phase 07 close-out): the seed
    // middleware's static import chain transitively pulls in
    // `@supabase/supabase-js`. If `server/index.js` ever re-introduces a
    // static import of `./auth/seedHostedUser.js`, this test will fail.
    const script = [
      "await import('./api/index.js');",
      "const { createRequire } = await import('node:module');",
      "const { pathToFileURL } = await import('node:url');",
      "const require = createRequire(pathToFileURL(process.cwd() + '/package.json'));",
      'const cacheKeys = Object.keys(require.cache);',
      "const supabaseLoaded = cacheKeys.some((key) => key.includes('@supabase/supabase-js'));",
      "console.log(JSON.stringify({ ok: true, supabaseLoaded }));",
    ].join(' ');

    const output = execFileSync(process.execPath, ['-e', script], {
      cwd: process.cwd(),
      env: {
        ...process.env,
        APP_RUNTIME: 'local',
        // Local mode does not consume hosted env vars; leaving them unset
        // exercises the real local-boot path.
      },
      encoding: 'utf8',
      timeout: 30_000,
    });

    const result = JSON.parse(output.trim());
    expect(result.ok).toBe(true);
    expect(result.supabaseLoaded).toBe(false);
  });
});

describe('hosted dispatcher cold-start invariants', () => {
  it('does not load better-sqlite3 or document parsers during hosted cold start', () => {
    // Asserts the invariant directly via require.cache introspection. A
    // writable ALICE_DB_PATH would let SQLite open successfully even if the
    // cold-start regression returned, so we check whether the native module
    // was imported at all rather than whether opening the DB throws.
    const script = [
      "await import('./api/index.js');",
      "const { createRequire } = await import('node:module');",
      "const { pathToFileURL } = await import('node:url');",
      "const require = createRequire(pathToFileURL(process.cwd() + '/package.json'));",
      'const cacheKeys = Object.keys(require.cache);',
      "const sqliteLoaded = cacheKeys.some((key) => key.includes('better-sqlite3'));",
      "const pdfParseLoaded = cacheKeys.some((key) => key.includes('pdf-parse'));",
      "const pdfjsLoaded = cacheKeys.some((key) => key.includes('pdfjs-dist'));",
      "const mammothLoaded = cacheKeys.some((key) => key.includes('mammoth'));",
      "console.log(JSON.stringify({ ok: true, sqliteLoaded, pdfParseLoaded, pdfjsLoaded, mammothLoaded }));",
    ].join(' ');

    const output = execFileSync(process.execPath, ['-e', script], {
      cwd: process.cwd(),
      env: {
        ...process.env,
        APP_RUNTIME: 'hosted',
        SUPABASE_URL: 'https://example.supabase.co',
        SUPABASE_ANON_KEY: 'anon-key',
        SUPABASE_SERVICE_ROLE_KEY: 'service-role-key',
        // Bypass `assertHostedSchema`'s real PostgREST probes (api/index.js
        // calls them on cold start to satisfy FR-021). Without this gate
        // the test would issue three real network round-trips against
        // example.supabase.co per run.
        SKIP_HOSTED_SCHEMA_CHECK: 'true',
      },
      encoding: 'utf8',
      timeout: 30_000,
    });

    const result = JSON.parse(output.trim());
    expect(result.ok).toBe(true);
    expect(result.sqliteLoaded).toBe(false);
    expect(result.pdfParseLoaded).toBe(false);
    expect(result.pdfjsLoaded).toBe(false);
    expect(result.mammothLoaded).toBe(false);
  });
});

