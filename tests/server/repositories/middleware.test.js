import { describe, expect, it, vi } from 'vitest';
import { attachRepos } from '../../../server/repositories/middleware.js';

describe('attachRepos', () => {
  it('returns a middleware that attaches req.repos and calls next', () => {
    const sqliteBundle = { applications: { __mark: 'apps' }, profile: { __mark: 'profile' } };
    const dispatcher = { forRequest: vi.fn(() => sqliteBundle) };

    const middleware = attachRepos(dispatcher);
    const req = { user: { id: 'user-1' } };
    const next = vi.fn();

    middleware(req, {}, next);

    expect(req.repos).toBe(sqliteBundle);
    expect(dispatcher.forRequest).toHaveBeenCalledWith(req);
    expect(next).toHaveBeenCalledTimes(1);
    expect(next).toHaveBeenCalledWith();
  });

  it('calls dispatcher.forRequest once per request', () => {
    const dispatcher = {
      forRequest: vi.fn(() => ({ applications: {}, profile: {} })),
    };
    const middleware = attachRepos(dispatcher);

    middleware({ user: { id: 'a' } }, {}, vi.fn());
    middleware({ user: { id: 'b' } }, {}, vi.fn());

    expect(dispatcher.forRequest).toHaveBeenCalledTimes(2);
  });

  it('throws if dispatcher.forRequest is missing', () => {
    expect(() => attachRepos(null)).toThrow(/forRequest is not a function/);
    expect(() => attachRepos({})).toThrow(/forRequest is not a function/);
    expect(() => attachRepos({ forRequest: 'not a function' })).toThrow(
      /forRequest is not a function/,
    );
  });
});
