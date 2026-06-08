// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../src/data/aiSettings.js', () => ({
  canUseJdParser: vi.fn(),
  getKey: vi.fn(),
  getFeature: vi.fn(),
  getModel: vi.fn(),
  hasKey: vi.fn(),
  isEnabled: vi.fn(),
}));

vi.mock('../../src/services/llmParser.js', () => ({
  REASON_CODES: {
    rate_limit: {
      code: 'HTTP 429',
      message: 'Rate limit reached - too many requests in a short time.',
      fix: 'wait',
    },
    invalid_key: {
      code: 'HTTP 401',
      message: 'Provider key rejected.',
      fix: 'settings',
    },
    NO_TEXT: {
      code: 'NO_TEXT',
      message: 'No readable posting details found.',
      fix: 'dead-end',
    },
  },
  mapErrorToReason: vi.fn((error) => error?.reason ?? 'rate_limit'),
  parseJobWithLlm: vi.fn(),
}));

vi.mock('../../src/utils/jobPostParser.js', () => ({
  parseJobPost: vi.fn(),
}));

import { JobPostingImport } from '../../src/components/JobPostingImport.js';
import * as aiSettings from '../../src/data/aiSettings.js';
import { parseJobWithLlm } from '../../src/services/llmParser.js';
import { parseJobPost } from '../../src/utils/jobPostParser.js';

const LONG_POSTING = [
  'Company: Acme Labs',
  'Role: Frontend Engineer',
  'Responsibilities: Build polished tracker UI and collaborate with product.',
  'Required skills: JavaScript, CSS, Accessibility',
].join('\n');

beforeEach(() => {
  aiSettings.isEnabled.mockReturnValue(true);
  aiSettings.getFeature.mockImplementation((key) => key === 'jd');
  aiSettings.hasKey.mockReturnValue(true);
  aiSettings.canUseJdParser.mockImplementation(() => (
    aiSettings.isEnabled() && aiSettings.getFeature('jd') && aiSettings.hasKey()
  ));
  aiSettings.getKey.mockReturnValue('openrouter-key');
  aiSettings.getModel.mockReturnValue('openrouter/model-slug');
  parseJobWithLlm.mockReset();
  parseJobPost.mockReset();
});

afterEach(() => {
  vi.restoreAllMocks();
  document.body.replaceChildren();
});

function createImport(options = {}) {
  const root = JobPostingImport.create(options);
  document.body.append(root);
  return root;
}

function pastePosting(root, value = LONG_POSTING) {
  const textarea = root.querySelector('.job-posting-import__textarea');

  textarea.value = value;
  textarea.dispatchEvent(new Event('input', { bubbles: true }));

  return textarea;
}

async function flushPromises(count = 3) {
  for (let index = 0; index < count; index += 1) {
    await Promise.resolve();
  }
}

describe('JobPostingImport', () => {
  it('renders paste-only input with a live character count and minimum length gate', () => {
    const root = createImport();
    const textarea = root.querySelector('.job-posting-import__textarea');
    const parseButton = root.querySelector('.job-posting-import__parse');

    expect(textarea).not.toBeNull();
    expect(root.querySelector('input[type="file"]')).toBeNull();
    expect(root.querySelector('.job-posting-import__title')?.textContent).toBe('Paste the job posting');
    expect(root.querySelector('.job-posting-import__subtitle')?.textContent).toContain('Copy the full text');
    expect(root.querySelector('.job-posting-import__helper')?.textContent).toContain("Auto parsing isn't perfect");
    expect(root.querySelector(`label[for="${textarea.id}"]`)?.textContent).toBe('Paste job posting');
    expect(root.querySelector('.job-posting-import__count')?.textContent).toBe('0 chars');
    expect(parseButton.disabled).toBe(true);

    pastePosting(root, 'Too short for parsing');

    expect(root.querySelector('.job-posting-import__count')?.textContent).toBe('21 chars');
    expect(parseButton.disabled).toBe(true);

    pastePosting(root, LONG_POSTING);

    expect(root.querySelector('.job-posting-import__count')?.textContent).toContain(String(LONG_POSTING.length));
    expect(parseButton.disabled).toBe(false);
  });

  it('renders a locked Settings affordance without parsing when AI JD parsing is off', async () => {
    aiSettings.getFeature.mockReturnValue(false);
    const navigate = vi.fn();
    const root = createImport({ navigate });

    pastePosting(root);
    root.querySelector('.job-posting-import__parse').click();
    await flushPromises();

    expect(parseJobWithLlm).not.toHaveBeenCalled();
    expect(parseJobPost).not.toHaveBeenCalled();
    expect(root.textContent).toContain('AI job-description parsing is off');

    root.querySelector('.job-posting-import__settings-link').click();

    expect(navigate).toHaveBeenCalledWith('profile', { focusSettings: true });
  });

  it('shows a processing scrim while the LLM is reading the posting', async () => {
    parseJobWithLlm.mockReturnValue(new Promise(() => {}));
    const root = createImport();

    pastePosting(root);
    root.querySelector('.job-posting-import__parse').click();
    await flushPromises();

    const processing = root.querySelector('.job-posting-import-processing');

    expect(processing).not.toBeNull();
    expect(processing.getAttribute('role')).toBe('status');
    expect(processing.textContent).toContain('Reading the job posting');
    expect(root.getAttribute('aria-busy')).toBe('true');
  });

  it('hands off successful AI drafts with bare field-level provenance keys and truncation notice', async () => {
    parseJobWithLlm.mockResolvedValue({
      draft: {
        companyName: 'Acme Labs',
        jobTitle: 'Frontend Engineer',
        skills: ['JavaScript', 'CSS'],
        preferredSkills: ['Vitest'],
        workSetup: 'Remote',
        status: 'wishlisted',
        compat: 73,
        lastStatusUpdate: '2026-06-08',
      },
      truncated: true,
    });
    const onSuccess = vi.fn();
    const root = createImport({ onSuccess });

    pastePosting(root);
    root.querySelector('.job-posting-import__parse').click();
    await flushPromises();

    expect(parseJobWithLlm).toHaveBeenCalledWith(LONG_POSTING, 'openrouter-key', 'openrouter/model-slug');
    expect(onSuccess).toHaveBeenCalledWith({
      draft: expect.objectContaining({
        companyName: 'Acme Labs',
        jobTitle: 'Frontend Engineer',
      }),
      aiFieldSet: new Set(['companyName', 'jobTitle', 'skills', 'preferredSkills', 'workSetup']),
      fillSource: 'ai',
      notice: 'The posting was long, so some content may not be parsed.',
    });
  });

  it('routes recoverable LLM failures to basic fallback with Auto provenance', async () => {
    parseJobWithLlm.mockRejectedValue({ reason: 'rate_limit' });
    parseJobPost.mockReturnValue({
      companyName: 'Acme Labs',
      jobTitle: 'Frontend Engineer',
      skills: ['JavaScript'],
      preferredSkills: [],
      compat: 42,
    });
    const onSuccess = vi.fn();
    const root = createImport({ onSuccess });

    pastePosting(root);
    root.querySelector('.job-posting-import__parse').click();
    await flushPromises();

    expect(root.textContent).toContain('Smart parsing is unavailable right now');
    expect(root.querySelector('.job-posting-import__title')?.textContent).toBe('Paste the job posting');
    expect(root.querySelector('.job-posting-import__subtitle')?.textContent).toContain('Copy the full text');
    expect(root.querySelector('.job-posting-import-failure__file')?.textContent)
      .toBe(`Pasted job posting • ${LONG_POSTING.length} characters`);
    expect(root.textContent).toContain('HTTP 429');
    expect(root.textContent).toContain('Use basic parser');
    expect(root.textContent).toContain('Try AI again');

    [...root.querySelectorAll('button')]
      .find((button) => button.textContent === 'Use basic parser')
      .click();
    await flushPromises();

    expect(parseJobPost).toHaveBeenCalledWith(LONG_POSTING);
    expect(onSuccess).toHaveBeenCalledWith({
      draft: expect.objectContaining({
        companyName: 'Acme Labs',
        jobTitle: 'Frontend Engineer',
      }),
      aiFieldSet: new Set(['companyName', 'jobTitle', 'skills']),
      fillSource: 'basic',
      notice: '',
    });
  });

  it('routes key and credit failures to Settings instead of retry', async () => {
    parseJobWithLlm.mockRejectedValue({ reason: 'invalid_key' });
    const navigate = vi.fn();
    const onDismiss = vi.fn();
    const root = createImport({ navigate, onDismiss });

    pastePosting(root);
    root.querySelector('.job-posting-import__parse').click();
    await flushPromises();

    expect(root.textContent).toContain('HTTP 401');
    expect(root.textContent).toContain('Update key in Settings');
    expect(root.textContent).not.toContain('Try AI again');

    [...root.querySelectorAll('button')]
      .find((button) => button.textContent === 'Update key in Settings →')
      .click();

    expect(onDismiss).toHaveBeenCalledTimes(1);
    expect(navigate).toHaveBeenCalledWith('profile', { focusSettings: true });
  });

  it('routes failure manual recovery to the manual application flow', async () => {
    parseJobWithLlm.mockRejectedValue({ reason: 'rate_limit' });
    const onManual = vi.fn();
    const root = createImport({ onManual });

    pastePosting(root);
    root.querySelector('.job-posting-import__parse').click();
    await flushPromises();

    [...root.querySelectorAll('button')]
      .find((button) => button.textContent === 'Enter manually instead')
      .click();

    expect(onManual).toHaveBeenCalledTimes(1);
  });

  it('shows the NO_TEXT dead-end without a basic-parser option for empty AI results', async () => {
    parseJobWithLlm.mockRejectedValue({ reason: 'NO_TEXT' });
    const onSuccess = vi.fn();
    const root = createImport({ onSuccess });

    pastePosting(root);
    root.querySelector('.job-posting-import__parse').click();
    await flushPromises();

    expect(root.textContent).toContain("We couldn't read that posting");
    expect(root.textContent).toContain('NO_TEXT');
    expect(root.textContent).toContain('Try again');
    expect(root.textContent).toContain('Enter manually instead');
    expect(root.textContent).not.toContain('Use basic parser');
    expect(parseJobPost).not.toHaveBeenCalled();
    expect(onSuccess).not.toHaveBeenCalled();
  });

  it('preserves pasted text across retry after a recoverable failure', async () => {
    parseJobWithLlm
      .mockRejectedValueOnce({ reason: 'rate_limit' })
      .mockResolvedValueOnce({
        draft: { companyName: 'Acme Labs', jobTitle: 'Frontend Engineer' },
        truncated: false,
      });
    const onSuccess = vi.fn();
    const root = createImport({ onSuccess });

    pastePosting(root);
    root.querySelector('.job-posting-import__parse').click();
    await flushPromises();

    [...root.querySelectorAll('button')]
      .find((button) => button.textContent === 'Try AI again')
      .click();
    await flushPromises();

    expect(parseJobWithLlm).toHaveBeenCalledTimes(2);
    expect(parseJobWithLlm).toHaveBeenNthCalledWith(1, LONG_POSTING, 'openrouter-key', 'openrouter/model-slug');
    expect(parseJobWithLlm).toHaveBeenNthCalledWith(2, LONG_POSTING, 'openrouter-key', 'openrouter/model-slug');
    expect(onSuccess).toHaveBeenCalledWith({
      draft: expect.objectContaining({ companyName: 'Acme Labs' }),
      aiFieldSet: new Set(['companyName', 'jobTitle']),
      fillSource: 'ai',
      notice: '',
    });
  });

  it('shows the dead-end when the chosen basic parser also returns no usable fields', async () => {
    parseJobWithLlm.mockRejectedValue({ reason: 'rate_limit' });
    parseJobPost.mockReturnValue({
      companyName: '',
      jobTitle: '',
      responsibilities: '',
      skills: [],
      preferredSkills: [],
      compat: 10,
    });
    const onSuccess = vi.fn();
    const root = createImport({ onSuccess });

    pastePosting(root);
    root.querySelector('.job-posting-import__parse').click();
    await flushPromises();

    [...root.querySelectorAll('button')]
      .find((button) => button.textContent === 'Use basic parser')
      .click();
    await flushPromises();

    expect(root.textContent).toContain("We couldn't read that posting");
    expect(root.textContent).not.toContain('Use basic parser');
    expect(onSuccess).not.toHaveBeenCalled();
  });
});
