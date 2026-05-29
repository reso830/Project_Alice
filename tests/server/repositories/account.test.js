import { describe, expect, it } from 'vitest';
import { getProfile, saveProfile } from '../../../server/db/profile.js';
import { createSqliteAccountRepository } from '../../../server/repositories/account.js';
import { createSqliteApplicationsRepository } from '../../../server/repositories/applications.js';
import { makeMemoryDb } from '../helpers.js';

function seed(db) {
  const apps = createSqliteApplicationsRepository(db);
  apps.create({
    companyName: 'Acme Corp',
    jobTitle: 'Frontend Engineer',
    status: 'applied',
    responsibilities: 'Build product UI',
  });
  saveProfile({ firstName: 'Ana', lastName: 'Rivera' }, db);
}

describe('createSqliteAccountRepository', () => {
  it('clears applications and profile when confirm === "DELETE"', () => {
    const db = makeMemoryDb();
    seed(db);
    const account = createSqliteAccountRepository(db);
    const apps = createSqliteApplicationsRepository(db);

    expect(apps.getAll()).toHaveLength(1);
    expect(getProfile(db)).not.toBeNull();

    const result = account.delete({ confirm: 'DELETE' });

    expect(result).toEqual({ cleared: true });
    expect(apps.getAll()).toEqual([]);
    expect(getProfile(db)).toBeNull();

    db.close();
  });

  it('throws VALIDATION_ERROR and clears nothing without a valid confirm', () => {
    const db = makeMemoryDb();
    seed(db);
    const account = createSqliteAccountRepository(db);
    const apps = createSqliteApplicationsRepository(db);

    for (const body of [{}, { confirm: 'nope' }, { confirm: 'delete' }]) {
      let thrown;
      try {
        account.delete(body);
      } catch (err) {
        thrown = err;
      }
      expect(thrown).toMatchObject({ code: 'VALIDATION_ERROR', status: 400 });
    }

    // Nothing was cleared.
    expect(apps.getAll()).toHaveLength(1);
    expect(getProfile(db)).not.toBeNull();

    db.close();
  });

  it('is a safe no-op shape when already empty', () => {
    const db = makeMemoryDb();
    const account = createSqliteAccountRepository(db);

    const result = account.delete({ confirm: 'DELETE' });

    expect(result).toEqual({ cleared: true });
    db.close();
  });
});
