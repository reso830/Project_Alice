import { afterEach, describe, expect, it, vi } from 'vitest';

afterEach(() => {
  vi.restoreAllMocks();
  vi.doUnmock('../../src/services/providers/openrouter.js');
  vi.resetModules();
});

describe('aiProvider — contract validation', () => {
  it('throws at initialization when a provider is missing validateKey', async () => {
    vi.doMock('../../src/services/providers/openrouter.js', () => ({
      openrouterProvider: {
        defaultModel: 'meta-llama/llama-3.3-70b-instruct:free',
        complete: async () => {},
      },
    }));
    vi.resetModules();

    await expect(import('../../src/services/aiProvider.js')).rejects.toThrow(
      /validateKey/,
    );
  });

  it('throws at initialization when a provider is missing complete', async () => {
    vi.doMock('../../src/services/providers/openrouter.js', () => ({
      openrouterProvider: {
        defaultModel: 'meta-llama/llama-3.3-70b-instruct:free',
        validateKey: async () => {},
      },
    }));
    vi.resetModules();

    await expect(import('../../src/services/aiProvider.js')).rejects.toThrow(
      /complete/,
    );
  });

  it('throws at initialization when a provider has a blank defaultModel', async () => {
    vi.doMock('../../src/services/providers/openrouter.js', () => ({
      openrouterProvider: {
        defaultModel: '   ',
        complete: async () => {},
        validateKey: async () => {},
      },
    }));
    vi.resetModules();

    await expect(import('../../src/services/aiProvider.js')).rejects.toThrow(
      /defaultModel/,
    );
  });

  it('loads successfully when the registered provider implements the full contract', async () => {
    vi.resetModules();
    const { getActiveProvider } = await import('../../src/services/aiProvider.js');
    expect(getActiveProvider).toBeInstanceOf(Function);
    expect(getActiveProvider()).toBeDefined();
  });
});
