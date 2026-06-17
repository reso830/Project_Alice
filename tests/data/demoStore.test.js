import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DEMO_RECORDS } from '../../server/seeds/applicationsData.js';
import { DEMO_PROFILE } from '../../server/seeds/profileData.js';
import { buildDemoSeed, DEMO_COMPAT_AS_OF } from '../../src/data/demoSeed.js';
import * as demoStore from '../../src/data/demoStore.js';
import { computeCompatibility } from '../../src/models/compatibility.js';
import { toISODate } from '../../src/utils/date.js';

// --- storage discipline -----------------------------------------------------
//
// The demo MUST NOT write demo content to any browser-side storage. Vitest's
// node environment has no Web Storage globals by default, so install spies
// before each test and verify zero invocations after the test exercises
// the demoStore. The spies double as a safety net — if a future code path
// accidentally introduces a setItem call we'll see it.

let localStorageSpy;
let sessionStorageSpy;
let indexedDbOpenSpy;

function installStorageSpies() {
  const setItemSpy = vi.fn();
  const removeItemSpy = vi.fn();

  globalThis.localStorage = {
    getItem: vi.fn(() => null),
    setItem: setItemSpy,
    removeItem: removeItemSpy,
    clear: vi.fn(),
    key: vi.fn(),
    length: 0,
  };

  const sessionSetItemSpy = vi.fn();
  globalThis.sessionStorage = {
    getItem: vi.fn(() => null),
    setItem: sessionSetItemSpy,
    removeItem: vi.fn(),
    clear: vi.fn(),
    key: vi.fn(),
    length: 0,
  };

  const idbOpenSpy = vi.fn(() => ({}));
  globalThis.indexedDB = {
    open: idbOpenSpy,
    deleteDatabase: vi.fn(),
  };

  return { setItemSpy, sessionSetItemSpy, idbOpenSpy };
}

function uninstallStorageSpies() {
  delete globalThis.localStorage;
  delete globalThis.sessionStorage;
  delete globalThis.indexedDB;
}

function parseISODate(isoString) {
  const [year, month, day] = isoString.split('-').map(Number);
  return new Date(year, month - 1, day);
}

function shiftSeedDate(isoString) {
  const maxSourceDate = DEMO_RECORDS.reduce(
    (acc, record) => (record.last_status_update > acc ? record.last_status_update : acc),
    '',
  );
  const offsetMs = parseISODate(toISODate(new Date())).getTime() - parseISODate(maxSourceDate).getTime();
  return toISODate(new Date(parseISODate(isoString).getTime() + offsetMs));
}

function expectedCompat(application, profile = demoStore.getProfile()) {
  return computeCompatibility(profile ?? {}, application, { asOf: DEMO_COMPAT_AS_OF }).score;
}

beforeEach(() => {
  ({
    setItemSpy: localStorageSpy,
    sessionSetItemSpy: sessionStorageSpy,
    idbOpenSpy: indexedDbOpenSpy,
  } = installStorageSpies());
  demoStore.clear();
});

afterEach(() => {
  uninstallStorageSpies();
  vi.restoreAllMocks();
});

// --- loadSeed + parity ------------------------------------------------------

describe('demoStore.loadSeed + parity with SQLite seed', () => {
  it('populates 23 applications and the seeded profile', () => {
    demoStore.loadSeed();
    expect(demoStore.getAll()).toHaveLength(23);
    expect(demoStore.getProfile()).not.toBeNull();
  });

  it('is idempotent — calling loadSeed twice keeps the count at 23', () => {
    demoStore.loadSeed();
    demoStore.loadSeed();
    expect(demoStore.getAll()).toHaveLength(23);
  });

  it('mirrors DEMO_RECORDS by index on (companyName, jobTitle, status)', () => {
    demoStore.loadSeed();
    const apps = demoStore.getAll();
    expect(apps.length).toBe(DEMO_RECORDS.length);

    DEMO_RECORDS.forEach((source, index) => {
      expect(apps[index].companyName).toBe(source.company_name);
      expect(apps[index].jobTitle).toBe(source.job_title);
      expect(apps[index].status).toBe(source.status);
    });
  });

  it('mirrors SQLite seed Timeline entry counts and shifted dates by index', () => {
    demoStore.loadSeed();
    const apps = demoStore.getAll();

    DEMO_RECORDS.forEach((source, index) => {
      const sourceTimeline = JSON.parse(source.timeline);
      expect(apps[index].timeline).toHaveLength(sourceTimeline.length);
      expect(apps[index].timeline.map((entry) => entry.status))
        .toEqual(sourceTimeline.map((entry) => entry.status));
      expect(apps[index].timeline.map((entry) => entry.date))
        .toEqual(sourceTimeline.map((entry) => shiftSeedDate(entry.date)));
    });
  });

  it('getProfile() deep-equals DEMO_PROFILE', () => {
    demoStore.loadSeed();
    expect(demoStore.getProfile()).toEqual(DEMO_PROFILE);
  });

  it('anchors the most recent lastStatusUpdate to today', () => {
    demoStore.loadSeed();
    const apps = demoStore.getAll();
    const maxIso = apps.reduce(
      (acc, row) => (row.lastStatusUpdate > acc ? row.lastStatusUpdate : acc),
      '',
    );
    expect(maxIso).toBe(toISODate(new Date()));
  });

  it('assigns sequential ids 1..23 in DEMO_RECORDS order', () => {
    demoStore.loadSeed();
    const apps = demoStore.getAll();
    apps.forEach((row, index) => {
      expect(row.id).toBe(index + 1);
    });
  });

  it('seeds min years and deterministic compatibility from the shared module', () => {
    const { applications, profile } = buildDemoSeed();

    applications.forEach((row) => {
      expect(
        row.minYearsExperience === null || Number.isInteger(row.minYearsExperience),
      ).toBe(true);
      expect(row.compat).toBe(expectedCompat(row, profile));
    });
  });
});

// --- getAll / getById defensive clones --------------------------------------

describe('demoStore reads return defensive deep clones', () => {
  it('getAll() returns a new array each call', () => {
    demoStore.loadSeed();
    const first = demoStore.getAll();
    const second = demoStore.getAll();
    expect(first).not.toBe(second);
    expect(first[0]).not.toBe(second[0]);
  });

  it('mutating the result of getAll() does not affect the next read', () => {
    demoStore.loadSeed();
    const first = demoStore.getAll();
    first[0].companyName = 'Tampered Inc.';
    first[0].skills.push('SHOULD-NOT-LEAK');
    const second = demoStore.getAll();
    expect(second[0].companyName).not.toBe('Tampered Inc.');
    expect(second[0].skills).not.toContain('SHOULD-NOT-LEAK');
  });

  it('getById returns a clone for known ids and undefined for unknown ones', () => {
    demoStore.loadSeed();
    const first = demoStore.getById(1);
    expect(first.companyName).toBe(DEMO_RECORDS[0].company_name);
    first.companyName = 'Tampered';
    expect(demoStore.getById(1).companyName).toBe(DEMO_RECORDS[0].company_name);
    expect(demoStore.getById(9_999)).toBeUndefined();
  });
});

// --- create -----------------------------------------------------------------

describe('demoStore.create', () => {
  it('assigns the next id (max existing + 1) and prepends the row', () => {
    demoStore.loadSeed();
    const created = demoStore.create({
      companyName: 'New Co',
      jobTitle: 'Test Engineer',
      status: 'wishlisted',
      responsibilities: 'Demo write coverage.',
      skills: ['Vitest'],
    });
    expect(created.id).toBe(26);
    expect(demoStore.getAll()[0].id).toBe(26);
    expect(demoStore.getAll()[0].companyName).toBe('New Co');
    expect(demoStore.getAll()).toHaveLength(24);
  });

  it('assigns id=1 when the store is empty', () => {
    const created = demoStore.create({
      companyName: 'First Co',
      jobTitle: 'Initial Role',
      status: 'wishlisted',
      responsibilities: 'First seed.',
    });
    expect(created.id).toBe(1);
  });

  it('throws VALIDATION_ERROR when a required field is missing', () => {
    demoStore.loadSeed();
    let captured;
    try {
      demoStore.create({
        // companyName intentionally missing
        jobTitle: 'No Company',
        status: 'wishlisted',
        responsibilities: 'Should fail validation.',
      });
    } catch (error) {
      captured = error;
    }
    expect(captured).toBeDefined();
    expect(captured.code).toBe('VALIDATION_ERROR');
    expect(captured.fields).toHaveProperty('companyName');
  });

  it('computes compatibility from the demo profile and ignores client-supplied compat', () => {
    demoStore.loadSeed();

    const created = demoStore.create({
      companyName: 'Compatibility Co',
      jobTitle: 'React Engineer',
      status: 'wishlisted',
      responsibilities: 'Build React and TypeScript product workflows.',
      skills: ['React', 'TypeScript'],
      preferredSkills: ['GraphQL'],
      minYearsExperience: 3,
      compat: 1,
    });

    expect(created.compat).toBe(expectedCompat(created));
    expect(created.compat).not.toBe(1);
  });
});

// --- update -----------------------------------------------------------------

describe('demoStore.update', () => {
  it('merges fields and returns the updated clone', () => {
    demoStore.loadSeed();
    const updated = demoStore.update(1, { notes: 'updated note' });
    expect(updated.notes).toBe('updated note');
    expect(demoStore.getById(1).notes).toBe('updated note');
  });

  it('sets lastStatusUpdate to today when status changes', () => {
    demoStore.loadSeed();
    const today = toISODate(new Date());
    const before = demoStore.getById(2);
    // pick a status different from the seeded one
    const nextStatus = before.status === 'interview' ? 'offer' : 'interview';

    const updated = demoStore.update(2, { status: nextStatus });
    expect(updated.status).toBe(nextStatus);
    expect(updated.lastStatusUpdate).toBe(today);
  });

  it('does not bump lastStatusUpdate when the status is unchanged', () => {
    demoStore.loadSeed();
    const before = demoStore.getById(2);
    const updated = demoStore.update(2, {
      status: before.status,
      notes: 'note-only edit',
    });
    expect(updated.lastStatusUpdate).toBe(before.lastStatusUpdate);
  });

  it('ignores explicit id reassignments in the patch', () => {
    demoStore.loadSeed();
    const updated = demoStore.update(2, { id: 9_999, notes: 'patch' });
    expect(updated.id).toBe(2);
    expect(demoStore.getById(9_999)).toBeUndefined();
  });

  it('accepts a Timeline array round-trip in updates', () => {
    demoStore.loadSeed();
    const timeline = [
      { id: 1, date: toISODate(new Date()), status: 'applied', text: 'Manual demo note.' },
      { id: 2, date: toISODate(new Date()), status: 'interview', text: '' },
    ];

    const updated = demoStore.update(1, { timeline });

    expect(updated.timeline).toEqual(timeline);
    expect(demoStore.getById(1).timeline).toEqual(timeline);
  });

  it('throws NOT_FOUND for an unknown id', () => {
    demoStore.loadSeed();
    let captured;
    try {
      demoStore.update(9_999, { notes: 'will fail' });
    } catch (error) {
      captured = error;
    }
    expect(captured?.code).toBe('NOT_FOUND');
  });

  it('recomputes compatibility on update and ignores client-supplied compat', () => {
    demoStore.loadSeed();

    const updated = demoStore.update(1, {
      skills: ['React', 'TypeScript', 'GraphQL'],
      preferredSkills: ['Accessibility'],
      minYearsExperience: 2,
      compat: 1,
    });

    expect(updated.compat).toBe(expectedCompat(updated));
    expect(updated.compat).not.toBe(1);
  });
});

// --- archive ----------------------------------------------------------------

describe('demoStore.archive', () => {
  it('keeps the row in the store while moving it out of the active list', () => {
    demoStore.loadSeed();
    const initialTotal = demoStore.getAll().length + demoStore.getAllArchived().length;
    const before = demoStore.getById(1);
    const archived = demoStore.archive(1, '2030-03-10');

    expect(archived.id).toBe(1);
    expect(archived.archived).toBe(true);
    expect(archived.archivedDate).toBe('2030-03-10');
    expect(archived.fav).toBe(before.fav);
    expect(demoStore.getById(1)).toMatchObject({
      id: 1,
      archived: true,
      archivedDate: '2030-03-10',
    });
    expect(demoStore.getAll().some((row) => row.id === 1)).toBe(false);
    expect(demoStore.getAllArchived().some((row) => row.id === 1)).toBe(true);
    expect(demoStore.getAll()).toHaveLength(22);
    expect(demoStore.getAll().length + demoStore.getAllArchived().length).toBe(initialTotal);
  });

  it('sets archivedDate to today by default', () => {
    demoStore.loadSeed();
    const archived = demoStore.archive(1);

    expect(archived.archivedDate).toBe(toISODate(new Date()));
  });

  it('preserves the first archivedDate on repeated archive calls', () => {
    demoStore.loadSeed();
    const first = demoStore.archive(1, '2030-03-10');
    const second = demoStore.archive(1, '2030-04-20');

    expect(first.archivedDate).toBe('2030-03-10');
    expect(second.archivedDate).toBe('2030-03-10');
  });

  it('unarchive flips the row active again and preserves the rest of the record', () => {
    demoStore.loadSeed();
    const before = demoStore.getById(1);
    demoStore.archive(1, '2030-03-10');

    const restored = demoStore.unarchive(1);

    expect(restored).toMatchObject({
      ...before,
      archived: false,
      archivedDate: null,
    });
    expect(demoStore.getAll().some((row) => row.id === 1)).toBe(true);
    expect(demoStore.getAllArchived().some((row) => row.id === 1)).toBe(false);
  });

  it('round-trips a favorited row through archive and unarchive', () => {
    demoStore.loadSeed();
    const favorite = demoStore.getAll().find((row) => row.fav === true);

    const archived = demoStore.archive(favorite.id, '2030-03-10');
    const restored = demoStore.unarchive(favorite.id);

    expect(archived.fav).toBe(true);
    expect(restored.fav).toBe(true);
  });

  it('throws NOT_FOUND for an unknown id', () => {
    demoStore.loadSeed();
    let archiveError;
    let unarchiveError;
    try {
      demoStore.archive(9_999);
    } catch (error) {
      archiveError = error;
    }
    try {
      demoStore.unarchive(9_999);
    } catch (error) {
      unarchiveError = error;
    }
    expect(archiveError?.code).toBe('NOT_FOUND');
    expect(unarchiveError?.code).toBe('NOT_FOUND');
  });
});

// --- profile ----------------------------------------------------------------

describe('demoStore profile CRUD', () => {
  it('saveProfile replaces the profile and reads come back clean', () => {
    demoStore.loadSeed();
    const next = {
      ...DEMO_PROFILE,
      firstName: 'Sam',
      summary: 'Updated demo persona.',
    };
    const saved = demoStore.saveProfile(next);
    expect(saved.firstName).toBe('Sam');
    expect(demoStore.getProfile().firstName).toBe('Sam');
  });

  it('saveProfile throws VALIDATION_ERROR when required fields are missing', () => {
    demoStore.loadSeed();
    let captured;
    try {
      demoStore.saveProfile({ ...DEMO_PROFILE, firstName: '', lastName: '' });
    } catch (error) {
      captured = error;
    }
    expect(captured?.code).toBe('VALIDATION_ERROR');
    expect(captured.fields).toHaveProperty('firstName');
    expect(captured.fields).toHaveProperty('lastName');
  });

  it('saveProfile recomputes active application compatibility', () => {
    demoStore.loadSeed();
    const before = demoStore.getById(1);
    const nextProfile = {
      ...DEMO_PROFILE,
      summary: 'React TypeScript frontend engineer focused on design systems.',
      skills: [
        { name: 'React', level: 5 },
        { name: 'TypeScript', level: 5 },
        { name: 'CSS', level: 4 },
        { name: 'Accessibility', level: 4 },
      ],
    };

    demoStore.saveProfile(nextProfile);
    const after = demoStore.getById(1);

    expect(after.compat).toBe(expectedCompat(after, nextProfile));
    expect(after.compat).not.toBe(before.compat);
  });

  it('saveProfile leaves archived application compatibility frozen', () => {
    demoStore.loadSeed();
    const archived = demoStore.archive(1, '2030-03-10');
    const nextProfile = {
      ...DEMO_PROFILE,
      summary: 'React TypeScript frontend engineer focused on design systems.',
      skills: [
        { name: 'React', level: 5 },
        { name: 'TypeScript', level: 5 },
        { name: 'CSS', level: 4 },
        { name: 'Accessibility', level: 4 },
      ],
    };

    demoStore.saveProfile(nextProfile);

    expect(demoStore.getById(archived.id).compat).toBe(archived.compat);
  });
});

// --- clear ------------------------------------------------------------------

describe('demoStore.clear', () => {
  it('resets both applications and profile to their initial empty state', () => {
    demoStore.loadSeed();
    expect(demoStore.getAll()).toHaveLength(23);
    expect(demoStore.getProfile()).not.toBeNull();

    demoStore.clear();
    expect(demoStore.getAll()).toEqual([]);
    expect(demoStore.getProfile()).toBeNull();
  });
});

// --- storage discipline (the canonical regression guard) --------------------

describe('demoStore storage discipline', () => {
  it('does not call localStorage / sessionStorage / indexedDB across a full CRUD pass', () => {
    demoStore.loadSeed();
    const created = demoStore.create({
      companyName: 'Storage Audit Co',
      jobTitle: 'Auditor',
      status: 'wishlisted',
      responsibilities: 'Verify no browser storage writes.',
      skills: ['Audit'],
    });
    demoStore.update(created.id, { status: 'applied' });
    demoStore.archive(created.id);
    demoStore.getAll();
    demoStore.getById(1);
    demoStore.saveProfile({ ...DEMO_PROFILE, summary: 'audit pass' });
    demoStore.getProfile();
    demoStore.clear();

    expect(localStorageSpy).not.toHaveBeenCalled();
    expect(sessionStorageSpy).not.toHaveBeenCalled();
    expect(indexedDbOpenSpy).not.toHaveBeenCalled();
  });
});
