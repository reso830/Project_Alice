import process from 'node:process';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const USER_ID = 'user-uuid-abc';
const EMAIL = 'jane@example.com';

// Hoisted spies so the (hoisted) vi.mock factories can reference them.
const {
  signInWithPassword,
  deleteUser,
  updateUserById,
  createClient,
  createSupabaseAdminClient,
} = vi.hoisted(() => {
  const signIn = vi.fn();
  const del = vi.fn();
  const updateById = vi.fn();
  return {
    signInWithPassword: signIn,
    deleteUser: del,
    updateUserById: updateById,
    createClient: vi.fn(() => ({ auth: { signInWithPassword: signIn } })),
    createSupabaseAdminClient: vi.fn(() => ({
      auth: { admin: { deleteUser: del, updateUserById: updateById } },
    })),
  };
});

vi.mock('@supabase/supabase-js', () => ({ createClient }));
vi.mock('../../../../server/repositories/supabase/adminClient.js', () => ({
  createSupabaseAdminClient,
}));

const { createSupabaseAccountRepository } = await import(
  '../../../../server/repositories/supabase/account.js'
);

describe('createSupabaseAccountRepository', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.SUPABASE_URL = 'https://example.supabase.co';
    process.env.SUPABASE_ANON_KEY = 'anon-key';
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'service-role-key';
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('rejects with VALIDATION_ERROR when password is missing — no clients built', async () => {
    const repo = createSupabaseAccountRepository({ userId: USER_ID, email: EMAIL });

    await expect(repo.delete({})).rejects.toMatchObject({
      code: 'VALIDATION_ERROR',
      status: 400,
    });
    expect(signInWithPassword).not.toHaveBeenCalled();
    expect(deleteUser).not.toHaveBeenCalled();
  });

  it('rejects with INVALID_PASSWORD on wrong password — admin delete NOT called', async () => {
    signInWithPassword.mockResolvedValue({ error: new Error('Invalid login') });
    const repo = createSupabaseAccountRepository({ userId: USER_ID, email: EMAIL });

    await expect(repo.delete({ password: 'wrong' })).rejects.toMatchObject({
      code: 'INVALID_PASSWORD',
      status: 401,
    });
    expect(signInWithPassword).toHaveBeenCalledWith({ email: EMAIL, password: 'wrong' });
    expect(createSupabaseAdminClient).not.toHaveBeenCalled();
    expect(deleteUser).not.toHaveBeenCalled();
  });

  it('verifies the password then deletes the auth user on success', async () => {
    signInWithPassword.mockResolvedValue({ error: null });
    deleteUser.mockResolvedValue({ error: null });
    const repo = createSupabaseAccountRepository({ userId: USER_ID, email: EMAIL });

    const result = await repo.delete({ password: 'correct' });

    expect(result).toEqual({ deleted: true });
    expect(signInWithPassword).toHaveBeenCalledTimes(1);
    // The admin client (not the per-request JWT client) performs the delete.
    expect(createSupabaseAdminClient).toHaveBeenCalledTimes(1);
    expect(deleteUser).toHaveBeenCalledTimes(1);
    expect(deleteUser).toHaveBeenCalledWith(USER_ID);
  });

  it('propagates an admin delete error (route maps to 500) without a status', async () => {
    signInWithPassword.mockResolvedValue({ error: null });
    deleteUser.mockResolvedValue({ error: new Error('admin boom') });
    const repo = createSupabaseAccountRepository({ userId: USER_ID, email: EMAIL });

    await expect(repo.delete({ password: 'correct' })).rejects.toThrow('admin boom');
  });

  it('never logs the password', async () => {
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    signInWithPassword.mockResolvedValue({ error: null });
    deleteUser.mockResolvedValue({ error: null });
    const repo = createSupabaseAccountRepository({ userId: USER_ID, email: EMAIL });

    await repo.delete({ password: 'super-secret' });

    const allLogged = [...logSpy.mock.calls, ...errSpy.mock.calls]
      .flat()
      .map(String)
      .join(' ');
    expect(allLogged).not.toContain('super-secret');
  });

  // Feature 045 — Change Password (contracts/api.md §1).
  describe('changePassword', () => {
    it('rejects with VALIDATION_ERROR when currentPassword is missing — no clients built', async () => {
      const repo = createSupabaseAccountRepository({ userId: USER_ID, email: EMAIL });

      await expect(repo.changePassword({ newPassword: 'new-password' })).rejects.toMatchObject({
        code: 'VALIDATION_ERROR',
        status: 400,
      });
      expect(signInWithPassword).not.toHaveBeenCalled();
      expect(updateUserById).not.toHaveBeenCalled();
    });

    it('rejects with VALIDATION_ERROR when newPassword is missing — no clients built', async () => {
      const repo = createSupabaseAccountRepository({ userId: USER_ID, email: EMAIL });

      await expect(repo.changePassword({ currentPassword: 'old-pw' })).rejects.toMatchObject({
        code: 'VALIDATION_ERROR',
        status: 400,
      });
      expect(signInWithPassword).not.toHaveBeenCalled();
      expect(updateUserById).not.toHaveBeenCalled();
    });

    // Code-review finding (2026-07-11, Gemini reviewer): the presence check
    // above passes for any truthy value, not just strings — a non-string
    // body could sail through it and the `.length` check below, reaching
    // the Supabase admin call in an inconsistent shape. This is public API
    // surface; it should reject malformed types itself.
    it.each([
      ['newPassword', { currentPassword: 'old-pw', newPassword: ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'] }],
      ['newPassword', { currentPassword: 'old-pw', newPassword: { length: 20 } }],
      ['currentPassword', { currentPassword: ['old-pw'], newPassword: 'new-password' }],
    ])('rejects with VALIDATION_ERROR when %s is not a string — no clients built', async (_field, body) => {
      const repo = createSupabaseAccountRepository({ userId: USER_ID, email: EMAIL });

      await expect(repo.changePassword(body)).rejects.toMatchObject({
        code: 'VALIDATION_ERROR',
        status: 400,
      });
      expect(signInWithPassword).not.toHaveBeenCalled();
      expect(updateUserById).not.toHaveBeenCalled();
    });

    it('rejects with VALIDATION_ERROR when newPassword is below the 8-char policy floor — no re-verify attempted', async () => {
      const repo = createSupabaseAccountRepository({ userId: USER_ID, email: EMAIL });

      await expect(
        repo.changePassword({ currentPassword: 'old-pw', newPassword: 'short' }),
      ).rejects.toMatchObject({ code: 'VALIDATION_ERROR', status: 400 });
      // Server-side policy check happens before the network re-verify call.
      expect(signInWithPassword).not.toHaveBeenCalled();
      expect(updateUserById).not.toHaveBeenCalled();
    });

    it('rejects with INVALID_PASSWORD on wrong current password — admin update NOT called', async () => {
      signInWithPassword.mockResolvedValue({ error: new Error('Invalid login') });
      const repo = createSupabaseAccountRepository({ userId: USER_ID, email: EMAIL });

      await expect(
        repo.changePassword({ currentPassword: 'wrong', newPassword: 'new-password' }),
      ).rejects.toMatchObject({ code: 'INVALID_PASSWORD', status: 401 });
      expect(signInWithPassword).toHaveBeenCalledWith({ email: EMAIL, password: 'wrong' });
      expect(createSupabaseAdminClient).not.toHaveBeenCalled();
      expect(updateUserById).not.toHaveBeenCalled();
    });

    it('verifies the current password then updates it via the admin client on success', async () => {
      signInWithPassword.mockResolvedValue({ error: null });
      updateUserById.mockResolvedValue({ error: null });
      const repo = createSupabaseAccountRepository({ userId: USER_ID, email: EMAIL });

      const result = await repo.changePassword({ currentPassword: 'old-pw', newPassword: 'new-password' });

      expect(result).toEqual({ updated: true });
      expect(signInWithPassword).toHaveBeenCalledTimes(1);
      expect(signInWithPassword).toHaveBeenCalledWith({ email: EMAIL, password: 'old-pw' });
      // The admin client (not the per-request JWT client) performs the update.
      expect(createSupabaseAdminClient).toHaveBeenCalledTimes(1);
      expect(updateUserById).toHaveBeenCalledTimes(1);
      expect(updateUserById).toHaveBeenCalledWith(USER_ID, { password: 'new-password' });
      expect(deleteUser).not.toHaveBeenCalled();
    });

    it('propagates an admin update error (route maps to 500) without a status', async () => {
      signInWithPassword.mockResolvedValue({ error: null });
      updateUserById.mockResolvedValue({ error: new Error('admin boom') });
      const repo = createSupabaseAccountRepository({ userId: USER_ID, email: EMAIL });

      await expect(
        repo.changePassword({ currentPassword: 'old-pw', newPassword: 'new-password' }),
      ).rejects.toThrow('admin boom');
    });

    it('never logs either password', async () => {
      const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
      const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      signInWithPassword.mockResolvedValue({ error: null });
      updateUserById.mockResolvedValue({ error: null });
      const repo = createSupabaseAccountRepository({ userId: USER_ID, email: EMAIL });

      await repo.changePassword({ currentPassword: 'super-secret-old', newPassword: 'super-secret-new' });

      const allLogged = [...logSpy.mock.calls, ...errSpy.mock.calls]
        .flat()
        .map(String)
        .join(' ');
      expect(allLogged).not.toContain('super-secret-old');
      expect(allLogged).not.toContain('super-secret-new');
    });
  });
});
