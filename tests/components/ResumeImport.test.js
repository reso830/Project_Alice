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
  signOut: vi.fn(),
}));

vi.mock('../../src/services/resumeApi.js', () => ({
  extractText: vi.fn(),
  parseText: vi.fn(),
  parseResume: vi.fn(),
}));

vi.mock('../../src/data/aiSettings.js', () => ({
  getKey: vi.fn(),
  hasKey: vi.fn(),
  hasConsent: vi.fn(),
  setConsent: vi.fn(),
}));

vi.mock('../../src/services/llmParser.js', () => ({
  parseWithLlm: vi.fn(),
}));

import { ResumeImport } from '../../src/components/ResumeImport.js';
import * as aiSettings from '../../src/data/aiSettings.js';
import { parseWithLlm } from '../../src/services/llmParser.js';
import { extractText, parseResume, parseText } from '../../src/services/resumeApi.js';

function setAuthState(state) {
  authStoreMocks.state = state;
  for (const fn of authStoreMocks.subscribers) {
    fn(state);
  }
}

beforeEach(() => {
  authStoreMocks.state = { status: 'local-mode', user: null, accessToken: null };
  authStoreMocks.subscribers.clear();
  aiSettings.hasKey.mockReturnValue(false);
  aiSettings.hasConsent.mockReturnValue(false);
  aiSettings.getKey.mockReturnValue('');
  aiSettings.setConsent.mockReset();
  extractText.mockReset();
  parseResume.mockReset();
  parseText.mockReset();
  parseWithLlm.mockReset();
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.useRealTimers();
  document.body.replaceChildren();
});

function makeResumeFile(name = 'resume.txt') {
  return new window.File(['resume text'], name, { type: 'text/plain' });
}

function selectFile(root, file = makeResumeFile()) {
  const input = root.querySelector('.resume-import__input');
  Object.defineProperty(input, 'files', {
    value: [file],
    configurable: true,
  });
  input.dispatchEvent(new Event('change'));
  return file;
}

function pasteResumeText(root, value = 'Jane Resume') {
  const textarea = root.querySelector('.resume-import__paste-input');

  textarea.value = value;
  textarea.dispatchEvent(new Event('input', { bubbles: true }));

  return textarea;
}

async function flushPromises(count = 2) {
  for (let index = 0; index < count; index += 1) {
    await Promise.resolve();
  }
}

describe('ResumeImport — auth-state gating', () => {
  it('renders visibly in local-mode', () => {
    authStoreMocks.state = { status: 'local-mode', user: null, accessToken: null };
    const root = ResumeImport.create();

    expect(root).not.toBeNull();
    expect(root.classList.contains('resume-import')).toBe(true);
    expect(root.hidden).toBe(false);
  });

  it('renders visibly when authenticated', () => {
    authStoreMocks.state = {
      status: 'authenticated',
      user: { id: 'u1', email: 'jane@example.com' },
      accessToken: 'tok',
    };
    const root = ResumeImport.create();

    expect(root.hidden).toBe(false);
  });

  it('is hidden in the unauthenticated state', () => {
    authStoreMocks.state = { status: 'unauthenticated', user: null, accessToken: null };
    const root = ResumeImport.create();

    expect(root.hidden).toBe(true);
  });

  it('is hidden in the initializing state', () => {
    authStoreMocks.state = { status: 'initializing', user: null, accessToken: null };
    const root = ResumeImport.create();

    expect(root.hidden).toBe(true);
  });

  it('subscribes to authStore: hides when state transitions to unauthenticated', () => {
    authStoreMocks.state = { status: 'authenticated', user: { id: 'u1', email: 'a@b.co' } };
    const root = ResumeImport.create();
    expect(root.hidden).toBe(false);

    setAuthState({ status: 'unauthenticated', user: null, accessToken: null });

    expect(root.hidden).toBe(true);
  });

  it('subscribes to authStore: shows when state transitions back to authenticated', () => {
    authStoreMocks.state = { status: 'unauthenticated', user: null, accessToken: null };
    const root = ResumeImport.create();
    expect(root.hidden).toBe(true);

    setAuthState({ status: 'authenticated', user: { id: 'u1', email: 'a@b.co' } });

    expect(root.hidden).toBe(false);
  });

  it('destroy() unsubscribes from authStore', () => {
    const root = ResumeImport.create();
    expect(authStoreMocks.subscribers.size).toBe(1);

    root.destroy();

    expect(authStoreMocks.subscribers.size).toBe(0);
  });

  it('marks Process Resume busy, prevents duplicate parses, and preserves rotating messages', async () => {
    vi.useFakeTimers();
    let resolveParse;
    parseResume.mockReturnValue(new Promise((resolve) => {
      resolveParse = resolve;
    }));
    const onSuccess = vi.fn();
    const root = ResumeImport.create({ onSuccess });
    const file = selectFile(root);
    const process = root.querySelector('.profile-btn--primary');

    process.click();
    process.click();

    expect(process.getAttribute('aria-busy')).toBe('true');
    expect(process.disabled).toBe(true);
    expect(root.getAttribute('aria-busy')).toBe('true');
    expect(root.querySelector('.resume-import__status')?.textContent).toBe('Reading resume...');
    expect(parseResume).toHaveBeenCalledTimes(1);
    expect(parseResume).toHaveBeenCalledWith(file);

    vi.advanceTimersByTime(1200);

    expect(root.querySelector('.resume-import__status')?.textContent).toBe('Extracting experience...');

    resolveParse({ summary: 'Experienced engineer' });
    await flushPromises();

    expect(onSuccess).toHaveBeenCalledWith(
      { summary: 'Experienced engineer' },
      expect.any(Set),
      expect.objectContaining({ notice: undefined }),
    );
  });

  it('renders inline resume parse failure and retries with the same file', async () => {
    parseResume
      .mockRejectedValueOnce(new Error('parse failed'))
      .mockResolvedValueOnce({ headline: 'Frontend Engineer' });
    const onSuccess = vi.fn();
    const root = ResumeImport.create({ onSuccess });
    const file = selectFile(root);

    root.querySelector('.profile-btn--primary').click();
    await flushPromises();

    const retry = root.querySelector('.inline-error__retry');
    expect(root.querySelector('.inline-error__message')?.textContent)
      .toBe("Couldn't parse the resume. Try again.");
    expect(retry).not.toBeNull();

    retry.click();

    expect(parseResume).toHaveBeenCalledTimes(2);
    expect(parseResume).toHaveBeenLastCalledWith(file);

    await flushPromises();

    expect(onSuccess).toHaveBeenCalledWith(
      { headline: 'Frontend Engineer' },
      expect.any(Set),
      expect.objectContaining({ notice: undefined }),
    );
  });

  it('hides the upload surface in demo mode without surfacing the service-layer demo error', () => {
    authStoreMocks.state = { status: 'demo', user: null, accessToken: null };
    const root = ResumeImport.create();

    expect(root.hidden).toBe(true);
    expect(root.querySelector('.profile-btn--primary')).toBeNull();
    expect(parseResume).not.toHaveBeenCalled();
  });

  it('renders a labeled paste textarea', () => {
    const root = ResumeImport.create();
    const textarea = root.querySelector('.resume-import__paste-input');

    expect(textarea).not.toBeNull();
    expect(textarea.id).toBeTruthy();
    expect(root.querySelector(`label[for="${textarea.id}"]`)?.textContent).toBe('Paste resume text');
  });

  it('routes pasted text through the LLM when key and consent are present', async () => {
    aiSettings.hasKey.mockReturnValue(true);
    aiSettings.hasConsent.mockReturnValue(true);
    aiSettings.getKey.mockReturnValue('openrouter-key');
    parseWithLlm.mockResolvedValue({
      draft: {
        firstName: 'Jane',
        summary: 'Platform engineer',
        skills: [{ name: 'TypeScript', level: 4 }],
      },
      truncated: false,
    });
    const onSuccess = vi.fn();
    const root = ResumeImport.create({ onSuccess });

    pasteResumeText(root, 'Jane Doe\nTypeScript');
    root.querySelector('.profile-btn--primary').click();
    await flushPromises();

    expect(parseWithLlm).toHaveBeenCalledWith('Jane Doe\nTypeScript', 'openrouter-key');
    expect(parseText).not.toHaveBeenCalled();
    expect(parseResume).not.toHaveBeenCalled();
    expect(extractText).not.toHaveBeenCalled();
    expect(onSuccess).toHaveBeenCalledWith(
      expect.objectContaining({
        firstName: 'Jane',
        summary: 'Platform engineer',
      }),
      expect.any(Set),
      expect.objectContaining({ notice: '' }),
    );
    const aiFields = onSuccess.mock.calls[0][1];
    expect(aiFields).toBeInstanceOf(Set);
    expect([...aiFields]).toEqual(expect.arrayContaining(['firstName', 'summary', 'skills[0]']));
  });

  it('extracts uploaded file text before routing through the LLM', async () => {
    aiSettings.hasKey.mockReturnValue(true);
    aiSettings.hasConsent.mockReturnValue(true);
    aiSettings.getKey.mockReturnValue('openrouter-key');
    extractText.mockResolvedValue('extracted resume text');
    parseWithLlm.mockResolvedValue({
      draft: {
        summary: 'Imported from a file',
      },
      truncated: false,
    });
    const onSuccess = vi.fn();
    const root = ResumeImport.create({ onSuccess });
    const file = selectFile(root);

    root.querySelector('.profile-btn--primary').click();
    await flushPromises();

    expect(extractText).toHaveBeenCalledWith(file);
    expect(parseWithLlm).toHaveBeenCalledWith('extracted resume text', 'openrouter-key');
    expect(parseResume).not.toHaveBeenCalled();
    expect(parseText).not.toHaveBeenCalled();
    expect(onSuccess).toHaveBeenCalledWith(
      { summary: 'Imported from a file' },
      expect.any(Set),
      expect.objectContaining({ notice: '' }),
    );
    expect(onSuccess.mock.calls[0][1].has('summary')).toBe(true);
  });

  it('blocks empty paste with no file before calling any parser', async () => {
    const root = ResumeImport.create();

    pasteResumeText(root, '   ');
    root.querySelector('.profile-btn--primary').click();
    await flushPromises();

    expect(root.querySelector('.resume-import__error')?.textContent)
      .toBe('Paste resume text or choose a PDF, DOCX, or TXT resume file.');
    expect(extractText).not.toHaveBeenCalled();
    expect(parseWithLlm).not.toHaveBeenCalled();
    expect(parseText).not.toHaveBeenCalled();
    expect(parseResume).not.toHaveBeenCalled();
  });

  it('clears a stale valid selection when a later file is invalid (Codex P2)', async () => {
    const onSuccess = vi.fn();
    const root = ResumeImport.create({ onSuccess });

    // A valid file is selected first...
    selectFile(root, makeResumeFile('good.txt'));
    // ...then an unsupported file is chosen, which must not leave the old one armed.
    selectFile(root, new window.File(['x'], 'bad.exe', { type: 'application/octet-stream' }));

    expect(root.querySelector('.resume-import__error').hidden).toBe(false);

    // Process with an empty paste box must NOT silently process the stale file.
    root.querySelector('.profile-btn--primary').click();
    await flushPromises();

    expect(root.querySelector('.resume-import__error')?.textContent)
      .toBe('Paste resume text or choose a PDF, DOCX, or TXT resume file.');
    expect(parseResume).not.toHaveBeenCalled();
    expect(parseText).not.toHaveBeenCalled();
    expect(parseWithLlm).not.toHaveBeenCalled();
    expect(onSuccess).not.toHaveBeenCalled();
  });

  it('routes pasted text through rule-based parsing when no key is present', async () => {
    parseText.mockResolvedValue({ summary: 'Rule-based paste' });
    const onSuccess = vi.fn();
    const root = ResumeImport.create({ onSuccess });

    pasteResumeText(root, 'resume text');
    root.querySelector('.profile-btn--primary').click();
    await flushPromises();

    expect(parseText).toHaveBeenCalledWith('resume text');
    expect(parseWithLlm).not.toHaveBeenCalled();
    expect(onSuccess).toHaveBeenCalledWith(
      { summary: 'Rule-based paste' },
      expect.any(Set),
      expect.objectContaining({ notice: undefined }),
    );
    expect(onSuccess.mock.calls[0][1].size).toBe(0);
  });

  it('routes uploaded files through rule-based parsing when no key is present', async () => {
    parseResume.mockResolvedValue({ summary: 'Rule-based file' });
    const onSuccess = vi.fn();
    const root = ResumeImport.create({ onSuccess });
    const file = selectFile(root);

    root.querySelector('.profile-btn--primary').click();
    await flushPromises();

    expect(parseResume).toHaveBeenCalledWith(file);
    expect(extractText).not.toHaveBeenCalled();
    expect(parseWithLlm).not.toHaveBeenCalled();
    expect(onSuccess).toHaveBeenCalledWith(
      { summary: 'Rule-based file' },
      expect.any(Set),
      expect.objectContaining({ notice: undefined }),
    );
    expect(onSuccess.mock.calls[0][1].size).toBe(0);
  });

  it('shows consent before the first external LLM call when a key is present', async () => {
    aiSettings.hasKey.mockReturnValue(true);
    aiSettings.hasConsent.mockReturnValue(false);
    aiSettings.getKey.mockReturnValue('openrouter-key');
    const root = ResumeImport.create();

    pasteResumeText(root, 'Jane Doe resume');
    root.querySelector('.profile-btn--primary').click();
    await flushPromises(6);

    expect(root.querySelector('.resume-import__consent')).not.toBeNull();
    expect(root.querySelector('.resume-import__consent')?.textContent)
      .toContain('OpenRouter');
    expect(root.querySelector('.resume-import__consent')?.textContent)
      .toContain('resume text');
    expect(parseWithLlm).not.toHaveBeenCalled();
    expect(parseText).not.toHaveBeenCalled();
    expect(extractText).not.toHaveBeenCalled();
  });

  it('accepting consent remembers it and proceeds with the LLM parse', async () => {
    aiSettings.hasKey.mockReturnValue(true);
    aiSettings.hasConsent
      .mockReturnValueOnce(false)
      .mockReturnValue(true);
    aiSettings.getKey.mockReturnValue('openrouter-key');
    parseWithLlm.mockResolvedValue({
      draft: { summary: 'AI summary' },
      truncated: false,
    });
    const onSuccess = vi.fn();
    const root = ResumeImport.create({ onSuccess });

    pasteResumeText(root, 'Jane Doe resume');
    root.querySelector('.profile-btn--primary').click();
    await flushPromises(4);

    root.querySelector('.resume-import__consent-accept').click();
    await flushPromises();

    expect(aiSettings.setConsent).toHaveBeenCalledTimes(1);
    expect(parseWithLlm).toHaveBeenCalledWith('Jane Doe resume', 'openrouter-key');
    expect(onSuccess).toHaveBeenCalledWith(
      { summary: 'AI summary' },
      expect.any(Set),
      expect.objectContaining({ notice: '' }),
    );
  });

  it('declining consent uses the rule-based parser without sending to the LLM', async () => {
    aiSettings.hasKey.mockReturnValue(true);
    aiSettings.hasConsent.mockReturnValue(false);
    parseText.mockResolvedValue({ summary: 'Rule-based after decline' });
    const onSuccess = vi.fn();
    const root = ResumeImport.create({ onSuccess });

    pasteResumeText(root, 'Jane Doe resume');
    root.querySelector('.profile-btn--primary').click();
    await flushPromises();

    root.querySelector('.resume-import__consent-decline').click();
    await flushPromises();

    expect(aiSettings.setConsent).not.toHaveBeenCalled();
    expect(parseWithLlm).not.toHaveBeenCalled();
    expect(parseText).toHaveBeenCalledWith('Jane Doe resume');
    expect(onSuccess).toHaveBeenCalledWith(
      { summary: 'Rule-based after decline' },
      expect.any(Set),
      expect.objectContaining({ notice: undefined }),
    );
    expect(onSuccess.mock.calls[0][1].size).toBe(0);
  });

  it('skips the consent prompt after consent is already set', async () => {
    aiSettings.hasKey.mockReturnValue(true);
    aiSettings.hasConsent.mockReturnValue(true);
    aiSettings.getKey.mockReturnValue('openrouter-key');
    parseWithLlm.mockResolvedValue({
      draft: { summary: 'AI summary' },
      truncated: false,
    });
    const root = ResumeImport.create();

    pasteResumeText(root, 'Jane Doe resume');
    root.querySelector('.profile-btn--primary').click();
    await flushPromises();

    expect(root.querySelector('.resume-import__consent')).toBeNull();
    expect(parseWithLlm).toHaveBeenCalledTimes(1);
  });

  it('falls back to rule-based parsing when the LLM fails without leaking provider details', async () => {
    aiSettings.hasKey.mockReturnValue(true);
    aiSettings.hasConsent.mockReturnValue(true);
    aiSettings.getKey.mockReturnValue('openrouter-key');
    parseWithLlm.mockRejectedValue(new Error('OpenRouter 502 provider_timeout stack trace'));
    parseText.mockResolvedValue({ summary: 'Rule-based fallback summary' });
    const onSuccess = vi.fn();
    const root = ResumeImport.create({ onSuccess });

    pasteResumeText(root, 'Jane Doe resume');
    root.querySelector('.profile-btn--primary').click();
    await flushPromises(4);

    expect(parseWithLlm).toHaveBeenCalledWith('Jane Doe resume', 'openrouter-key');
    expect(parseText).toHaveBeenCalledWith('Jane Doe resume');
    expect(onSuccess).toHaveBeenCalledWith(
      { summary: 'Rule-based fallback summary' },
      expect.any(Set),
      expect.objectContaining({
        notice: 'AI parsing was unavailable, so Alice used the rule-based importer.',
      }),
    );
    expect(onSuccess.mock.calls[0][1].size).toBe(0);
    expect(root.textContent).toContain('AI parsing was unavailable, so Alice used the rule-based importer.');
    expect(root.textContent).not.toContain('OpenRouter 502');
    expect(root.textContent).not.toContain('provider_timeout');
  });

  it('falls back from an uploaded-file LLM failure using the extracted text', async () => {
    aiSettings.hasKey.mockReturnValue(true);
    aiSettings.hasConsent.mockReturnValue(true);
    aiSettings.getKey.mockReturnValue('openrouter-key');
    extractText.mockResolvedValue('extracted resume text');
    parseWithLlm.mockRejectedValue(new Error('provider raw failure'));
    parseText.mockResolvedValue({ summary: 'File fallback summary' });
    const onSuccess = vi.fn();
    const root = ResumeImport.create({ onSuccess });
    const file = selectFile(root);

    root.querySelector('.profile-btn--primary').click();
    await flushPromises(4);

    expect(extractText).toHaveBeenCalledWith(file);
    expect(parseWithLlm).toHaveBeenCalledWith('extracted resume text', 'openrouter-key');
    expect(parseText).toHaveBeenCalledWith('extracted resume text');
    expect(parseResume).not.toHaveBeenCalled();
    expect(onSuccess).toHaveBeenCalledWith(
      { summary: 'File fallback summary' },
      expect.any(Set),
      expect.objectContaining({
        notice: 'AI parsing was unavailable, so Alice used the rule-based importer.',
      }),
    );
    expect(onSuccess.mock.calls[0][1].size).toBe(0);
  });

  it('shows retry and Continue Manually when both AI and rule-based parsing fail without losing input', async () => {
    aiSettings.hasKey.mockReturnValue(true);
    aiSettings.hasConsent.mockReturnValue(true);
    aiSettings.getKey.mockReturnValue('openrouter-key');
    parseWithLlm.mockRejectedValue(new Error('provider raw failure'));
    parseText
      .mockRejectedValueOnce(new Error('rule raw failure'))
      .mockResolvedValueOnce({ summary: 'Retry fallback summary' });
    const onDismiss = vi.fn();
    const onSuccess = vi.fn();
    const root = ResumeImport.create({ onDismiss, onSuccess });

    pasteResumeText(root, 'Jane Doe retry resume');
    root.querySelector('.profile-btn--primary').click();
    await flushPromises(4);

    expect(root.querySelector('.inline-error__message')?.textContent)
      .toBe("Couldn't parse the resume. Try again.");
    expect(root.textContent).not.toContain('provider raw failure');
    expect(root.textContent).not.toContain('rule raw failure');
    expect(root.textContent).toContain('Continue Manually');

    root.querySelector('.inline-error__retry').click();
    await flushPromises(4);

    expect(parseText).toHaveBeenLastCalledWith('Jane Doe retry resume');
    expect(onSuccess).toHaveBeenCalledWith(
      { summary: 'Retry fallback summary' },
      expect.any(Set),
      expect.objectContaining({
        notice: 'AI parsing was unavailable, so Alice used the rule-based importer.',
      }),
    );

    root.querySelector('.inline-error__retry')?.click();
    expect(onDismiss).not.toHaveBeenCalled();
  });

  it('shows a truncation notice when the LLM reports truncated input', async () => {
    aiSettings.hasKey.mockReturnValue(true);
    aiSettings.hasConsent.mockReturnValue(true);
    aiSettings.getKey.mockReturnValue('openrouter-key');
    parseWithLlm.mockResolvedValue({
      draft: { summary: 'AI summary from long resume' },
      truncated: true,
    });
    const onSuccess = vi.fn();
    const root = ResumeImport.create({ onSuccess });

    pasteResumeText(root, 'Very long resume text');
    root.querySelector('.profile-btn--primary').click();
    await flushPromises();

    const notice = root.querySelector('.resume-import__notice');

    expect(notice).not.toBeNull();
    expect(notice.hidden).toBe(false);
    expect(notice.textContent).toContain('resume was long');
    expect(onSuccess).toHaveBeenCalledWith(
      { summary: 'AI summary from long resume' },
      expect.any(Set),
      expect.objectContaining({
        notice: 'The resume was long, so some content may not be parsed.',
      }),
    );
  });
});
