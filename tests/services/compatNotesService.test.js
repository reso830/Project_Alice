import { afterEach, describe, expect, it, vi } from 'vitest';

const llmClientMock = vi.hoisted(() => ({
  requestChatCompletion: vi.fn(),
  mapErrorToReason: vi.fn((error) => error?.reason ?? 'rate_limit'),
}));

vi.mock('../../src/services/llmClient.js', () => llmClientMock);

afterEach(() => {
  llmClientMock.requestChatCompletion.mockReset();
  llmClientMock.mapErrorToReason.mockClear();
});

function application(overrides = {}) {
  return {
    compat: 86,
    jobTitle: 'Frontend Engineer',
    responsibilities: 'Build React UI and maintain design systems.',
    skills: ['React', 'TypeScript'],
    preferredSkills: ['GraphQL'],
    minYearsExperience: 3,
    ...overrides,
  };
}

function profile(overrides = {}) {
  return {
    summary: 'Frontend engineer focused on React products.',
    skills: [
      { name: 'React', level: 5 },
      { name: 'TypeScript', level: 2 },
    ],
    experience: [
      { role: 'Frontend Engineer' },
      { role: 'UI Engineer' },
    ],
    ...overrides,
  };
}

function aiSettings() {
  return {
    getKey: () => 'sk-or-test',
    getModel: () => 'openai/gpt-4o-mini',
  };
}

describe('compatNotesService', () => {
  it('builds coaching-oriented prompt context with score and resolved skill matches', async () => {
    llmClientMock.requestChatCompletion.mockResolvedValue({
      parsed: {
        summary: 'Strong React fit',
        body: 'Your React work maps well to the core of the role, while TypeScript depth and GraphQL are the places to sharpen the story.',
      },
    });
    const { generateNotes } = await import('../../src/services/compatNotesService.js');

    const result = await generateNotes(application(), profile(), aiSettings());

    expect(result).toEqual({
      summary: 'Strong React fit',
      body: 'Your React work maps well to the core of the role, while TypeScript depth and GraphQL are the places to sharpen the story.',
    });
    expect(llmClientMock.requestChatCompletion).toHaveBeenCalledWith(expect.objectContaining({
      key: 'sk-or-test',
      model: 'openai/gpt-4o-mini',
      systemPrompt: expect.stringContaining('Return ONLY JSON'),
      userContent: expect.stringContaining('Score: 86'),
    }));
    const call = llmClientMock.requestChatCompletion.mock.calls[0][0];
    expect(call.systemPrompt).toContain('professional career coach');
    expect(call.systemPrompt).toContain('do not repeat the score, percentage, or tier label');
    expect(call.systemPrompt).toContain('complete phrase under 28 characters');
    expect(call.systemPrompt).toContain('avoid generic "Low match" or "High match" restatements');
    expect(call.systemPrompt).toContain('4-6 natural sentences');
    expect(call.systemPrompt).toContain('Do not read out every required or preferred skill');
    expect(call.userContent).not.toContain('Tier:');
    expect(call.userContent).toContain('React: proficient');
    expect(call.userContent).toContain('TypeScript: learning');
    expect(call.userContent).toContain('GraphQL: missing');
    expect(call.userContent).toContain('Frontend Engineer');
    expect(call.userContent).toContain('Frontend engineer focused on React products.');
  });

  it('replaces over-limit summaries with a complete fallback headline', async () => {
    llmClientMock.requestChatCompletion.mockResolvedValue({
      parsed: {
        summary: 'This summary is definitely longer than thirty four characters',
        body: 'Concise body.',
      },
    });
    const { generateNotes } = await import('../../src/services/compatNotesService.js');

    const result = await generateNotes(application(), profile(), aiSettings());

    expect(result.summary).toBe('Strong fit with nuance');
    expect(result.summary.length).toBeLessThanOrEqual(34);
  });

  it('handles empty application and profile fields gracefully', async () => {
    llmClientMock.requestChatCompletion.mockResolvedValue({
      parsed: {
        summary: 'Limited context',
        body: 'Only the score was available.',
      },
    });
    const { generateNotes } = await import('../../src/services/compatNotesService.js');

    await expect(generateNotes(null, null, aiSettings())).resolves.toEqual({
      summary: 'Limited context',
      body: 'Only the score was available.',
    });

    const call = llmClientMock.requestChatCompletion.mock.calls[0][0];
    expect(call.userContent).toContain('Score: 0');
    expect(call.userContent).not.toContain('Tier:');
    expect(call.userContent).toContain('Required skills: None');
    expect(call.userContent).toContain('Profile skills: None');
  });

  it('re-exports LLM error mapping from the shared client', async () => {
    llmClientMock.mapErrorToReason.mockReturnValue('timeout');
    const { mapErrorToReason } = await import('../../src/services/compatNotesService.js');

    expect(mapErrorToReason({ code: 'LLM_TIMEOUT' })).toBe('timeout');
    expect(llmClientMock.mapErrorToReason).toHaveBeenCalledWith({ code: 'LLM_TIMEOUT' });
  });
});
