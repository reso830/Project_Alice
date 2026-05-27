import process from 'node:process';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const createClient = vi.fn();

vi.mock('@supabase/supabase-js', () => ({
  createClient: (...args) => createClient(...args),
}));

// Import after the mock is registered so the SUT picks up the mocked
// `createClient`.
const { assertHostedSchema } = await import('../../server/health.js');

function hostedConfig(overrides = {}) {
  return {
    isHosted: true,
    supabase: {
      url: 'https://example.supabase.co',
      anonKey: 'anon-key',
    },
    ...overrides,
  };
}

function setupClient(probeResponses) {
  // Each from(table).select(col).limit(0) chain resolves to the next
  // entry in probeResponses (one per table probed).
  let index = 0;
  const fromCalls = [];

  createClient.mockReturnValue({
    from: vi.fn((table) => {
      fromCalls.push(table);
      const chain = {
        select: vi.fn(() => chain),
        limit: vi.fn(() => Promise.resolve(probeResponses[index++])),
      };
      return chain;
    }),
  });

  return { fromCalls };
}

function makeLogger() {
  return {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  };
}

describe('assertHostedSchema', () => {
  beforeEach(() => {
    createClient.mockReset();
  });

  describe('skip conditions', () => {
    it('does nothing when config is undefined', async () => {
      await expect(assertHostedSchema(undefined)).resolves.toBeUndefined();
      expect(createClient).not.toHaveBeenCalled();
    });

    it('does nothing when config.isHosted is false', async () => {
      await expect(
        assertHostedSchema({ isHosted: false }),
      ).resolves.toBeUndefined();
      expect(createClient).not.toHaveBeenCalled();
    });

    it('does nothing when SKIP_HOSTED_SCHEMA_CHECK=true (test-only escape hatch)', async () => {
      const original = process.env.SKIP_HOSTED_SCHEMA_CHECK;
      process.env.SKIP_HOSTED_SCHEMA_CHECK = 'true';
      try {
        const logger = makeLogger();
        await expect(
          assertHostedSchema(
            {
              isHosted: true,
              supabase: { url: 'https://x.supabase.co', anonKey: 'k' },
            },
            { logger },
          ),
        ).resolves.toBeUndefined();
        expect(createClient).not.toHaveBeenCalled();
        expect(logger.warn).toHaveBeenCalledWith(
          expect.stringMatching(/SKIP_HOSTED_SCHEMA_CHECK/),
        );
      } finally {
        if (original === undefined) {
          delete process.env.SKIP_HOSTED_SCHEMA_CHECK;
        } else {
          process.env.SKIP_HOSTED_SCHEMA_CHECK = original;
        }
      }
    });

    it('still runs the probe for any non-"true" SKIP value', async () => {
      // Guard against operators thinking "skip=1" or "skip=yes" works.
      // Only the exact string "true" disables the check.
      const original = process.env.SKIP_HOSTED_SCHEMA_CHECK;
      process.env.SKIP_HOSTED_SCHEMA_CHECK = '1';
      try {
        setupClient([{ error: null }, { error: null }, { error: null }, { error: null }, { error: null }]);
        await assertHostedSchema({
          isHosted: true,
          supabase: { url: 'https://x.supabase.co', anonKey: 'k' },
        });
        expect(createClient).toHaveBeenCalled();
      } finally {
        if (original === undefined) {
          delete process.env.SKIP_HOSTED_SCHEMA_CHECK;
        } else {
          process.env.SKIP_HOSTED_SCHEMA_CHECK = original;
        }
      }
    });
  });

  describe('config validation', () => {
    it('throws when supabase.url is missing in hosted mode', async () => {
      await expect(
        assertHostedSchema({
          isHosted: true,
          supabase: { anonKey: 'anon-key' },
        }),
      ).rejects.toThrow(/supabase\.url and config\.supabase\.anonKey/);
    });

    it('throws when supabase.anonKey is missing in hosted mode', async () => {
      await expect(
        assertHostedSchema({
          isHosted: true,
          supabase: { url: 'https://x.supabase.co' },
        }),
      ).rejects.toThrow(/supabase\.url and config\.supabase\.anonKey/);
    });
  });

  describe('successful boot', () => {
    it('resolves silently and logs info when all probes return 200', async () => {
      const logger = makeLogger();
      const { fromCalls } = setupClient([
        { error: null },
        { error: null },
        { error: null },
        { error: null },
        { error: null },
      ]);

      await expect(
        assertHostedSchema(hostedConfig(), { logger }),
      ).resolves.toBeUndefined();

      expect(fromCalls).toEqual(['applications', 'profile', 'user_seed_state', 'applications', 'applications']);
      expect(logger.warn).not.toHaveBeenCalled();
      expect(logger.info).toHaveBeenCalledWith(
        expect.stringMatching(/all probes passed/),
      );
    });

    it('constructs the anon-key client without auth session persistence', async () => {
      setupClient([{ error: null }, { error: null }, { error: null }, { error: null }, { error: null }]);
      await assertHostedSchema(hostedConfig());

      expect(createClient).toHaveBeenCalledWith(
        'https://example.supabase.co',
        'anon-key',
        expect.objectContaining({
          auth: expect.objectContaining({
            persistSession: false,
            autoRefreshToken: false,
          }),
        }),
      );
    });
  });

  describe('migration-missing failures (hard exit)', () => {
    it('throws on 42703 (undefined column) for applications.user_id', async () => {
      setupClient([
        { error: { code: '42703', message: 'column user_id does not exist' } },
      ]);

      await expect(
        assertHostedSchema(hostedConfig()),
      ).rejects.toThrow(/public\.applications\.user_id/);
    });

    it('throws on 42P01 (undefined table) for applications', async () => {
      setupClient([
        { error: { code: '42P01', message: 'relation applications does not exist' } },
      ]);

      await expect(
        assertHostedSchema(hostedConfig()),
      ).rejects.toThrow(/public\.applications\b/);
    });

    it('throws on 42703 for profile.user_id', async () => {
      setupClient([
        { error: null },
        { error: { code: '42703', message: 'column user_id does not exist' } },
      ]);

      await expect(
        assertHostedSchema(hostedConfig()),
      ).rejects.toThrow(/public\.profile\.user_id/);
    });

    it('throws on 42P01 for user_seed_state', async () => {
      setupClient([
        { error: null },
        { error: null },
        { error: { code: '42P01', message: 'relation user_seed_state does not exist' } },
      ]);

      await expect(
        assertHostedSchema(hostedConfig()),
      ).rejects.toThrow(/public\.user_seed_state\b/);
    });

    it('throws on 42703 for applications.timeline with the 025 quickstart hint', async () => {
      setupClient([
        { error: null },
        { error: null },
        { error: null },
        { error: { code: '42703', message: 'column timeline does not exist' } },
      ]);

      await expect(
        assertHostedSchema(hostedConfig()),
      ).rejects.toThrow(/applications\.timeline.*specs\/025-application-timeline\/quickstart\.md/s);
    });

    it('throws on 42703 for applications.archived_date with the 028 data-model hint', async () => {
      setupClient([
        { error: null },
        { error: null },
        { error: null },
        { error: null },
        { error: { code: '42703', message: 'column archived_date does not exist' } },
      ]);

      await expect(
        assertHostedSchema(hostedConfig()),
      ).rejects.toThrow(/applications\.archived_date.*specs\/028-archive-applications-view\/data-model\.md/s);
    });

    it('does NOT fail on 42703 for user_seed_state (contract: only table-missing triggers hard fail)', async () => {
      // user_id is the PK on user_seed_state, so 42703 is implausible; if
      // it happens, treat as transient/unknown and continue.
      const logger = makeLogger();
      setupClient([
        { error: null },
        { error: null },
        { error: { code: '42703', message: 'unusual: user_id missing on user_seed_state' } },
        { error: null },
        { error: null },
      ]);

      await expect(
        assertHostedSchema(hostedConfig(), { logger }),
      ).resolves.toBeUndefined();
      expect(logger.warn).toHaveBeenCalledWith(
        expect.stringMatching(/user_seed_state/),
      );
    });

    it('thrown error names the next steps (data-model.md reference)', async () => {
      setupClient([
        { error: { code: '42P01', message: 'relation applications does not exist' } },
      ]);

      await expect(
        assertHostedSchema(hostedConfig()),
      ).rejects.toThrow(/019.*migration|data-model\.md/i);
    });
  });

  describe('soft failures (warn and continue)', () => {
    it('logs warning and continues on 5xx-like errors', async () => {
      const logger = makeLogger();
      setupClient([
        { error: { code: 'XX000', message: 'PostgREST transient' } },
        { error: null },
        { error: null },
        { error: null },
        { error: null },
      ]);

      await expect(
        assertHostedSchema(hostedConfig(), { logger }),
      ).resolves.toBeUndefined();

      expect(logger.warn).toHaveBeenCalledWith(
        expect.stringMatching(/applications.*transient/),
      );
    });

    it('logs warning when error has no code (network error shape)', async () => {
      const logger = makeLogger();
      setupClient([
        { error: { message: 'fetch failed' } },
        { error: null },
        { error: null },
        { error: null },
        { error: null },
      ]);

      await expect(
        assertHostedSchema(hostedConfig(), { logger }),
      ).resolves.toBeUndefined();

      expect(logger.warn).toHaveBeenCalled();
    });

    it('still proceeds to remaining probes after a soft failure', async () => {
      const logger = makeLogger();
      const { fromCalls } = setupClient([
        { error: { code: 'XX000', message: 'transient' } },
        { error: null },
        { error: null },
        { error: null },
        { error: null },
      ]);

      await assertHostedSchema(hostedConfig(), { logger });

      // All probes ran despite the first one's soft failure.
      expect(fromCalls).toEqual(['applications', 'profile', 'user_seed_state', 'applications', 'applications']);
    });
  });

  describe('halt-on-first-fail semantics', () => {
    it('stops probing after a hard failure (does not check later tables)', async () => {
      const { fromCalls } = setupClient([
        { error: { code: '42P01', message: 'applications missing' } },
      ]);

      await expect(
        assertHostedSchema(hostedConfig()),
      ).rejects.toThrow();

      // Only the first probe ran — the throw aborted the loop.
      expect(fromCalls).toEqual(['applications']);
    });
  });
});
