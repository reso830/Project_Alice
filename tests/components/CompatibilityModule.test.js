// @vitest-environment jsdom
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { cwd } from 'node:process';
import { afterEach, describe, expect, it, vi } from 'vitest';

const compatNotesServiceMock = vi.hoisted(() => ({
  generateNotes: vi.fn(),
}));

const apiMock = vi.hoisted(() => ({
  saveCompatNotes: vi.fn(),
}));

vi.mock('../../src/services/compatNotesService.js', () => compatNotesServiceMock);
vi.mock('../../src/services/api.js', () => apiMock);

const mainCss = readFileSync(join(cwd(), 'src/styles/main.css'), 'utf8').replace(/\r\n/g, '\n');

function application(overrides = {}) {
  return {
    id: 7,
    compat: 86,
    compatAnalysis: null,
    compatScoredAt: '2026-06-17T10:00:00.000Z',
    jobTitle: 'Frontend Engineer',
    skills: ['React'],
    preferredSkills: ['GraphQL'],
    ...overrides,
  };
}

function profile(overrides = {}) {
  return {
    summary: 'Frontend engineer.',
    skills: [{ name: 'React', level: 5 }],
    experience: [{ role: 'Frontend Engineer' }],
    ...overrides,
  };
}

function aiSettings(overrides = {}) {
  return {
    hasKey: () => true,
    isEnabled: () => true,
    getFeature: (key) => key === 'compat',
    getKey: () => 'sk-or-test',
    getModel: () => 'openai/gpt-4o-mini',
    ...overrides,
  };
}

function render(props = {}) {
  const { CompatibilityModule } = props.module;
  return CompatibilityModule.render({
    application: application(props.application),
    profile: props.profile === undefined ? profile() : props.profile,
    aiSettings: props.aiSettings ?? aiSettings(),
    onNotesGenerated: props.onNotesGenerated ?? vi.fn(),
    onOpenSettings: props.onOpenSettings ?? vi.fn(),
    onOpenProfile: props.onOpenProfile ?? vi.fn(),
  });
}

async function loadModule() {
  return import('../../src/components/CompatibilityModule.js');
}

afterEach(async () => {
  const module = await loadModule();
  module.resetCompatibilityModuleState();
  document.body.replaceChildren();
  compatNotesServiceMock.generateNotes.mockReset();
  apiMock.saveCompatNotes.mockReset();
});

describe('CompatibilityModule helpers', () => {
  it.each([
    [39, 'Low'],
    [40, 'Medium'],
    [64, 'Medium'],
    [65, 'High'],
    [84, 'High'],
    [85, 'Great'],
  ])('returns the tier at boundary score %i', async (score, label) => {
    const { getTier } = await loadModule();

    expect(getTier(score).label).toBe(label);
  });

  it('renders a score ring SVG with tier color and no zero-score arc', async () => {
    const { renderScoreRing } = await loadModule();

    const greatRing = renderScoreRing(90, 64);
    const zeroRing = renderScoreRing(0, 64);

    expect(greatRing.tagName.toLowerCase()).toBe('svg');
    expect(greatRing.getAttribute('width')).toBe('64');
    expect(greatRing.querySelector('.ring-arc')?.getAttribute('stroke')).toBe('#2563EB');
    expect(greatRing.querySelector('.ring-num')?.textContent).toBe('90');
    expect(greatRing.querySelector('.ring-num')?.getAttribute('font-size')).toBe('20');
    expect(zeroRing.querySelector('.ring-arc')?.getAttribute('stroke-dasharray')).toMatch(/^0 /);
  });

  it.each([
    ['none', { compatAnalysis: null, compatScoredAt: '2026-06-17T10:00:00.000Z' }, null],
    [
      'fresh',
      {
        compatAnalysis: {
          summary: 'Fresh fit',
          body: 'Fresh body.',
          generatedAt: '2026-06-17T10:00:00.000Z',
        },
        compatScoredAt: '2026-06-17T10:00:00.000Z',
      },
      null,
    ],
    [
      'stale',
      {
        compatAnalysis: {
          summary: 'Old fit',
          body: 'Old body.',
          generatedAt: '2026-06-17T09:59:59.999Z',
        },
        compatScoredAt: '2026-06-17T10:00:00.000Z',
      },
      null,
    ],
    ['generating', { compatAnalysis: null, compatScoredAt: null }, 'generating'],
    ['error', { compatAnalysis: null, compatScoredAt: null }, 'error'],
  ])('derives %s notes state from application data and local state', async (expected, app, localState) => {
    const { deriveNotesState } = await loadModule();

    expect(deriveNotesState(app, localState)).toBe(expected);
  });

  it.each([
    [{ summary: '', skills: [], experience: [] }, false],
    [{ summary: 'A profile summary.', skills: [], experience: [] }, true],
    [{ skills: [{ name: 'React', level: 4 }], experience: [] }, true],
    [{ skills: [], experience: [{ role: 'Frontend Engineer' }] }, true],
    [null, false],
  ])('detects profile sufficiency for %o', async (candidate, expected) => {
    const { isProfileSufficient } = await loadModule();

    expect(isProfileSufficient(candidate)).toBe(expected);
  });
});

describe('CompatibilityModule rendering', () => {
  it('starts collapsed with live score, verdict, and notes-none copy', async () => {
    const module = await loadModule();
    const root = render({ module });

    expect(root.querySelector('.cx-collapsed-content')).toBeTruthy();
    expect(root.querySelector('.cx-panel')).toBeNull();
    expect(root.querySelector('.ring-num')?.textContent).toBe('86');
    expect(root.querySelector('.cx-verdict-text')?.textContent).toBe('Great');
    expect(root.textContent).toContain('Notes not generated');
  });

  it('expands and collapses the full panel with a 64px score ring', async () => {
    const module = await loadModule();
    const root = render({ module });
    const toggle = root.querySelector('.sec-toggle');

    expect(root.querySelector('.cx-header .ai-tag')).toBeNull();
    expect(toggle?.querySelector('.sec-chev')?.textContent).toBe('›');

    toggle.click();

    expect(root.querySelector('.cx-panel')).toBeTruthy();
    expect(root.querySelector('.cx-collapsed-content')).toBeNull();
    expect(root.querySelector('.cx-score-row svg')?.getAttribute('width')).toBe('64');
    expect(root.querySelector('.sec-toggle')?.textContent).toContain('Collapse');
    expect(root.querySelector('.sec-toggle')?.getAttribute('aria-expanded')).toBe('true');

    root.querySelector('.sec-toggle').click();

    expect(root.querySelector('.cx-panel')).toBeNull();
    expect(root.querySelector('.cx-collapsed-content')).toBeTruthy();
    expect(root.querySelector('.sec-toggle')?.getAttribute('aria-expanded')).toBe('false');
  });

  it('persists open and generating state across same-application re-renders', async () => {
    const module = await loadModule();
    const firstRoot = render({ module });

    firstRoot.querySelector('.sec-toggle').click();
    expect(firstRoot.querySelector('.cx-panel')).toBeTruthy();

    const rerenderedRoot = render({ module });
    expect(rerenderedRoot.querySelector('.cx-panel')).toBeTruthy();

    compatNotesServiceMock.generateNotes.mockReturnValue(new Promise(() => {}));
    rerenderedRoot.querySelector('.cx-gen-btn').click();
    await Promise.resolve();

    const inFlightRoot = render({ module });
    expect(inFlightRoot.querySelector('.cx-skel')).toBeTruthy();
    expect(inFlightRoot.querySelector('.cx-skel')?.getAttribute('aria-live')).toBe('polite');
    expect(inFlightRoot.querySelector('.cx-skel')?.getAttribute('aria-busy')).toBe('true');
  });

  it.each([
    ['fresh', { summary: 'Strong fit', body: 'Good match.', generatedAt: '2026-06-17T11:00:00.000Z' }, 'Strong fit'],
    ['stale', { summary: 'Old fit', body: 'Old analysis.', generatedAt: '2026-06-16T09:00:00.000Z' }, 'Update available'],
  ])('renders collapsed %s trailing content', async (_state, notes, expectedText) => {
    const module = await loadModule();
    const root = render({
      module,
      application: {
        compatAnalysis: notes,
        compatScoredAt: '2026-06-17T10:00:00.000Z',
      },
    });

    expect(root.querySelector('.cx-collapsed-content')?.textContent).toContain(expectedText);
  });

  it('renders the none state prompt, AI disabled link, create disabled button, and generating skeleton', async () => {
    const module = await loadModule();
    const root = render({ module });
    root.querySelector('.sec-toggle').click();

    expect(root.querySelector('.cx-gen-inline')?.textContent).toContain('No written analysis yet');
    expect(root.querySelector('.cx-gen-btn')?.disabled).toBe(false);

    compatNotesServiceMock.generateNotes.mockReturnValue(new Promise(() => {}));
    root.querySelector('.cx-gen-btn').click();
    await Promise.resolve();
    expect(root.querySelector('.cx-skel')?.textContent).toContain('Writing analysis');
    expect(root.querySelector('.ring-num')?.textContent).toBe('86');

    module.resetCompatibilityModuleState();
    const disabledAi = render({
      module,
      aiSettings: aiSettings({ hasKey: () => false }),
    });
    disabledAi.querySelector('.sec-toggle').click();
    expect(disabledAi.querySelector('.cx-enable-ai')?.textContent).toContain('Enable AI');

    module.resetCompatibilityModuleState();
    const disabledCompat = render({
      module,
      aiSettings: aiSettings({ getFeature: () => false }),
    });
    disabledCompat.querySelector('.sec-toggle').click();
    expect(disabledCompat.querySelector('.cx-enable-ai')?.textContent).toContain('Enable AI');

    module.resetCompatibilityModuleState();
    const createRoot = render({ module, application: { id: null } });
    expect(createRoot.querySelector('.sec-toggle')).toBeNull();
    expect(createRoot.querySelector('.cx-unsaved')?.textContent).toContain('Scored after you save');
    expect(createRoot.querySelector('.cx-unsaved')?.textContent).toContain('Create this application');
    expect(createRoot.querySelector('.cx-unsaved .cx-empty-ic-img')?.tagName.toLowerCase()).toBe('img');
    expect(createRoot.querySelector('.cx-unsaved')?.textContent).not.toContain('Create →');
  });

  it('routes the Enable AI link through the settings callback', async () => {
    const module = await loadModule();
    const onOpenSettings = vi.fn();
    const root = render({
      module,
      aiSettings: aiSettings({ hasKey: () => false }),
      onOpenSettings,
    });
    root.querySelector('.sec-toggle').click();

    root.querySelector('.cx-enable-ai').click();

    expect(onOpenSettings).toHaveBeenCalledTimes(1);
  });

  it('renders existing notes as read-only history when AI is off', async () => {
    const module = await loadModule();
    const onOpenSettings = vi.fn();
    const root = render({
      module,
      aiSettings: aiSettings({ hasKey: () => false }),
      onOpenSettings,
      application: {
        compatAnalysis: {
          summary: 'Strong React fit',
          body: 'Historical analysis.',
          generatedAt: '2026-06-09T10:00:00.000Z',
        },
        compatScoredAt: '2026-06-09T10:00:00.000Z',
      },
    });
    root.querySelector('.sec-toggle').click();

    expect(root.querySelector('.cx-notes')?.classList.contains('cx-notes--readonly')).toBe(true);
    expect(root.querySelector('.cx-regen')).toBeNull();
    expect(root.querySelector('.cx-foot-r .cx-enable-ai')?.textContent).toBe('Enable AI →');
    root.querySelector('.cx-foot-r .cx-enable-ai').click();
    expect(onOpenSettings).toHaveBeenCalledTimes(1);
  });

  it('renders stale notes with a neutral read-only bar when AI is off', async () => {
    const module = await loadModule();
    const root = render({
      module,
      aiSettings: aiSettings({ isEnabled: () => false }),
      application: {
        compatAnalysis: {
          summary: 'Old React fit',
          body: 'Older analysis.',
          generatedAt: '2026-06-08T10:00:00.000Z',
        },
        compatScoredAt: '2026-06-09T10:00:00.000Z',
      },
    });
    root.querySelector('.sec-toggle').click();

    expect(root.querySelector('.cx-stale-bar')?.classList.contains('cx-stale-bar--readonly')).toBe(true);
    expect(root.querySelector('.cx-stale-bar')?.textContent)
      .toContain("These notes are out of date and can't be refreshed while AI is off");
    expect(root.querySelector('.cx-stale-btn')).toBeNull();
    expect(root.querySelector('.cx-regen')).toBeNull();
    expect(root.querySelectorAll('.cx-enable-ai')).toHaveLength(1);
    expect(root.querySelector('.ring-num')?.textContent).toBe('86');
  });

  it('renders fresh notes with clamped prose, formatted date, and show more toggle', async () => {
    const module = await loadModule();
    const root = render({
      module,
      application: {
        compatAnalysis: {
          summary: 'Strong React fit',
          body: 'This has **strong** React overlap.',
          generatedAt: '2026-06-09T10:00:00.000Z',
        },
        compatScoredAt: '2026-06-09T10:00:00.000Z',
      },
    });
    root.querySelector('.sec-toggle').click();

    expect(root.querySelector('.cx-headline')?.textContent).toBe('Strong React fit');
    expect(root.querySelector('.cx-rule')).toBeTruthy();
    const analysisAiTag = root.querySelector('.cx-notes-head .ai-tag');
    expect(analysisAiTag?.querySelector('.ai-tag__icon')?.tagName.toLowerCase()).toBe('img');
    expect(analysisAiTag?.textContent).toBe('AI');
    expect(root.querySelector('.cx-header .ai-tag')).toBeNull();
    expect(root.querySelector('.cx-notes')?.classList.contains('clamp')).toBe(true);
    expect(root.querySelector('.cx-notes strong')?.textContent).toBe('strong');
    expect(root.querySelector('.cx-meta')?.textContent).toContain('Generated Jun 9');
    expect(root.querySelector('.cx-regen')?.textContent).toContain('Regenerate');
    expect(root.querySelector('.cx-showmore')?.getAttribute('aria-expanded')).toBe('false');

    root.querySelector('.cx-showmore').click();
    expect(root.querySelector('.cx-notes')?.classList.contains('clamp')).toBe(false);
    expect(root.querySelector('.cx-showmore')?.textContent).toContain('Show less');
    expect(root.querySelector('.cx-showmore')?.getAttribute('aria-expanded')).toBe('true');
  });

  it('keeps generated analysis layout aligned to the design standard', () => {
    expect(mainCss).toContain('.cx-headline {\n  margin: 0;\n  color: var(--t1);\n  font: 800 15px/1.35 var(--font-ui);');
    expect(mainCss).toContain('.cx-rule {\n  height: 1px;\n  background: #E6E0F7;');
    expect(mainCss).toContain('.cx-notes-region {\n  display: grid;\n  gap: 16px;');
    expect(mainCss).toContain('.cx-foot-r {\n  display: flex;\n  align-items: center;\n  gap: 10px;');
    expect(mainCss).toContain('.cx-meta {\n  color: var(--t3);\n  font: 10px/1.2 var(--font-mono);');
    expect(mainCss).toContain('.cx-regen {\n  font-size: 11px;');
    expect(mainCss).toContain('.cx-collapsed-content {\n  min-height: 34px;');
    expect(mainCss).toContain('.cx-collapsed-content {\n  min-height: 34px;\n  gap: 9px;\n  padding: 0;');
    expect(mainCss).toContain('.cx-gen-inline {\n  display: flex;');
    expect(mainCss).toContain('.cx-gen-txt {\n  flex: 1 1 auto;\n  min-width: 0;\n  font: 12px/1.4 var(--font-ui);');
    expect(mainCss).toContain('.cx-gen-inline {\n    align-items: stretch;\n    flex-direction: column;');
    expect(mainCss).toContain('.cx-empty {\n  display: flex;\n  align-items: center;\n  gap: 14px;\n  padding: 16px 14px;\n  border: 1px dashed #D1D5DB;\n  background: #FAFAFA;');
    expect(mainCss).toContain('.cx-empty:not(.cx-unsaved) .cx-empty-act {\n    justify-content: center;\n    margin-left: 0;\n    width: 100%;');
  });

  it('renders bold markdown containing internal asterisks', async () => {
    const module = await loadModule();
    const root = render({
      module,
      application: {
        compatAnalysis: {
          summary: 'Syntax fit',
          body: 'Matches **Use * for lists** guidance.',
          generatedAt: '2026-06-09T10:00:00.000Z',
        },
        compatScoredAt: '2026-06-09T10:00:00.000Z',
      },
    });
    root.querySelector('.sec-toggle').click();

    expect(root.querySelector('.cx-notes strong')?.textContent).toBe('Use * for lists');
  });

  it('renders stale notes with amber warning while keeping the score visible', async () => {
    const module = await loadModule();
    const root = render({
      module,
      application: {
        compatAnalysis: {
          summary: 'Old React fit',
          body: 'Older analysis.',
          generatedAt: '2026-06-08T10:00:00.000Z',
        },
        compatScoredAt: '2026-06-09T10:00:00.000Z',
      },
    });
    root.querySelector('.sec-toggle').click();

    expect(root.querySelector('.cx-stale-bar')?.textContent)
      .toContain('Your profile or job data changed after these notes were written');
    expect(root.querySelector('.cx-notes')?.classList.contains('stale')).toBe(true);
    expect(root.querySelector('.cx-regen')?.textContent).toContain('Refresh');
    expect(root.querySelector('.ring-num')?.textContent).toBe('86');
  });

  it('treats missing compatScoredAt as fresh for legacy rows', async () => {
    const module = await loadModule();
    const root = render({
      module,
      application: {
        compatAnalysis: {
          summary: 'Legacy notes',
          body: 'Legacy analysis.',
          generatedAt: '2026-06-08T10:00:00.000Z',
        },
        compatScoredAt: null,
      },
    });
    root.querySelector('.sec-toggle').click();

    expect(root.querySelector('.cx-stale-bar')).toBeNull();
    expect(root.querySelector('.cx-headline')?.textContent).toBe('Legacy notes');
  });

  it('renders no-profile state without a toggle', async () => {
    const module = await loadModule();
    const onOpenProfile = vi.fn();
    const root = render({ module, profile: { summary: '', skills: [], experience: [] }, onOpenProfile });

    expect(root.querySelector('.cx-empty')?.textContent).toContain('Compatibility unavailable');
    expect(root.querySelector('.cx-empty-act')?.textContent).toContain('Complete profile');
    expect(root.querySelector('.sec-toggle')).toBeNull();
    expect(root.querySelector('.ai-tag')).toBeNull();
    root.querySelector('.cx-empty-act').click();
    expect(onOpenProfile).toHaveBeenCalledTimes(1);

    const skillsOnly = render({ module, profile: { skills: [{ name: 'React', level: 4 }] } });
    expect(skillsOnly.querySelector('.sec-toggle')).toBeTruthy();
  });

  it('renders compact mode with mobile ring size', async () => {
    const module = await loadModule();
    const root = render({ module, application: { compatAnalysis: { summary: 'Fit', body: 'Body', generatedAt: '2026-06-17T10:00:00.000Z' } } });

    root.classList.add('compact');
    root.querySelector('.sec-toggle').click();

    expect(root.querySelector('.cx-score-row svg')?.getAttribute('width')).toBe('58');
  });
});

describe('CompatibilityModule generation flow', () => {
  it('flows from none to generating to fresh and notifies the parent', async () => {
    const module = await loadModule();
    const onNotesGenerated = vi.fn();
    compatNotesServiceMock.generateNotes.mockResolvedValue({
      summary: 'Generated fit',
      body: 'Generated body.',
    });
    apiMock.saveCompatNotes.mockResolvedValue({
      summary: 'Generated fit',
      body: 'Generated body.',
      generatedAt: '2026-06-17T11:00:00.000Z',
    });
    const root = render({ module, onNotesGenerated });
    root.querySelector('.sec-toggle').click();

    root.querySelector('.cx-gen-btn').click();
    await Promise.resolve();

    expect(root.querySelector('.cx-skel')).toBeTruthy();

    await vi.waitFor(() => {
      expect(root.querySelector('.cx-headline')?.textContent).toBe('Generated fit');
    });
    expect(apiMock.saveCompatNotes).toHaveBeenCalledWith(7, {
      summary: 'Generated fit',
      body: 'Generated body.',
    });
    expect(onNotesGenerated).toHaveBeenCalledWith(expect.objectContaining({ summary: 'Generated fit' }));
    expect(onNotesGenerated.mock.calls[0][0]).not.toHaveProperty('compatAnalysis');
  });

  it('unwraps API data payloads before rendering and notifying the parent', async () => {
    const module = await loadModule();
    const onNotesGenerated = vi.fn();
    compatNotesServiceMock.generateNotes.mockResolvedValue({
      summary: 'Wrapped fit',
      body: 'Wrapped body.',
    });
    apiMock.saveCompatNotes.mockResolvedValue({
      data: {
        summary: 'Wrapped fit',
        body: 'Wrapped body.',
        generatedAt: '2026-06-17T11:00:00.000Z',
      },
    });
    const root = render({ module, onNotesGenerated });
    root.querySelector('.sec-toggle').click();

    root.querySelector('.cx-gen-btn').click();

    await vi.waitFor(() => {
      expect(root.querySelector('.cx-headline')?.textContent).toBe('Wrapped fit');
    });
    expect(onNotesGenerated).toHaveBeenCalledWith({
      summary: 'Wrapped fit',
      body: 'Wrapped body.',
      generatedAt: '2026-06-17T11:00:00.000Z',
    });
  });

  it('ignores duplicate generate clicks while a request is in flight', async () => {
    const module = await loadModule();
    compatNotesServiceMock.generateNotes.mockReturnValue(new Promise(() => {}));
    const root = render({ module });
    root.querySelector('.sec-toggle').click();
    const generateButton = root.querySelector('.cx-gen-btn');

    generateButton.click();
    generateButton.click();
    await Promise.resolve();

    expect(compatNotesServiceMock.generateNotes).toHaveBeenCalledTimes(1);
  });

  it('renders error state for LLM and API failures and retries', async () => {
    const module = await loadModule();
    compatNotesServiceMock.generateNotes
      .mockRejectedValueOnce(new Error('nope'))
      .mockResolvedValueOnce({ summary: 'Retry fit', body: 'Retry body.' });
    apiMock.saveCompatNotes.mockResolvedValue({
      summary: 'Retry fit',
      body: 'Retry body.',
      generatedAt: '2026-06-17T11:00:00.000Z',
    });
    const root = render({ module });
    root.querySelector('.sec-toggle').click();

    root.querySelector('.cx-gen-btn').click();
    await vi.waitFor(() => {
      expect(root.querySelector('.cx-error-bar')?.textContent)
        .toContain("Couldn't write the analysis");
    });
    expect(root.querySelector('.cx-error-bar')?.getAttribute('role')).toBe('alert');
    expect(root.querySelector('.ring-num')?.textContent).toBe('86');

    root.querySelector('.cx-retry-btn').click();
    await Promise.resolve();
    expect(root.querySelector('.cx-skel')).toBeTruthy();
    await vi.waitFor(() => {
      expect(root.querySelector('.cx-headline')?.textContent).toBe('Retry fit');
    });

    module.resetCompatibilityModuleState();
    compatNotesServiceMock.generateNotes.mockResolvedValueOnce({ summary: 'API fit', body: 'Body.' });
    apiMock.saveCompatNotes.mockRejectedValueOnce(new Error('api'));
    const apiFailRoot = render({ module });
    apiFailRoot.querySelector('.sec-toggle').click();
    apiFailRoot.querySelector('.cx-gen-btn').click();
    await vi.waitFor(() => {
      expect(apiFailRoot.querySelector('.cx-error-bar')).toBeTruthy();
    });
  });
});
