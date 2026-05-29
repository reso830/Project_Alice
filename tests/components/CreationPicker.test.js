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

vi.mock('../../src/utils/jobPostParser.js', () => ({
  parseJobPost: vi.fn(),
}));

vi.mock('../../src/components/Modal.js', () => ({
  Modal: { open: vi.fn(), close: vi.fn() },
}));

import { CreationPicker } from '../../src/components/CreationPicker.js';
import { Modal } from '../../src/components/Modal.js';
import { parseJobPost } from '../../src/utils/jobPostParser.js';

const PARSEABLE_TEXT = 'Acme is hiring a Frontend Engineer to build JavaScript user interfaces for a growing team.';

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

function openPasteStep() {
  CreationPicker.open();
  findCardByTitle('Smart Parser').click();
  return {
    textarea: document.querySelector('.parser-textarea'),
    processBtn: document.querySelector('.parser-process-btn'),
    loading: document.querySelector('.parser-loading'),
  };
}

async function flushPromises(count = 2) {
  for (let index = 0; index < count; index += 1) {
    await Promise.resolve();
  }
}

describe('CreationPicker.open() callback contract (issue #41)', () => {
  beforeEach(() => {
    authStoreMocks.state = { status: 'local-mode', user: null, accessToken: null };
    authStoreMocks.subscribers.clear();
    Modal.open.mockClear();
    parseJobPost.mockReset();
    parseJobPost.mockReturnValue({ companyName: 'Acme', jobTitle: 'Frontend Engineer' });
  });

  afterEach(() => {
    CreationPicker.close();
    document.body.replaceChildren();
  });

  it('forwards only the documented callbacks to Modal.open, dropping unknown keys', () => {
    const onApplicationCreate = vi.fn();
    const onApplicationUpdate = vi.fn();
    const onArchiveSuccess = vi.fn();

    CreationPicker.open({
      onApplicationCreate,
      onApplicationUpdate,
      onArchiveSuccess,
      prefill: { companyName: 'Should not leak' },
      mode: 'edit',
      onSubmit: vi.fn(),
    });

    findCardByTitle('Manual Entry').click();

    expect(Modal.open).toHaveBeenCalledTimes(1);
    expect(Modal.open).toHaveBeenCalledWith(null, {
      mode: 'create',
      onApplicationCreate,
      onApplicationUpdate,
      onArchiveSuccess,
    });
  });

  it('tolerates a missing callbacks argument', () => {
    CreationPicker.open();
    findCardByTitle('Manual Entry').click();

    expect(Modal.open).toHaveBeenCalledWith(null, {
      mode: 'create',
      onApplicationCreate: undefined,
      onApplicationUpdate: undefined,
      onArchiveSuccess: undefined,
    });
  });

  it('marks Process busy and locks textarea during parser work', async () => {
    let resolveParse;
    parseJobPost.mockReturnValue(new Promise((resolve) => {
      resolveParse = resolve;
    }));
    const { textarea, processBtn, loading } = openPasteStep();
    textarea.value = PARSEABLE_TEXT;
    textarea.dispatchEvent(new Event('input'));

    processBtn.click();
    processBtn.click();

    expect(processBtn.textContent).toBe('Processing...');
    expect(processBtn.getAttribute('aria-busy')).toBe('true');
    expect(processBtn.disabled).toBe(true);
    expect(textarea.disabled).toBe(true);
    expect(loading.hidden).toBe(false);
    expect(loading.textContent).toBe('Analyzing job post...');
    expect(parseJobPost).toHaveBeenCalledTimes(1);

    resolveParse({ companyName: 'Acme', jobTitle: 'Frontend Engineer' });
    await flushPromises();

    expect(Modal.open).toHaveBeenCalledWith(null, expect.objectContaining({
      mode: 'create',
      prefill: expect.objectContaining({ companyName: 'Acme' }),
    }));
  });

  it('renders inline parser failure and retries with the current textarea content', async () => {
    parseJobPost
      .mockRejectedValueOnce(new Error('parse failed'))
      .mockResolvedValueOnce({ companyName: 'Globex', jobTitle: 'Backend Engineer' });
    const { textarea, processBtn, loading } = openPasteStep();
    textarea.value = PARSEABLE_TEXT;
    textarea.dispatchEvent(new Event('input'));

    processBtn.click();
    await flushPromises();

    const retry = loading.querySelector('.inline-error__retry');
    expect(loading.querySelector('.inline-error__message')?.textContent)
      .toBe("Couldn't analyze the job post. Try again.");
    expect(retry).not.toBeNull();
    expect(textarea.disabled).toBe(false);

    textarea.value = `${PARSEABLE_TEXT} Remote role.`;
    retry.click();

    expect(parseJobPost).toHaveBeenCalledTimes(2);
    expect(parseJobPost).toHaveBeenLastCalledWith(`${PARSEABLE_TEXT} Remote role.`);
    expect(processBtn.getAttribute('aria-busy')).toBe('true');
    expect(loading.textContent).toBe('Analyzing job post...');

    await flushPromises();

    expect(Modal.open).toHaveBeenCalledWith(null, expect.objectContaining({
      prefill: expect.objectContaining({ companyName: 'Globex' }),
    }));
  });

  it('reopens with a fresh empty picker after closing mid-parse', () => {
    parseJobPost.mockReturnValue(new Promise(() => {}));
    const { textarea, processBtn } = openPasteStep();
    textarea.value = PARSEABLE_TEXT;
    textarea.dispatchEvent(new Event('input'));

    processBtn.click();
    CreationPicker.close();
    CreationPicker.open();

    expect(document.querySelector('.parser-textarea')).toBeNull();
    expect(findCardByTitle('Smart Parser')).not.toBeNull();
    expect(findCardByTitle('Manual Entry')).not.toBeNull();
  });

  it('hides Smart Parser in demo mode while Manual Entry remains clickable', () => {
    authStoreMocks.state = { status: 'demo', user: null, accessToken: null };
    CreationPicker.open();

    expect(findCardByTitle('Smart Parser')).toBeUndefined();
    expect(document.querySelector('.parser-process-btn')).toBeNull();

    findCardByTitle('Manual Entry').click();

    expect(parseJobPost).not.toHaveBeenCalled();
    expect(Modal.open).toHaveBeenCalledWith(null, expect.objectContaining({ mode: 'create' }));
  });

  it('updates parser gating when auth state changes while open', () => {
    CreationPicker.open();
    expect(findCardByTitle('Smart Parser')).not.toBeNull();

    setAuthState({ status: 'demo', user: null, accessToken: null });

    expect(findCardByTitle('Smart Parser')).toBeUndefined();
    expect(findCardByTitle('Manual Entry')).not.toBeNull();
  });
});
