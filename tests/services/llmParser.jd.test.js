import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { validateApplication } from '../../src/models/application.js';

let llmParser;

function makeResponse({ ok = true, status = 200, content }) {
  return {
    ok,
    status,
    json: () => Promise.resolve({
      choices: [
        {
          message: {
            content,
          },
        },
      ],
    }),
  };
}

beforeEach(async () => {
  vi.resetModules();
  llmParser = await import('../../src/services/llmParser.js');
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('parseJobWithLlm', () => {
  it('sends one OpenRouter request and normalizes assistant JSON into an application draft', async () => {
    const fetchMock = vi.fn().mockResolvedValue(makeResponse({
      content: `\`\`\`json
{
  "companyName": "  Acme Labs  ",
  "jobTitle": "Frontend Engineer",
  "responsibilities": "Build UI systems",
  "location": "Manila",
  "salary": "900,000",
  "workSetup": "Remote",
  "shift": "Night",
  "skills": ["React", "React", "CSS"],
  "preferredSkills": ["Design Systems", "React"],
  "recruiter": "Sam Rivera",
  "jobPostingUrl": "https://jobs.example.com/acme",
  "status": "applied",
  "compat": 99,
  "yearsOfExperience": "5+"
}
\`\`\``,
    }));
    vi.stubGlobal('fetch', fetchMock);

    const result = await llmParser.parseJobWithLlm('Job posting text', 'sk-or-test', 'custom/model');

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0][0]).toBe('https://openrouter.ai/api/v1/chat/completions');
    expect(fetchMock.mock.calls[0][1]).toMatchObject({
      method: 'POST',
      headers: {
        Authorization: 'Bearer sk-or-test',
        'Content-Type': 'application/json',
      },
    });
    const body = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(body.model).toBe('custom/model');
    expect(body.response_format).toEqual({ type: 'json_object' });
    expect(body.messages).toHaveLength(2);
    expect(body.messages[0].content).toContain('job posting');
    expect(body.messages[0].content).toContain('Years of experience is not an output field');
    expect(body.messages[1]).toEqual({ role: 'user', content: 'Job posting text' });
    expect(result).toEqual({
      draft: expect.objectContaining({
        companyName: 'Acme Labs',
        jobTitle: 'Frontend Engineer',
        responsibilities: 'Build UI systems',
        location: 'Manila',
        salary: 900000,
        workSetup: 'Remote',
        shift: 'Night',
        skills: ['React', 'CSS'],
        preferredSkills: ['Design Systems', 'React'],
        recruiter: 'Sam Rivera',
        jobPostingUrl: 'https://jobs.example.com/acme',
        status: 'wishlisted',
      }),
      truncated: false,
    });
    expect(result.draft).not.toHaveProperty('yearsOfExperience');
    expect(result.draft).not.toHaveProperty('compat');
    expect(result.draft).not.toHaveProperty('_corrupt');
  });

  it('keeps a thin parse with at least one usable field and clears invalid values', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(makeResponse({
      content: JSON.stringify({
        companyName: '',
        jobTitle: '',
        responsibilities: '',
        salary: -1,
        workSetup: 'Anywhere',
        shift: 'Graveyard',
        jobPostingUrl: 'not-a-url',
        skills: ['TypeScript'],
      }),
    })));

    const result = await llmParser.parseJobWithLlm('Thin posting', 'key');

    expect(result.draft).toMatchObject({
      companyName: '',
      jobTitle: '',
      responsibilities: '',
      salary: null,
      workSetup: '',
      shift: '',
      jobPostingUrl: '',
      skills: ['TypeScript'],
      status: 'wishlisted',
    });
    expect(result.draft).not.toHaveProperty('compat');
    expect(result.draft).not.toHaveProperty('_corrupt');
  });

  it('produces a complete parsed draft that passes the same application validation used for manual saves', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-06-08T12:00:00Z'));
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(makeResponse({
      content: JSON.stringify({
        companyName: 'Acme Labs',
        jobTitle: 'Frontend Engineer',
        responsibilities: 'Build accessible tracker workflows.',
        workSetup: 'Hybrid',
        shift: 'Flexible',
        jobPostingUrl: 'https://jobs.example.com/acme/frontend',
        skills: ['JavaScript', 'Accessibility'],
        preferredSkills: ['Vitest'],
        status: 'offer',
        lastStatusUpdate: 'not-from-provider',
      }),
    })));

    const { draft } = await llmParser.parseJobWithLlm('Full job posting', 'key');
    const validated = validateApplication({ id: 1, ...draft });

    expect(validated).toMatchObject({
      companyName: 'Acme Labs',
      jobTitle: 'Frontend Engineer',
      responsibilities: 'Build accessible tracker workflows.',
      status: 'wishlisted',
      lastStatusUpdate: '2026-06-08',
      workSetup: 'Hybrid',
      shift: 'Flexible',
      jobPostingUrl: 'https://jobs.example.com/acme/frontend',
    });
    expect(validated._corrupt).toBeUndefined();
    expect(draft).not.toHaveProperty('compat');
  });

  it('truncates over-length job input and reports truncation', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(makeResponse({
      content: JSON.stringify({ companyName: 'Acme' }),
    })));

    const result = await llmParser.parseJobWithLlm('x'.repeat(llmParser.MAX_INPUT_CHARS + 10), 'key');

    const body = JSON.parse(globalThis.fetch.mock.calls[0][1].body);
    expect(body.messages[1].content).toHaveLength(llmParser.MAX_INPUT_CHARS);
    expect(result.truncated).toBe(true);
  });

  it('throws LLM_INVALID_RESPONSE for unparseable or non-object assistant output', async () => {
    vi.stubGlobal('fetch', vi.fn()
      .mockResolvedValueOnce(makeResponse({ content: 'not json' }))
      .mockResolvedValueOnce(makeResponse({ content: JSON.stringify(['not', 'an', 'object']) })));

    await expect(llmParser.parseJobWithLlm('Job text', 'key')).rejects.toMatchObject({
      code: 'LLM_INVALID_RESPONSE',
    });
    await expect(llmParser.parseJobWithLlm('Job text', 'key')).rejects.toMatchObject({
      code: 'LLM_INVALID_RESPONSE',
    });
  });

  it('throws LLM_EMPTY_RESPONSE for a valid object with zero usable fields', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(makeResponse({
      content: JSON.stringify({
        companyName: ' ',
        jobTitle: '',
        responsibilities: '',
        location: '',
        salary: null,
        workSetup: '',
        shift: '',
        skills: [],
        preferredSkills: [],
        recruiter: '',
        jobPostingUrl: '',
      }),
    })));

    await expect(llmParser.parseJobWithLlm('Job text', 'key')).rejects.toMatchObject({
      code: 'LLM_EMPTY_RESPONSE',
    });
  });

  it.each([
    [401, 'invalid_key'],
    [402, 'quota'],
    [429, 'rate_limit'],
    [503, 'server'],
  ])('preserves provider status %s for reason mapping', async (status, reason) => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(makeResponse({
      ok: false,
      status,
      content: '{}',
    })));

    try {
      await llmParser.parseJobWithLlm('Job text', 'key');
      throw new Error('Expected parseJobWithLlm to reject');
    } catch (error) {
      expect(error).toMatchObject({
        code: 'LLM_PROVIDER_ERROR',
        status,
      });
      expect(llmParser.mapErrorToReason(error)).toBe(reason);
    }
  });

  it('maps timeout and network failures through shared typed errors', async () => {
    vi.useFakeTimers();
    const fetchMock = vi.fn((_url, options) => new Promise((_resolve, reject) => {
      options.signal.addEventListener('abort', () => {
        const error = new Error('Aborted');
        error.name = 'AbortError';
        reject(error);
      });
    }));
    vi.stubGlobal('fetch', fetchMock);

    const promise = llmParser.parseJobWithLlm('Job text', 'key');
    const expectation = expect(promise).rejects.toMatchObject({
      code: 'LLM_TIMEOUT',
    });
    await vi.advanceTimersByTimeAsync(llmParser.LLM_TIMEOUT_MS);
    await expectation;

    vi.useRealTimers();
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('Network failed')));

    await expect(llmParser.parseJobWithLlm('Job text', 'key')).rejects.toMatchObject({
      code: 'LLM_NETWORK_ERROR',
    });
  });
});
