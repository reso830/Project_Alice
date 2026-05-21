import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { cwd } from 'node:process';
import { describe, expect, it } from 'vitest';
import { APP_VERSION } from '../src/pages/welcome/shared/appMeta.js';

const root = cwd();
const read = (path) => readFileSync(join(root, path), 'utf8');
const pkg = JSON.parse(read('package.json'));

describe('release metadata', () => {
  it('keeps the Phase 10 release version in sync across package, app chrome, and docs', () => {
    expect(pkg.version).toBe('0.12.0');
    expect(APP_VERSION).toBe('v0.12.0');

    expect(read('README.md')).toContain('Current version: **0.12.0**');
    expect(read('CHANGELOG.md')).toContain('## [0.12.0] — 2026-05-21');
    expect(read('CHANGELOG.md')).toContain('[Unreleased]: https://github.com/reso830/Project_Alice/compare/v0.12.0...HEAD');
    expect(read('CHANGELOG.md')).toContain('[0.12.0]: https://github.com/reso830/Project_Alice/compare/v0.11.1...v0.12.0');
  });

  it('documents the application Timeline release surfaces with resolvable links', () => {
    const readme = read('README.md');
    const deployment = read('docs/deployment.md');
    const repoMap = read('docs/REPO_MAP.md');

    expect(readme).toContain('Application Timeline');
    expect(readme).toContain('specs/025-application-timeline/');
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
});
