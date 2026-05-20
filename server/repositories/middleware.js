/**
 * Express middleware factory that attaches a per-request repository bundle
 * to `req.repos`. The bundle is obtained by calling the dispatcher's
 * uniform `forRequest(req)` method, so route handlers have one contract
 * regardless of runtime mode:
 *
 *   - Local mode: `forRequest(req)` returns a long-lived SQLite bundle.
 *   - Hosted mode: `forRequest(req)` constructs a fresh RLS-scoped
 *     Supabase bundle from the caller's JWT.
 *
 * Mount after `requireAuth` on every protected router so the handler can
 * read `req.repos.applications` / `req.repos.profile` without branching
 * on runtime. See `specs/019-supabase-persistence/contracts/api.md §1.1`.
 *
 * @param {{ forRequest: (req: import('express').Request) => object }} dispatcher
 * @returns {(req: import('express').Request, res: import('express').Response, next: () => void) => void}
 */
export function attachRepos(dispatcher) {
  if (!dispatcher || typeof dispatcher.forRequest !== 'function') {
    throw new Error(
      'attachRepos: dispatcher.forRequest is not a function — pass the object returned by createRepositories(config)',
    );
  }

  return function attachReposMiddleware(req, _res, next) {
    req.repos = dispatcher.forRequest(req);
    next();
  };
}
