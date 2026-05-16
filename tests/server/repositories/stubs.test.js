import { execFileSync } from 'node:child_process';
import process from 'node:process';
import { describe, expect, it } from 'vitest';
import {
  createRepositories,
  HostedRepositoryNotImplementedError,
} from '../../../server/repositories/index.js';

function expectHostedStub(method) {
  expect(method).toThrow(HostedRepositoryNotImplementedError);
  expect(method).toThrow(/019-supabase-persistence/);

  try {
    method();
  } catch (error) {
    expect(error.name).toBe('HostedRepositoryNotImplementedError');
  }
}

describe('hosted repository stubs', () => {
  it('does not load better-sqlite3 during hosted cold start', () => {
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

  it('throws for every applications repository method', async () => {
    const { applications } = await createRepositories({ isHosted: true });

    for (const methodName of ['getAll', 'getById', 'create', 'update', 'archive']) {
      expectHostedStub(() => applications[methodName]());
    }
  });

  it('throws for every profile repository method', async () => {
    const { profile } = await createRepositories({ isHosted: true });

    for (const methodName of ['get', 'upsert']) {
      expectHostedStub(() => profile[methodName]());
    }
  });
});
