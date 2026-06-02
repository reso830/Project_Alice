import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { cwd } from 'node:process';
import { describe, expect, it } from 'vitest';
import { APP_VERSION } from '../src/pages/welcome/shared/appMeta.js';

const root = cwd();
const read = (path) => readFileSync(join(root, path), 'utf8');
const pkg = JSON.parse(read('package.json'));

describe('release metadata', () => {
  it('keeps the 1.2.0 release version in sync across package, app chrome, and docs', () => {
    expect(pkg.version).toBe('1.2.0');
    expect(APP_VERSION).toBe('v1.2.0');

    const lock = JSON.parse(read('package-lock.json'));
    expect(lock.version).toBe('1.2.0');
    expect(lock.packages['']?.version).toBe('1.2.0');

    expect(read('README.md')).toContain('Current version: **1.2.0**');
    expect(read('CHANGELOG.md')).toContain('## [1.2.0] — 2026-06-02');
    expect(read('CHANGELOG.md')).toContain('## [1.1.0] — 2026-06-01');
    expect(read('CHANGELOG.md')).toContain('## [1.0.0] — 2026-05-29');
    expect(read('CHANGELOG.md')).toContain('## [0.15.0] — 2026-05-28');
    expect(read('CHANGELOG.md')).toContain('[Unreleased]: https://github.com/reso830/Project_Alice/compare/v1.2.0...HEAD');
    expect(read('CHANGELOG.md')).toContain('[1.2.0]: https://github.com/reso830/Project_Alice/compare/v1.1.0...v1.2.0');
    expect(read('CHANGELOG.md')).toContain('[1.1.0]: https://github.com/reso830/Project_Alice/compare/v1.0.0...v1.1.0');
    expect(read('CHANGELOG.md')).toContain('[1.0.0]: https://github.com/reso830/Project_Alice/compare/v0.15.0...v1.0.0');
    expect(read('CHANGELOG.md')).toContain('[0.15.0]: https://github.com/reso830/Project_Alice/compare/v0.14.0...v0.15.0');
    expect(read('CHANGELOG.md')).toContain('[0.14.0]: https://github.com/reso830/Project_Alice/compare/v0.13.3...v0.14.0');
    expect(read('CHANGELOG.md')).toContain('[0.13.3]: https://github.com/reso830/Project_Alice/compare/v0.13.2...v0.13.3');
    expect(read('CHANGELOG.md')).toContain('[0.13.2]: https://github.com/reso830/Project_Alice/compare/v0.13.1...v0.13.2');
    expect(read('CHANGELOG.md')).toContain('[0.13.1]: https://github.com/reso830/Project_Alice/compare/v0.13.0...v0.13.1');
    expect(read('CHANGELOG.md')).toContain('[0.13.0]: https://github.com/reso830/Project_Alice/compare/v0.12.0...v0.13.0');
  });

  it('documents the application Timeline release surfaces with resolvable links', () => {
    const readme = read('README.md');
    const deployment = read('docs/deployment.md');
    const repoMap = read('docs/REPO_MAP.md');

    expect(readme).toContain('Application Timeline');
    expect(readme).toContain('docs/design/application_timeline.md');
    expect(deployment).toContain('specs/025-application-timeline/quickstart.md');
    expect(repoMap).toContain('src/components/Timeline.js');
    expect(repoMap).toContain('tests/components/Timeline.test.js');
    expect(repoMap).toContain('tests/models/timeline.test.js');
    expect(repoMap).toContain('specs/025-application-timeline/');
    expect(repoMap).toContain('TimelineEntry helpers');

    for (const path of [
      'specs/025-application-timeline',
      'docs/design/application_timeline.md',
      'specs/025-application-timeline/quickstart.md',
      'src/components/Timeline.js',
      'tests/components/Timeline.test.js',
      'tests/models/timeline.test.js',
    ]) {
      expect(existsSync(join(root, path))).toBe(true);
    }
  });

  it('documents the Calendar release surfaces with resolvable links', () => {
    const readme = read('README.md');
    const deployment = read('docs/deployment.md');
    const repoMap = read('docs/REPO_MAP.md');

    expect(readme).toContain('Calendar page');
    expect(readme).toContain('docs/design/calendar.md');
    expect(deployment).toContain('docs/db/claim_and_seed_starter.md');
    expect(repoMap).toContain('src/components/calendar/ActionPanel.js');
    expect(repoMap).toContain('src/components/calendar/MonthGrid.js');
    expect(repoMap).toContain('src/utils/calendarSuggestions.js');
    expect(repoMap).toContain('tests/pages/Calendar.test.js');
    expect(repoMap).toContain('specs/026-calendar/');

    for (const path of [
      'specs/026-calendar',
      'docs/design/calendar.md',
      'src/pages/Calendar.js',
      'src/components/calendar/ActionPanel.js',
      'src/components/calendar/MonthGrid.js',
      'src/utils/calendarSuggestions.js',
      'tests/pages/Calendar.test.js',
    ]) {
      expect(existsSync(join(root, path))).toBe(true);
    }
  });

  it('documents the Archive Applications view release surfaces with resolvable links', () => {
    const readme = read('README.md');
    const deployment = read('docs/deployment.md');
    const repoMap = read('docs/REPO_MAP.md');

    expect(readme).toContain('Archive Applications view');
    expect(deployment).toContain('specs/028-archive-applications-view/data-model.md');
    expect(deployment).toContain('specs/028-archive-applications-view/quickstart.md');
    expect(repoMap).toContain('specs/028-archive-applications-view/');
    expect(repoMap).toContain('archived_date');
    expect(repoMap).toContain('getAllArchived');
    expect(repoMap).toContain('unarchive');

    for (const path of [
      'specs/028-archive-applications-view',
      'specs/028-archive-applications-view/spec.md',
      'specs/028-archive-applications-view/data-model.md',
      'specs/028-archive-applications-view/quickstart.md',
    ]) {
      expect(existsSync(join(root, path))).toBe(true);
    }
  });

  it('documents the Delete Profile & User Data release surfaces with resolvable links', () => {
    const readme = read('README.md');
    const deployment = read('docs/deployment.md');
    const repoMap = read('docs/REPO_MAP.md');

    expect(readme).toContain('Delete Profile');
    expect(readme).toContain('specs/030-delete-profile-data/');
    expect(deployment).toContain('specs/030-delete-profile-data/');
    expect(repoMap).toContain('server/routes/account.js');
    expect(repoMap).toContain('server/repositories/supabase/adminClient.js');
    expect(repoMap).toContain('src/components/DeleteAccountModal.js');
    expect(repoMap).toContain('specs/030-delete-profile-data/');

    for (const path of [
      'specs/030-delete-profile-data',
      'specs/030-delete-profile-data/spec.md',
      'specs/030-delete-profile-data/contracts/api.md',
      'server/routes/account.js',
      'server/repositories/supabase/adminClient.js',
      'src/components/DeleteAccountModal.js',
    ]) {
      expect(existsSync(join(root, path))).toBe(true);
    }
  });
});
