import { execFileSync } from 'node:child_process';
import process from 'node:process';
import { describe, expect, it } from 'vitest';
import {
  createRepositories,
  DemoRepositoryNotImplementedError,
} from '../../../server/repositories/index.js';

function expectDemoStub(method) {
  expect(method).toThrow(DemoRepositoryNotImplementedError);
  expect(method).toThrow(/feature 020/);

  try {
    method();
  } catch (error) {
    expect(error.name).toBe('DemoRepositoryNotImplementedError');
  }
}

// Phase 05 note: `HostedRepositoryNotImplementedError` and `createHostedStub`
// were removed when the hosted-mode dispatcher branch was replaced with the
// real Supabase adapters. The cold-start invariant below remains important
// (the Supabase adapters and client factory must also stay free of any
// `better-sqlite3` / PDF/DOCX runtime imports), so this test stays.

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

describe('demo repository stubs', () => {
  it('throws for every applications repository method', async () => {
    const dispatcher = await createRepositories({ isDemo: true });
    const { applications } = dispatcher.forRequest({});

    for (const methodName of ['getAll', 'getById', 'create', 'update', 'archive']) {
      expectDemoStub(() => applications[methodName]());
    }
  });

  it('throws for every profile repository method', async () => {
    const dispatcher = await createRepositories({ isDemo: true });
    const { profile } = dispatcher.forRequest({});

    for (const methodName of ['get', 'upsert']) {
      expectDemoStub(() => profile[methodName]());
    }
  });

  it('error message names the missing repository and points to feature 020', async () => {
    const dispatcher = await createRepositories({ isDemo: true });
    const { applications } = dispatcher.forRequest({});

    expect(() => applications.getAll()).toThrow(/applications/);
    expect(() => applications.getAll()).toThrow(/feature 020/);
  });
});
