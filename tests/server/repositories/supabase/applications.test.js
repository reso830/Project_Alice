import { describe, expect, it, vi } from 'vitest';
import { createSupabaseApplicationsRepository } from '../../../../server/repositories/supabase/applications.js';

const USER_ID = 'user-uuid-abc';

// Mock-builder for the PostgREST fluent chain. Each test customizes the
// terminal value (the awaited result of `.maybeSingle()` / `.single()` /
// `.order(...)`) and inspects the chain calls afterward.
function makeChainMock(terminalValue) {
  // The full set of chain methods we use, all returning the same `chain`
  // reference (so .from().select().eq().eq() composes), except for the
  // terminal methods that resolve to the terminalValue.
  const calls = [];
  const record = (method) => (...args) => {
    calls.push({ method, args });
    return chain;
  };
  const recordTerminal = (method) => (...args) => {
    calls.push({ method, args });
    return Promise.resolve(terminalValue);
  };
  const recordOrder = (...args) => {
    calls.push({ method: 'order', args });
    return Promise.resolve(terminalValue);
  };
  const chain = {
    from: record('from'),
    select: record('select'),
    insert: record('insert'),
    update: record('update'),
    eq: record('eq'),
    order: recordOrder,
    maybeSingle: recordTerminal('maybeSingle'),
    single: recordTerminal('single'),
  };
  return { chain, calls };
}

function makeClient(terminalValue) {
  const { chain, calls } = makeChainMock(terminalValue);
  const client = {
    from: vi.fn(() => {
      calls.push({ method: 'from', args: ['applications'] });
      return chain;
    }),
  };
  return { client, chain, calls };
}

// Helper to find call args by method name in the recorded call log.
function callsOf(calls, method) {
  return calls.filter((c) => c.method === method);
}

describe('createSupabaseApplicationsRepository', () => {
  describe('getAll', () => {
    it('scopes by user_id and excludes archived rows', async () => {
      const { client, calls } = makeClient({
        data: [],
        error: null,
      });
      const repo = createSupabaseApplicationsRepository(client, USER_ID);

      const result = await repo.getAll();

      expect(result).toEqual([]);

      // Validate the .eq() chain — user_id scoping and archived filter both present.
      const eqCalls = callsOf(calls, 'eq');
      const eqArgs = eqCalls.map((c) => c.args);
      expect(eqArgs).toContainEqual(['user_id', USER_ID]);
      // archived filter uses native boolean (Postgres bool column).
      expect(eqArgs).toContainEqual(['archived', false]);

      // Order by created_at desc.
      const orderCalls = callsOf(calls, 'order');
      expect(orderCalls[0].args).toEqual([
        'created_at',
        { ascending: false },
      ]);
    });

    it('throws PostgREST errors', async () => {
      const { client } = makeClient({
        data: null,
        error: new Error('rls denied'),
      });
      const repo = createSupabaseApplicationsRepository(client, USER_ID);
      await expect(repo.getAll()).rejects.toThrow('rls denied');
    });

    it('returns empty array when data is null', async () => {
      const { client } = makeClient({ data: null, error: null });
      const repo = createSupabaseApplicationsRepository(client, USER_ID);
      expect(await repo.getAll()).toEqual([]);
    });

    it('maps snake_case rows to camelCase records (no user_id in output)', async () => {
      const { client } = makeClient({
        data: [
          {
            id: 1,
            company_name: 'Acme',
            job_title: 'FE',
            status: 'applied',
            compat: 50,
            fav: 0,
            archived: 0,
            skills: ['js'],
            preferred_skills: [],
            metadata: null,
            timeline: [],
            min_years_experience: 3,
            application_date: '2026-05-01',
            last_status_update: '2026-05-01',
            created_at: '2026-05-01',
            updated_at: '2026-05-01',
          },
        ],
        error: null,
      });
      const repo = createSupabaseApplicationsRepository(client, USER_ID);
      const [first] = await repo.getAll();

      expect(first).toMatchObject({
        id: 1,
        companyName: 'Acme',
        jobTitle: 'FE',
        status: 'applied',
        archived: false,
        minYearsExperience: 3,
      });
      expect(first).not.toHaveProperty('user_id');
      expect(first).not.toHaveProperty('company_name');
    });
  });

  describe('getAllArchived', () => {
    it('scopes by user_id and includes archived rows only', async () => {
      const { client, calls } = makeClient({ data: [], error: null });
      const repo = createSupabaseApplicationsRepository(client, USER_ID);

      const result = await repo.getAllArchived();

      expect(result).toEqual([]);
      const eqArgs = callsOf(calls, 'eq').map((c) => c.args);
      expect(eqArgs).toContainEqual(['user_id', USER_ID]);
      expect(eqArgs).toContainEqual(['archived', true]);
      expect(callsOf(calls, 'order')[0].args).toEqual([
        'created_at',
        { ascending: false },
      ]);
    });
  });

  describe('getById', () => {
    it('scopes by id and user_id, returns null when not found', async () => {
      const { client, calls } = makeClient({ data: null, error: null });
      const repo = createSupabaseApplicationsRepository(client, USER_ID);

      const result = await repo.getById(42);

      expect(result).toBeNull();
      const eqArgs = callsOf(calls, 'eq').map((c) => c.args);
      expect(eqArgs).toContainEqual(['id', 42]);
      expect(eqArgs).toContainEqual(['user_id', USER_ID]);
      expect(callsOf(calls, 'maybeSingle')).toHaveLength(1);
    });

    it('translates row to record on hit', async () => {
      const { client } = makeClient({
        data: {
          id: 7,
          company_name: 'Beta',
          job_title: 'BE',
          status: 'interview',
          compat: 80,
          fav: 1,
          archived: 0,
          skills: [],
          preferred_skills: [],
          metadata: null,
          timeline: [],
        },
        error: null,
      });
      const repo = createSupabaseApplicationsRepository(client, USER_ID);

      const result = await repo.getById(7);

      expect(result).toMatchObject({
        id: 7,
        companyName: 'Beta',
        fav: true,
      });
      expect(result).not.toHaveProperty('user_id');
    });
  });

  describe('create', () => {
    it('sets user_id from context and strips user_id from input', async () => {
      const { client, calls } = makeClient({
        data: {
          id: 1,
          company_name: 'Acme',
          job_title: 'FE',
          status: 'applied',
          compat: 0,
          fav: 0,
          archived: 0,
          skills: [],
          preferred_skills: [],
        },
        error: null,
      });
      const repo = createSupabaseApplicationsRepository(client, USER_ID);

      await repo.create({
        companyName: 'Acme',
        jobTitle: 'FE',
        status: 'applied',
        user_id: 'attacker-uuid', // should be stripped
      });

      const insertCall = callsOf(calls, 'insert')[0];
      const insertedRow = insertCall.args[0];

      expect(insertedRow.user_id).toBe(USER_ID);
      expect(insertedRow.user_id).not.toBe('attacker-uuid');
      expect(insertedRow.company_name).toBe('Acme');
      expect(insertedRow.job_title).toBe('FE');
      expect(insertedRow.status).toBe('applied');
    });

    it('applies SQLite-parity defaults (status, compat, fav, skills, archived, metadata)', async () => {
      const { client, calls } = makeClient({
        data: { id: 1 },
        error: null,
      });
      const repo = createSupabaseApplicationsRepository(client, USER_ID);

      await repo.create({ companyName: 'X', jobTitle: 'Y' });

      const insertedRow = callsOf(calls, 'insert')[0].args[0];
      expect(insertedRow.status).toBe('wishlisted'); // STATUS_VALUES[0]
      expect(insertedRow.compat).toBe(0);
      // fav and archived are normalized to booleans for Postgres bool columns.
      expect(insertedRow.fav).toBe(false);
      expect(insertedRow.archived).toBe(false);
      expect(insertedRow.metadata).toBeNull();
      expect(insertedRow.min_years_experience).toBeNull();
      expect(insertedRow.compat_notes).toBeNull();
      expect(insertedRow.compat_analysis).toBeNull();
      expect(insertedRow.compat_scored_at).toBeNull();
      // skills (jsonb) is normalized from JSON-stringified to a native array.
      expect(insertedRow.skills).toEqual([]);
      expect(insertedRow.timeline).toEqual([]);
      expect(insertedRow.created_at).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(insertedRow.updated_at).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(insertedRow.last_status_update).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    });

    it('normalizes SQLite-shaped fields (int booleans, JSON strings) to Postgres types', async () => {
      // Caller passes camelCase fields with SQLite-style values; toRow
      // produces int 0/1 for fav/archived and JSON-stringified arrays for
      // skills/preferredSkills/metadata. The adapter MUST normalize these
      // to native bool/object/array before PostgREST sees them, otherwise
      // Postgres rejects the insert with a type-mismatch error.
      const { client, calls } = makeClient({ data: { id: 1 }, error: null });
      const repo = createSupabaseApplicationsRepository(client, USER_ID);

      await repo.create({
        companyName: 'X',
        jobTitle: 'Y',
        fav: true,
        archived: false,
        skills: ['js', 'ts'],
        preferredSkills: ['storybook'],
        metadata: { source: 'manual' },
        timeline: [{ id: 1, date: '2026-05-21', status: 'applied', text: 'Submitted.' }],
        minYearsExperience: 4,
      });

      const row = callsOf(calls, 'insert')[0].args[0];
      expect(typeof row.fav).toBe('boolean');
      expect(typeof row.archived).toBe('boolean');
      expect(Array.isArray(row.skills)).toBe(true);
      expect(row.skills).toEqual(['js', 'ts']);
      expect(Array.isArray(row.preferred_skills)).toBe(true);
      expect(row.preferred_skills).toEqual(['storybook']);
      expect(typeof row.metadata).toBe('object');
      expect(row.metadata).toEqual({ source: 'manual' });
      expect(Array.isArray(row.timeline)).toBe(true);
      expect(row.timeline).toEqual([
        { id: 1, date: '2026-05-21', status: 'applied', text: 'Submitted.' },
      ]);
      expect(row.min_years_experience).toBe(4);
    });

    it('throws on PostgREST error', async () => {
      const { client } = makeClient({
        data: null,
        error: new Error('check constraint'),
      });
      const repo = createSupabaseApplicationsRepository(client, USER_ID);
      await expect(
        repo.create({ companyName: 'X', jobTitle: 'Y' }),
      ).rejects.toThrow('check constraint');
    });
  });

  describe('update', () => {
    it('strips user_id from input', async () => {
      const { client, calls } = makeClient({
        data: { id: 1, company_name: 'X', job_title: 'Y', status: 'applied' },
        error: null,
      });
      const repo = createSupabaseApplicationsRepository(client, USER_ID);

      await repo.update(1, {
        notes: 'updated',
        user_id: 'attacker-uuid',
      });

      const updateCall = callsOf(calls, 'update')[0];
      const updatedRow = updateCall.args[0];

      expect(updatedRow).not.toHaveProperty('user_id');
      expect(updatedRow.notes).toBe('updated');
      expect(updatedRow.updated_at).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    });

    it('passes timeline to PostgREST as an array on update', async () => {
      const { client, calls } = makeClient({
        data: { id: 1, timeline: [{ id: 1, date: '2026-05-21', status: 'applied', text: '' }] },
        error: null,
      });
      const repo = createSupabaseApplicationsRepository(client, USER_ID);

      await repo.update(1, {
        timeline: [{ id: 1, date: '2026-05-21', status: 'applied', text: '' }],
      });

      const updatedRow = callsOf(calls, 'update')[0].args[0];
      expect(updatedRow.timeline).toEqual([
        { id: 1, date: '2026-05-21', status: 'applied', text: '' },
      ]);
    });

    it('passes min_years_experience through on update', async () => {
      const { client, calls } = makeClient({
        data: { id: 1, min_years_experience: 5 },
        error: null,
      });
      const repo = createSupabaseApplicationsRepository(client, USER_ID);

      await repo.update(1, { minYearsExperience: 5 });

      const updatedRow = callsOf(calls, 'update')[0].args[0];
      expect(updatedRow.min_years_experience).toBe(5);
    });

    it('passes compatibility analysis and score timestamp through as plain text columns', async () => {
      const notes = {
        summary: 'Strong React fit',
        body: 'React and TypeScript line up with the role.',
        generatedAt: '2026-06-17T10:34:56.789Z',
      };
      const { client, calls } = makeClient({
        data: {
          id: 1,
          compat_analysis: notes,
          compat_scored_at: notes.generatedAt,
        },
        error: null,
      });
      const repo = createSupabaseApplicationsRepository(client, USER_ID);

      await repo.update(1, {
        compatAnalysis: notes,
        compatScoredAt: notes.generatedAt,
      });

      const updatedRow = callsOf(calls, 'update')[0].args[0];
      expect(updatedRow.compat_analysis).toBe(JSON.stringify(notes));
      expect(updatedRow.compat_scored_at).toBe(notes.generatedAt);
    });

    it('scopes UPDATE by id AND user_id', async () => {
      const { client, calls } = makeClient({
        data: { id: 1 },
        error: null,
      });
      const repo = createSupabaseApplicationsRepository(client, USER_ID);

      await repo.update(1, { notes: 'x' });

      const eqArgs = callsOf(calls, 'eq').map((c) => c.args);
      expect(eqArgs).toContainEqual(['id', 1]);
      expect(eqArgs).toContainEqual(['user_id', USER_ID]);
    });

    it('returns null on no-row-matched (cross-user attempt)', async () => {
      const { client } = makeClient({ data: null, error: null });
      const repo = createSupabaseApplicationsRepository(client, USER_ID);
      expect(await repo.update(99, { notes: 'x' })).toBeNull();
    });

    it('sets last_status_update when status changes', async () => {
      // Two clients: the first answers the getById call (current.status),
      // the second handles the actual UPDATE.
      const getterChain = makeChainMock({
        data: { id: 1, status: 'applied', company_name: 'X', job_title: 'Y' },
        error: null,
      });
      const updaterChain = makeChainMock({
        data: { id: 1, status: 'interview', company_name: 'X', job_title: 'Y' },
        error: null,
      });

      // We need a single `client.from()` to return getter for SELECT and
      // updater for UPDATE — distinguish by call index.
      let fromCallCount = 0;
      const client = {
        from: vi.fn(() => {
          fromCallCount += 1;
          return fromCallCount === 1 ? getterChain.chain : updaterChain.chain;
        }),
      };

      const repo = createSupabaseApplicationsRepository(client, USER_ID);
      await repo.update(1, { status: 'interview' });

      const updateRow = callsOf(updaterChain.calls, 'update')[0].args[0];
      expect(updateRow.status).toBe('interview');
      expect(updateRow.last_status_update).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(updateRow.updated_at).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    });

    it('does not set last_status_update when status is unchanged', async () => {
      const getterChain = makeChainMock({
        data: { id: 1, status: 'applied', company_name: 'X', job_title: 'Y' },
        error: null,
      });
      const updaterChain = makeChainMock({
        data: { id: 1 },
        error: null,
      });
      let fromCallCount = 0;
      const client = {
        from: vi.fn(() => {
          fromCallCount += 1;
          return fromCallCount === 1 ? getterChain.chain : updaterChain.chain;
        }),
      };

      const repo = createSupabaseApplicationsRepository(client, USER_ID);
      await repo.update(1, { status: 'applied' });

      const updateRow = callsOf(updaterChain.calls, 'update')[0].args[0];
      expect(updateRow).not.toHaveProperty('last_status_update');
    });

    it('returns current state when no translatable fields are provided', async () => {
      // Input contains only unrecognized fields (no FIELD_TO_COLUMN match).
      // SQLite's update() returns current; Supabase adapter must mirror.
      const { client, calls } = makeClient({
        data: {
          id: 1,
          company_name: 'X',
          job_title: 'Y',
          status: 'applied',
        },
        error: null,
      });
      const repo = createSupabaseApplicationsRepository(client, USER_ID);

      const result = await repo.update(1, { unknownField: 'ignored' });

      // The adapter does NOT call .update() if no translatable fields.
      expect(callsOf(calls, 'update')).toHaveLength(0);
      // It DOES call getById to return current state.
      expect(result).toMatchObject({ id: 1, companyName: 'X' });
    });
  });

  describe('archive', () => {
    it('sets archived=true and archived_date without clearing fav', async () => {
      const { client, calls } = makeClient({
        data: { id: 1, archived: true, archived_date: '2030-03-10', fav: true },
        error: null,
      });
      const repo = createSupabaseApplicationsRepository(client, USER_ID);

      await repo.archive(1, '2030-03-10');

      const updateRow = callsOf(calls, 'update')[0].args[0];
      expect(updateRow.archived).toBe(true);
      expect(updateRow.archived_date).toBe('2030-03-10');
      expect(updateRow).not.toHaveProperty('fav');
      expect(updateRow.updated_at).toBe('2030-03-10');
    });

    it('scopes UPDATE by id, user_id, and active archived state', async () => {
      const { client, calls } = makeClient({
        data: { id: 1, archived: true, fav: true },
        error: null,
      });
      const repo = createSupabaseApplicationsRepository(client, USER_ID);
      await repo.archive(1);

      const eqArgs = callsOf(calls, 'eq').map((c) => c.args);
      expect(eqArgs).toContainEqual(['id', 1]);
      expect(eqArgs).toContainEqual(['user_id', USER_ID]);
      expect(eqArgs).toContainEqual(['archived', false]);
    });

    it('falls back to getById when already archived or missing', async () => {
      const updateChain = makeChainMock({ data: null, error: null });
      const getByIdChain = makeChainMock({
        data: {
          id: 1,
          company_name: 'X',
          job_title: 'Y',
          status: 'applied',
          archived: true,
          archived_date: '2026-05-26',
          fav: true,
          skills: [],
          preferred_skills: [],
          metadata: null,
          timeline: [],
        },
        error: null,
      });
      let fromCallCount = 0;
      const client = {
        from: vi.fn(() => {
          fromCallCount += 1;
          return fromCallCount === 1 ? updateChain.chain : getByIdChain.chain;
        }),
      };
      const repo = createSupabaseApplicationsRepository(client, USER_ID);

      const result = await repo.archive(1, '2026-06-01');

      expect(result.archivedDate).toBe('2026-05-26');
      expect(result.fav).toBe(true);
      expect(callsOf(getByIdChain.calls, 'maybeSingle')).toHaveLength(1);
    });
  });

  describe('unarchive', () => {
    it('sets archived=false and clears archived_date without changing fav or status', async () => {
      const { client, calls } = makeClient({
        data: { id: 1, archived: false, archived_date: null, fav: true, status: 'rejected' },
        error: null,
      });
      const repo = createSupabaseApplicationsRepository(client, USER_ID);

      await repo.unarchive(1, '2030-03-11');

      const updateRow = callsOf(calls, 'update')[0].args[0];
      expect(updateRow).toEqual({
        archived: false,
        archived_date: null,
        updated_at: '2030-03-11',
      });
    });

    it('scopes UPDATE by id, user_id, and archived state', async () => {
      const { client, calls } = makeClient({ data: { id: 1, archived: false }, error: null });
      const repo = createSupabaseApplicationsRepository(client, USER_ID);

      await repo.unarchive(1);

      const eqArgs = callsOf(calls, 'eq').map((c) => c.args);
      expect(eqArgs).toContainEqual(['id', 1]);
      expect(eqArgs).toContainEqual(['user_id', USER_ID]);
      expect(eqArgs).toContainEqual(['archived', true]);
    });

    it('falls back to getById when already active or missing', async () => {
      const updateChain = makeChainMock({ data: null, error: null });
      const getByIdChain = makeChainMock({
        data: {
          id: 1,
          company_name: 'X',
          job_title: 'Y',
          status: 'applied',
          archived: false,
          archived_date: null,
          fav: true,
          skills: [],
          preferred_skills: [],
          metadata: null,
          timeline: [],
        },
        error: null,
      });
      let fromCallCount = 0;
      const client = {
        from: vi.fn(() => {
          fromCallCount += 1;
          return fromCallCount === 1 ? updateChain.chain : getByIdChain.chain;
        }),
      };
      const repo = createSupabaseApplicationsRepository(client, USER_ID);

      const result = await repo.unarchive(1, '2026-06-01');

      expect(result.archived).toBe(false);
      expect(result.archivedDate).toBeNull();
      expect(callsOf(getByIdChain.calls, 'maybeSingle')).toHaveLength(1);
    });
  });

  // Issue #43 — caller-supplied `now` must be persisted into audit columns
  // so they reflect the user's local "today" from X-Client-Date instead of
  // the server's UTC fallback.
  describe('caller-supplied `now` (#43)', () => {
    it('create() persists the supplied `now` into created_at, updated_at, last_status_update', async () => {
      const { client, calls } = makeClient({ data: { id: 1 }, error: null });
      const repo = createSupabaseApplicationsRepository(client, USER_ID);

      await repo.create({ companyName: 'X', jobTitle: 'Y' }, '2030-01-15');

      const row = callsOf(calls, 'insert')[0].args[0];
      expect(row.created_at).toBe('2030-01-15');
      expect(row.updated_at).toBe('2030-01-15');
      expect(row.last_status_update).toBe('2030-01-15');
    });

    it('update() persists the supplied `now` into updated_at', async () => {
      const { client, calls } = makeClient({
        data: { id: 1, company_name: 'X', job_title: 'Y', status: 'applied' },
        error: null,
      });
      const repo = createSupabaseApplicationsRepository(client, USER_ID);

      await repo.update(1, { notes: 'updated' }, '2030-02-20');

      const row = callsOf(calls, 'update')[0].args[0];
      expect(row.updated_at).toBe('2030-02-20');
    });

    it('update() persists the supplied `now` into last_status_update on a status change', async () => {
      const getterChain = makeChainMock({
        data: { id: 1, status: 'applied', company_name: 'X', job_title: 'Y' },
        error: null,
      });
      const updaterChain = makeChainMock({
        data: { id: 1, status: 'interview' },
        error: null,
      });
      let fromCallCount = 0;
      const client = {
        from: vi.fn(() => {
          fromCallCount += 1;
          return fromCallCount === 1 ? getterChain.chain : updaterChain.chain;
        }),
      };
      const repo = createSupabaseApplicationsRepository(client, USER_ID);

      await repo.update(1, { status: 'interview' }, '2030-02-20');

      const row = callsOf(updaterChain.calls, 'update')[0].args[0];
      expect(row.updated_at).toBe('2030-02-20');
      expect(row.last_status_update).toBe('2030-02-20');
    });

    it('archive() persists the supplied `now` into updated_at', async () => {
      const { client, calls } = makeClient({
        data: { id: 1, archived: true, fav: true },
        error: null,
      });
      const repo = createSupabaseApplicationsRepository(client, USER_ID);

      await repo.archive(1, '2030-03-10');

      const row = callsOf(calls, 'update')[0].args[0];
      expect(row.updated_at).toBe('2030-03-10');
    });
  });

  describe('response shape invariants (FR-017)', () => {
    it('user_id is never exposed in any method output', async () => {
      const sampleRow = {
        id: 1,
        user_id: 'leaked-uuid',
        company_name: 'X',
        job_title: 'Y',
        status: 'applied',
        compat: 0,
        fav: 0,
        archived: 0,
        skills: [],
        preferred_skills: [],
      };

      // Even if Supabase accidentally returns user_id in a row, toRecord
      // (in db/columns.js) does not project it. This is the defensive
      // second layer behind the explicit .select(...) projection.
      const { client: getAllClient } = makeClient({
        data: [sampleRow],
        error: null,
      });
      const repo1 = createSupabaseApplicationsRepository(
        getAllClient,
        USER_ID,
      );
      const [getAllResult] = await repo1.getAll();
      expect(getAllResult).not.toHaveProperty('user_id');

      const { client: getByIdClient } = makeClient({
        data: sampleRow,
        error: null,
      });
      const repo2 = createSupabaseApplicationsRepository(
        getByIdClient,
        USER_ID,
      );
      expect(await repo2.getById(1)).not.toHaveProperty('user_id');

      const { client: createClient } = makeClient({
        data: sampleRow,
        error: null,
      });
      const repo3 = createSupabaseApplicationsRepository(
        createClient,
        USER_ID,
      );
      expect(
        await repo3.create({ companyName: 'X', jobTitle: 'Y' }),
      ).not.toHaveProperty('user_id');
    });
  });
});
