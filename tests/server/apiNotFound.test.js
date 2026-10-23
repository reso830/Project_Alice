import { describe, expect, it } from 'vitest';
import { createApp } from '../../server/index.js';
import { createSqliteRepositories } from '../../server/repositories/index.js';
import { makeMemoryDb, wrapAsDispatcher } from './helpers.js';

describe('unmatched API routes', () => {
  it('returns the API JSON 404 contract for a nested path', async () => {
    const db = makeMemoryDb();
    const repositories = await createSqliteRepositories(db);
    const app = createApp({ repositories: wrapAsDispatcher(repositories) });
    const server = app.listen(0);
    const { port } = server.address();

    try {
      const response = await globalThis.fetch(
        `http://127.0.0.1:${port}/api/not-a-real-route`,
      );

      expect(response.status).toBe(404);
      await expect(response.json()).resolves.toEqual({
        error: {
          code: 'NOT_FOUND',
          message: 'API route not found',
        },
      });
    } finally {
      await new Promise((resolve, reject) => {
        server.close((error) => (error ? reject(error) : resolve()));
      });
      db.close();
    }
  });
});
