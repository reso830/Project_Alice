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
  it('imports the Vercel API entry without loading SQLite in hosted mode', () => {
    const output = execFileSync(
      process.execPath,
      ['-e', "await import('./api/index.js'); console.log('hosted import ok');"],
      {
        cwd: process.cwd(),
        env: {
          ...process.env,
          APP_RUNTIME: 'hosted',
          SUPABASE_URL: 'https://example.supabase.co',
          SUPABASE_ANON_KEY: 'anon-key',
          SUPABASE_SERVICE_ROLE_KEY: 'service-role-key',
          ALICE_DB_PATH: 'logs/__missing_dir__/alice.db',
        },
        encoding: 'utf8',
      },
    );

    expect(output).toContain('hosted import ok');
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
