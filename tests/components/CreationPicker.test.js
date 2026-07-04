// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const authStoreMocks = vi.hoisted(() => ({
  state: { status: 'local-mode', user: null, accessToken: null },
  subscribers: new Set(),
}));

vi.mock('../../src/data/authStore.js', () => ({
  getAuthState: () => authStoreMocks.state,
  subscribe: (fn) => {
    authStoreMocks.subscribers.add(fn);
    return () => authStoreMocks.subscribers.delete(fn);
  },
}));

vi.mock('../../src/data/aiSettings.js', () => ({
  canUseJdParser: vi.fn(),
  getFeature: vi.fn(),
  hasKey: vi.fn(),
  isEnabled: vi.fn(),
}));

vi.mock('../../src/components/JobPostingImport.js', () => ({
  JobPostingImport: { create: vi.fn() },
}));

vi.mock('../../src/components/Modal.js', () => ({
  Modal: { open: vi.fn(), close: vi.fn() },
}));

import { CreationPicker } from '../../src/components/CreationPicker.js';
import * as aiSettings from '../../src/data/aiSettings.js';
import { JobPostingImport } from '../../src/components/JobPostingImport.js';
import { Modal } from '../../src/components/Modal.js';

function setAuthState(state) {
  authStoreMocks.state = state;
  for (const fn of authStoreMocks.subscribers) {
    fn(state);
  }
}

function findCardByTitle(title) {
  return [...document.querySelectorAll('.creation-picker-card')]
    .find((card) => card.querySelector('.creation-picker-card__title')?.textContent === title);
}

describe('CreationPicker.open() callback contract (issue #41)', () => {
  beforeEach(() => {
    authStoreMocks.state = { status: 'local-mode', user: null, accessToken: null };
    authStoreMocks.subscribers.clear();
    aiSettings.isEnabled.mockReturnValue(true);
    aiSettings.getFeature.mockImplementation((key) => key === 'jd');
    aiSettings.hasKey.mockReturnValue(true);
    aiSettings.canUseJdParser.mockImplementation(() => (
      aiSettings.isEnabled() && aiSettings.getFeature('jd') && aiSettings.hasKey()
    ));
    JobPostingImport.create.mockImplementation(() => {
      const root = document.createElement('section');
      root.className = 'job-posting-import';
      root.textContent = 'Job posting import';
      return root;
    });
    Modal.open.mockClear();
    JobPostingImport.create.mockClear();
  });

  afterEach(() => {
    CreationPicker.close();
    document.body.replaceChildren();
  });

  it('forwards only the documented callbacks to Modal.open, dropping unknown keys', () => {
    const onApplicationCreate = vi.fn();
    const onApplicationUpdate = vi.fn();
    const onArchiveSuccess = vi.fn();
    const onUnarchiveSuccess = vi.fn();
    const profile = { firstName: 'Alex' };

    CreationPicker.open({
      onApplicationCreate,
      onApplicationUpdate,
      onArchiveSuccess,
      onUnarchiveSuccess,
      profile,
      prefill: { companyName: 'Should not leak' },
      mode: 'edit',
      onSubmit: vi.fn(),
    });

    findCardByTitle('Manual entry').click();

    expect(Modal.open).toHaveBeenCalledTimes(1);
    expect(Modal.open).toHaveBeenCalledWith(null, {
      mode: 'create',
      onApplicationCreate,
      onApplicationUpdate,
      onArchiveSuccess,
      onUnarchiveSuccess,
      profile,
    });
  });

  it('tolerates a missing callbacks argument', () => {
    CreationPicker.open();
    findCardByTitle('Manual entry').click();

    expect(Modal.open).toHaveBeenCalledWith(null, {
      mode: 'create',
      onApplicationCreate: undefined,
      onApplicationUpdate: undefined,
      onArchiveSuccess: undefined,
      onUnarchiveSuccess: undefined,
      profile: undefined,
    });
  });

  it('renders the §13.1 Smart and Manual entry cards when AI JD parsing is available', () => {
    CreationPicker.close();
    CreationPicker.open();

    const smart = findCardByTitle('Smart entry');

    expect(smart).not.toBeNull();
    expect(findCardByTitle('Manual entry')).not.toBeNull();
    expect(document.querySelector('.creation-picker-graphic')?.tagName).toBe('IMG');
    expect(document.querySelector('.creation-picker-graphic')?.getAttribute('src'))
      .toContain('data:image/svg+xml');
    expect(document.querySelector('.creation-picker-subtitle')?.textContent)
      .toBe('Start from a job posting, or fill it in yourself. You can edit everything afterward.');
    expect(smart.textContent).toContain('Fastest');
    expect(smart.textContent).toContain("Paste a job posting and we'll fill in the details automatically.");
    expect(smart.textContent).toContain('Pulls title, company, skills & more');
    expect(smart.textContent).toContain('Review before saving');
    expect(smart.textContent).toContain('Choose →');
  });

  it('locks Smart entry when AI JD parsing is unavailable while Manual entry remains clickable', () => {
    aiSettings.canUseJdParser.mockReturnValue(false);
    aiSettings.hasKey.mockReturnValue(false);
    const navigate = vi.fn();

    CreationPicker.open({ navigate });

    const smart = findCardByTitle('Smart entry');

    expect(smart).not.toBeNull();
    expect(smart.classList).toContain('creation-picker-card--locked');
    expect(smart.getAttribute('aria-disabled')).toBe('true');
    expect(smart.hasAttribute('role')).toBe(false);
    expect(smart.hasAttribute('tabindex')).toBe(false);
    expect(smart.querySelector('.creation-picker-card__cta').tagName).toBe('BUTTON');
    expect(smart.textContent).toContain('Enable AI in Settings →');
    expect(smart.textContent).not.toContain('Fastest');

    smart.click();

    expect(JobPostingImport.create).not.toHaveBeenCalled();
    expect(document.querySelector('.job-posting-import')).toBeNull();

    findCardByTitle('Manual entry').click();

    expect(Modal.open).toHaveBeenCalledWith(null, expect.objectContaining({ mode: 'create' }));

    CreationPicker.open({ navigate });
    findCardByTitle('Smart entry').querySelector('.creation-picker-card__cta').click();

    expect(navigate).toHaveBeenCalledWith('profile', { focusSettings: true });
  });

  it('routes unlocked Smart entry to the JD import flow', () => {
    const navigate = vi.fn();

    CreationPicker.open({ navigate });

    findCardByTitle('Smart entry').click();

    expect(JobPostingImport.create).toHaveBeenCalledWith(expect.objectContaining({
      navigate,
      onBack: expect.any(Function),
      onManual: expect.any(Function),
      onSuccess: expect.any(Function),
    }));
    expect(document.querySelector('.job-posting-import')).not.toBeNull();
    expect(document.querySelector('.creation-picker-panel')?.classList).toContain('creation-picker-panel--smart-input');
    expect(document.querySelector('.creation-picker-header')?.hidden).toBe(true);
    expect(Modal.open).not.toHaveBeenCalled();
  });

  it('opens Create modal with provenance params when the JD flow succeeds', () => {
    const onApplicationCreate = vi.fn();
    const onClosed = vi.fn();
    const target = document.createElement('aside');
    const draft = { companyName: 'Acme', jobTitle: 'Frontend Engineer' };
    const aiFieldSet = new Set(['companyName', 'jobTitle']);

    CreationPicker.open({
      onApplicationCreate,
      createOptions: { variant: 'pane', target, onClosed },
    });
    findCardByTitle('Smart entry').click();

    JobPostingImport.create.mock.calls[0][0].onSuccess({
      draft,
      aiFieldSet,
      fillSource: 'ai',
      notice: 'The posting was long, so some content may not be parsed.',
    });

    expect(Modal.open).toHaveBeenCalledWith(null, {
      mode: 'create',
      prefill: draft,
      aiFields: aiFieldSet,
      fillSource: 'ai',
      notice: 'The posting was long, so some content may not be parsed.',
      onApplicationCreate,
      onApplicationUpdate: undefined,
      onArchiveSuccess: undefined,
      onUnarchiveSuccess: undefined,
      profile: undefined,
      variant: 'pane',
      target,
      onClosed,
    });
    expect(document.querySelector('.creation-picker-backdrop')).toBeNull();
  });

  it('opens the Create modal when the JD flow asks for manual entry', () => {
    const onApplicationCreate = vi.fn();
    const onClosed = vi.fn();
    const target = document.createElement('aside');

    CreationPicker.open({
      onApplicationCreate,
      createOptions: { variant: 'pane', target, onClosed },
    });
    findCardByTitle('Smart entry').click();

    JobPostingImport.create.mock.calls[0][0].onManual();

    expect(Modal.open).toHaveBeenCalledWith(null, {
      mode: 'create',
      onApplicationCreate,
      onApplicationUpdate: undefined,
      onArchiveSuccess: undefined,
      onUnarchiveSuccess: undefined,
      profile: undefined,
      variant: 'pane',
      target,
      onClosed,
    });
    expect(document.querySelector('.creation-picker-backdrop')).toBeNull();
  });

  it('lets the JD import Back action return to the gate', () => {
    CreationPicker.open();
    findCardByTitle('Smart entry').click();

    JobPostingImport.create.mock.calls[0][0].onBack();

    expect(findCardByTitle('Smart entry')).not.toBeNull();
    expect(findCardByTitle('Manual entry')).not.toBeNull();
  });

  it('hides Smart entry in demo mode while Manual entry remains clickable', () => {
    authStoreMocks.state = { status: 'demo', user: null, accessToken: null };
    CreationPicker.open();

    expect(findCardByTitle('Smart entry')).toBeUndefined();
    expect(document.querySelector('.job-posting-import')).toBeNull();

    findCardByTitle('Manual entry').click();

    expect(JobPostingImport.create).not.toHaveBeenCalled();
    expect(Modal.open).toHaveBeenCalledWith(null, expect.objectContaining({ mode: 'create' }));
  });

  it('shows Smart entry for authenticated sessions when JD parsing is configured', () => {
    authStoreMocks.state = { status: 'authenticated', user: { id: 'user-1' }, accessToken: 'token' };

    CreationPicker.open();

    expect(findCardByTitle('Smart entry')).not.toBeNull();
    expect(findCardByTitle('Smart entry').classList).not.toContain('creation-picker-card--locked');
  });

  it('updates parser gating when auth state changes while open', () => {
    CreationPicker.open();
    expect(findCardByTitle('Smart entry')).not.toBeNull();

    setAuthState({ status: 'demo', user: null, accessToken: null });

    expect(findCardByTitle('Smart entry')).toBeUndefined();
    expect(findCardByTitle('Manual entry')).not.toBeNull();
  });
});
