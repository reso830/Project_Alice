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
