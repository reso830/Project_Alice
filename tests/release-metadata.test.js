import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { cwd } from 'node:process';
import { describe, expect, it } from 'vitest';
import { APP_VERSION } from '../src/pages/welcome/shared/appMeta.js';

const root = cwd();
const read = (path) => readFileSync(join(root, path), 'utf8');
const pkg = JSON.parse(read('package.json'));

describe('release metadata', () => {
  it('keeps the 1.12.6 release version in sync across package, app chrome, and docs', () => {
    expect(pkg.version).toBe('1.12.6');
    expect(APP_VERSION).toBe('v1.12.6');

    const lock = JSON.parse(read('package-lock.json'));
    expect(lock.version).toBe('1.12.6');
    expect(lock.packages['']?.version).toBe('1.12.6');

    expect(read('README.md')).toContain('Current version: **1.12.6**');
    expect(read('CHANGELOG.md')).toContain('## [1.12.6] — 2026-07-08');
    expect(read('CHANGELOG.md')).toContain('## [1.12.5] — 2026-07-08');
    expect(read('CHANGELOG.md')).toContain('## [1.12.4] — 2026-07-07');
    expect(read('CHANGELOG.md')).toContain('## [1.12.3] — 2026-07-07');
    expect(read('CHANGELOG.md')).toContain('## [1.12.2] — 2026-07-07');
    expect(read('CHANGELOG.md')).toContain('## [1.12.1] — 2026-07-07');
    expect(read('CHANGELOG.md')).toContain('## [1.12.0] — 2026-07-07');
    expect(read('CHANGELOG.md')).toContain('## [1.11.1] — 2026-07-06');
    expect(read('CHANGELOG.md')).toContain('## [1.11.0] — 2026-07-04');
    expect(read('CHANGELOG.md')).toContain('## [1.10.8] — 2026-07-02');
    expect(read('CHANGELOG.md')).toContain('## [1.10.7] — 2026-07-01');
    expect(read('CHANGELOG.md')).toContain('## [1.10.6] — 2026-07-01');
    expect(read('CHANGELOG.md')).toContain('## [1.10.5] — 2026-07-01');
    expect(read('CHANGELOG.md')).toContain('## [1.10.4] — 2026-07-01');
    expect(read('CHANGELOG.md')).toContain('## [1.10.3] — 2026-07-01');
    expect(read('CHANGELOG.md')).toContain('## [1.10.2] — 2026-06-30');
    expect(read('CHANGELOG.md')).toContain('## [1.10.1] — 2026-06-30');
    expect(read('CHANGELOG.md')).toContain('## [1.10.0] — 2026-06-28');
    expect(read('CHANGELOG.md')).toContain('## [1.9.0] — 2026-06-22');
    expect(read('CHANGELOG.md')).toContain('## [1.8.0] — 2026-06-21');
    expect(read('CHANGELOG.md')).toContain('## [1.7.1] — 2026-06-19');
    expect(read('CHANGELOG.md')).toContain('## [1.7.0] — 2026-06-18');
    expect(read('CHANGELOG.md')).toContain('## [1.6.0] — 2026-06-11');
    expect(read('CHANGELOG.md')).toContain('## [1.5.0] — 2026-06-08');
    expect(read('CHANGELOG.md')).toContain('## [1.4.0] — 2026-06-06');
    expect(read('CHANGELOG.md')).toContain('## [1.3.0] — 2026-06-03');
    expect(read('CHANGELOG.md')).toContain('## [1.2.0] — 2026-06-02');
    expect(read('CHANGELOG.md')).toContain('## [1.1.0] — 2026-06-01');
    expect(read('CHANGELOG.md')).toContain('## [1.0.0] — 2026-05-29');
    expect(read('CHANGELOG.md')).toContain('## [0.15.0] — 2026-05-28');
    expect(read('CHANGELOG.md')).toContain('[Unreleased]: https://github.com/reso830/Project_Alice/compare/v1.12.6...HEAD');
    expect(read('CHANGELOG.md')).toContain('[1.12.6]: https://github.com/reso830/Project_Alice/compare/v1.12.5...v1.12.6');
    expect(read('CHANGELOG.md')).toContain('[1.12.5]: https://github.com/reso830/Project_Alice/compare/v1.12.4...v1.12.5');
    expect(read('CHANGELOG.md')).toContain('[1.12.4]: https://github.com/reso830/Project_Alice/compare/v1.12.3...v1.12.4');
    expect(read('CHANGELOG.md')).toContain('[1.12.3]: https://github.com/reso830/Project_Alice/compare/v1.12.2...v1.12.3');
    expect(read('CHANGELOG.md')).toContain('[1.12.2]: https://github.com/reso830/Project_Alice/compare/v1.12.1...v1.12.2');
    expect(read('CHANGELOG.md')).toContain('[1.12.1]: https://github.com/reso830/Project_Alice/compare/v1.12.0...v1.12.1');
    expect(read('CHANGELOG.md')).toContain('[1.12.0]: https://github.com/reso830/Project_Alice/compare/v1.11.1...v1.12.0');
    expect(read('CHANGELOG.md')).toContain('[1.11.1]: https://github.com/reso830/Project_Alice/compare/v1.11.0...v1.11.1');
    expect(read('CHANGELOG.md')).toContain('[1.11.0]: https://github.com/reso830/Project_Alice/compare/v1.10.8...v1.11.0');
    expect(read('CHANGELOG.md')).toContain('[1.10.8]: https://github.com/reso830/Project_Alice/compare/v1.10.7...v1.10.8');
    expect(read('CHANGELOG.md')).toContain('[1.10.7]: https://github.com/reso830/Project_Alice/compare/v1.10.6...v1.10.7');
    expect(read('CHANGELOG.md')).toContain('[1.10.6]: https://github.com/reso830/Project_Alice/compare/v1.10.5...v1.10.6');
    expect(read('CHANGELOG.md')).toContain('[1.10.5]: https://github.com/reso830/Project_Alice/compare/v1.10.4...v1.10.5');
    expect(read('CHANGELOG.md')).toContain('[1.10.4]: https://github.com/reso830/Project_Alice/compare/v1.10.3...v1.10.4');
    expect(read('CHANGELOG.md')).toContain('[1.10.3]: https://github.com/reso830/Project_Alice/compare/v1.10.2...v1.10.3');
    expect(read('CHANGELOG.md')).toContain('[1.10.2]: https://github.com/reso830/Project_Alice/compare/v1.10.1...v1.10.2');
    expect(read('CHANGELOG.md')).toContain('[1.10.1]: https://github.com/reso830/Project_Alice/compare/v1.10.0...v1.10.1');
    expect(read('CHANGELOG.md')).toContain('[1.10.0]: https://github.com/reso830/Project_Alice/compare/v1.9.0...v1.10.0');
    expect(read('CHANGELOG.md')).toContain('[1.9.0]: https://github.com/reso830/Project_Alice/compare/v1.8.0...v1.9.0');
    expect(read('CHANGELOG.md')).toContain('[1.8.0]: https://github.com/reso830/Project_Alice/compare/v1.7.1...v1.8.0');
    expect(read('CHANGELOG.md')).toContain('[1.7.1]: https://github.com/reso830/Project_Alice/compare/v1.7.0...v1.7.1');
    expect(read('CHANGELOG.md')).toContain('[1.7.0]: https://github.com/reso830/Project_Alice/compare/v1.6.0...v1.7.0');
    expect(read('CHANGELOG.md')).toContain('[1.6.0]: https://github.com/reso830/Project_Alice/compare/v1.5.0...v1.6.0');
    expect(read('CHANGELOG.md')).toContain('[1.5.0]: https://github.com/reso830/Project_Alice/compare/v1.4.0...v1.5.0');
    expect(read('CHANGELOG.md')).toContain('[1.4.0]: https://github.com/reso830/Project_Alice/compare/v1.3.0...v1.4.0');
    expect(read('CHANGELOG.md')).toContain('[1.3.0]: https://github.com/reso830/Project_Alice/compare/v1.2.0...v1.3.0');
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

  it('documents the Profile Page Refresh release surfaces with deployment notes', () => {
    const readme = read('README.md');
    const deployment = read('docs/deployment.md');
    const repoMap = read('docs/REPO_MAP.md');

    expect(readme).toContain('unified Settings');
    expect(readme).toContain('guided Setup and Import flow');
    expect(deployment).toContain('034-profile-page-refresh');
    expect(deployment).toContain('No deployment action is required');
    expect(repoMap).toContain('browser-only AI Settings');
    expect(repoMap).toContain('ask-first AI-unavailable dialogs');
    expect(repoMap).toContain('parseWithLlm(text, key, model)');
    expect(read('docs/feature_roadmap.md')).toContain('[x] 034-profile-page-refresh  ·  shipped v1.4.0');

    for (const path of [
      'specs/034-profile-page-refresh',
      'docs/features/034-profile-page-refresh.md',
      'docs/design/profile_page.md',
      'docs/design/edit_profile_page.md',
    ]) {
      expect(existsSync(join(root, path))).toBe(true);
    }
  });

  it('documents the LLM JD Parser release surfaces with resolvable links', () => {
    const readme = read('README.md');
    const deployment = read('docs/deployment.md');
    const repoMap = read('docs/REPO_MAP.md');

    expect(readme).toContain('AI job-description parsing (BYOK)');
    expect(readme).toContain('specs/035-llm-jd-parser/quickstart.md');
    expect(deployment).toContain('035-llm-jd-parser');
    expect(deployment).toContain('required for feature 035');
    expect(repoMap).toContain('src/components/JobPostingImport.js');
    expect(repoMap).toContain('parseJobWithLlm');
    expect(repoMap).toContain('canUseJdParser');
    expect(read('docs/feature_roadmap.md')).toContain('[x] 035-llm-jd-parser  ·  shipped v1.5.0');

    for (const path of [
      'specs/035-llm-jd-parser',
      'docs/features/035-llm-jd-parser.md',
      'src/components/JobPostingImport.js',
      'tests/components/JobPostingImport.test.js',
    ]) {
      expect(existsSync(join(root, path))).toBe(true);
    }
  });

  it('documents the Compatibility Engine release surfaces with resolvable links', () => {
    const readme = read('README.md');
    const deployment = read('docs/deployment.md');
    const repoMap = read('docs/REPO_MAP.md');

    expect(readme).toContain('Compatibility scoring');
    expect(deployment).toContain('036-compatibility-engine');
    expect(deployment).toContain('One-time compatibility backfill');
    expect(repoMap).toContain('src/models/compatibility.js');
    expect(repoMap).toContain('server/services/compatibility.js');
    expect(repoMap).toContain('computeCompatibility');
    expect(repoMap).toContain('recomputeActive');
    expect(read('docs/feature_roadmap.md')).toContain('[x] 036-compatibility-engine  ·  shipped v1.6.0');

    for (const path of [
      'specs/036-compatibility-engine',
      'docs/features/036-compatibility-engine.md',
      'src/models/compatibility.js',
      'server/services/compatibility.js',
      'tests/models/compatibility.test.js',
    ]) {
      expect(existsSync(join(root, path))).toBe(true);
    }
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

  it('documents the Compatibility Insights Panel release surfaces with resolvable links', () => {
    const readme = read('README.md');
    const deployment = read('docs/deployment.md');
    const repoMap = read('docs/REPO_MAP.md');

    expect(readme).toContain('Compatibility Insights Panel');
    expect(readme).toContain('specs/037-compatibility-insights-panel/');
    expect(deployment).toContain('037-compatibility-insights-panel');
    expect(deployment).toContain('compat_analysis');
    expect(deployment).toContain('compat_scored_at');
    expect(repoMap).toContain('src/components/CompatibilityModule.js');
    expect(repoMap).toContain('compatNotesService.js');
    expect(repoMap).toContain('skillProficiency.js');
    expect(repoMap).toContain('specs/037-compatibility-insights-panel/');
    expect(read('docs/feature_roadmap.md')).toContain('[x] 037-compatibility-insights-panel  ·  shipped v1.7.0');

    for (const path of [
      'specs/037-compatibility-insights-panel',
      'src/components/CompatibilityModule.js',
      'src/services/aiService.js',
      'src/services/compatNotesService.js',
      'src/utils/skillProficiency.js',
      'tests/components/CompatibilityModule.test.js',
    ]) {
      expect(existsSync(join(root, path))).toBe(true);
    }
  });

  it('documents the AI Provider Abstraction release surfaces with resolvable links', () => {
    const repoMap = read('docs/REPO_MAP.md');
    const changelog = read('CHANGELOG.md');

    expect(changelog).toContain('AI Provider Abstraction Layer');
    expect(repoMap).toContain('src/services/aiErrors.js');
    expect(repoMap).toContain('src/services/aiProvider.js');
    expect(repoMap).toContain('src/services/aiService.js');
    expect(repoMap).toContain('src/services/providers/');
    expect(repoMap).toContain('src/services/providers/openrouter.js');
    expect(repoMap).toContain('Removed in 038');
    expect(read('docs/feature_roadmap.md')).toContain('[x] 038-ai-provider-abstraction  ·  shipped v1.7.1');

    for (const path of [
      'specs/038-ai-provider-abstraction',
      'docs/features/038-ai-provider-abstraction.md',
      'src/services/aiErrors.js',
      'src/services/aiProvider.js',
      'src/services/aiService.js',
      'src/services/providers/openrouter.js',
      'tests/services/aiService.test.js',
      'tests/services/providers/openrouter.test.js',
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

  it('documents the Desktop Workspace Refresh release surfaces with resolvable links', () => {
    const readme = read('README.md');
    const repoMap = read('docs/REPO_MAP.md');

    expect(readme).toContain('Desktop master-detail workspace');
    expect(repoMap).toContain('src/components/OPanel.js');
    expect(repoMap).toContain('src/components/EmptyPane.js');
    expect(repoMap).toContain('src/utils/clampText.js');
    expect(repoMap).toContain('renderCollapsedPreview');
    expect(read('docs/feature_roadmap.md')).toContain('[x] 039-desktop-workspace-refresh  ·  shipped v1.8.0');

    for (const path of [
      'specs/039-desktop-workspace-refresh',
      'docs/features/039-desktop-workspace-refresh.md',
      'src/components/OPanel.js',
      'src/components/EmptyPane.js',
      'src/utils/clampText.js',
      'tests/components/OPanel.test.js',
      'tests/utils/clampText.test.js',
    ]) {
      expect(existsSync(join(root, path))).toBe(true);
    }
  });

  it('documents the Portable Distribution Package release surfaces with resolvable links', () => {
    const readme = read('README.md');
    const deployment = read('docs/deployment.md');
    const repoMap = read('docs/REPO_MAP.md');
    const changelog = read('CHANGELOG.md');

    expect(readme).toContain('Portable Windows package');
    expect(readme).toContain('Run the Portable Package');
    expect(readme).toContain('Start-Alice.cmd');
    expect(changelog).toContain('Portable Distribution Package');
    expect(deployment).toContain('040-portable-distribution-package');
    expect(deployment).toContain('server/portable.js');
    expect(deployment).toContain('ALICE_DB_PATH');
    expect(repoMap).toContain('server/portable.js');
    expect(repoMap).toContain('server/portable/settings.js');
    expect(repoMap).toContain('scripts/build-portable.mjs');
    expect(repoMap).toContain('release-portable.yml');
    expect(read('docs/feature_roadmap.md')).toContain('[x] 040-portable-distribution-package  ·  shipped v1.9.0');

    for (const path of [
      'specs/040-portable-distribution-package',
      'docs/features/040-portable-distribution-package.md',
      'server/portable.js',
      'server/portable/settings.js',
      'server/portable/listen.js',
      'scripts/build-portable.mjs',
      'scripts/portable/Start-Alice.cmd',
      'config/settings.default.json',
      '.github/workflows/release-portable.yml',
      'tests/server/staticServing.test.js',
      'tests/server/portableBootstrap.test.js',
    ]) {
      expect(existsSync(join(root, path))).toBe(true);
    }
  });

  it('documents the Self-Update Support release surfaces with resolvable links', () => {
    const readme = read('README.md');
    const repoMap = read('docs/REPO_MAP.md');
    const changelog = read('CHANGELOG.md');

    expect(readme).toContain('Self-update (portable, Windows)');
    expect(readme).toContain('specs/041-self-update-support/quickstart.md');
    expect(changelog).toContain('Self-Update Support');
    expect(repoMap).toContain('server/routes/update.js');
    expect(repoMap).toContain('server/portable/lock.js');
    expect(repoMap).toContain('server/db/migration.js');
    expect(repoMap).toContain('src/components/UpdateToast.js');
    expect(repoMap).toContain('updateSupported');
    expect(read('docs/feature_roadmap.md')).toContain('[x] 041-self-update-support  ·  shipped v1.10.0');

    for (const path of [
      'specs/041-self-update-support',
      'docs/features/041-self-update-support.md',
      'server/routes/update.js',
      'server/portable/lock.js',
      'server/db/migration.js',
      'server/db/migrations/001-init.js',
      'src/components/UpdateToast.js',
      'tests/unit/update.test.js',
    ]) {
      expect(existsSync(join(root, path))).toBe(true);
    }
  });

  it('documents the Hosted Startup Performance release surfaces with resolvable links', () => {
    const readme = read('README.md');
    const deployment = read('docs/deployment.md');
    const repoMap = read('docs/REPO_MAP.md');
    const changelog = read('CHANGELOG.md');

    expect(readme).toContain('Faster hosted startup');
    expect(readme).toContain('specs/044-hosted-startup-performance/');
    expect(deployment).toContain('044-hosted-startup-performance');
    expect(deployment).toContain('Hosted Startup Performance — no new env vars');
    expect(changelog).toContain('Hosted startup performance');
    expect(repoMap).toContain('buildTrackerBootSkeleton');
    expect(repoMap).toContain('shared/startupLoader.js');
    expect(repoMap).toContain('code-splitting.test.js');
    expect(repoMap).toContain('font-loading.test.js');
    expect(read('docs/feature_roadmap.md')).toContain('[x] 044-hosted-startup-performance  ·  shipped v1.12.0');

    for (const path of [
      'specs/044-hosted-startup-performance',
      'docs/features/044-hosted-startup-performance.md',
      'HostedAlice_StartupLoader/design_handoff_startup_loader',
      'shared/startupLoader.js',
      'tests/build/code-splitting.test.js',
      'tests/build/font-loading.test.js',
      'specs/044-hosted-startup-performance/metrics.md',
    ]) {
      expect(existsSync(join(root, path))).toBe(true);
    }
  });
});
