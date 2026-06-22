import http from 'node:http';
import { afterEach, describe, expect, test } from 'vitest';
import { listenWithFallback } from '../../server/portable/listen.js';

const servers = [];

function listen(server, port = 0, host = '127.0.0.1') {
  return new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(port, host, () => {
      server.off('error', reject);
      servers.push(server);
      resolve(server.address());
    });
  });
}

afterEach(async () => {
  await Promise.all(
    servers.splice(0).map(
      (server) =>
        new Promise((resolve, reject) => {
          server.close((error) => (error ? reject(error) : resolve()));
        }),
    ),
  );
});

describe('listenWithFallback', () => {
  test('increments to the next free port and stays bound to localhost', async () => {
    const occupied = http.createServer((_req, res) => res.end('occupied'));
    const occupiedAddress = await listen(occupied);

    const app = http.createServer((_req, res) => res.end('portable'));
    const result = await listenWithFallback(app, {
      host: '127.0.0.1',
      port: occupiedAddress.port,
      maxTries: 3,
    });
    servers.push(result.server);

    expect(result.port).toBe(occupiedAddress.port + 1);
    expect(result.server.address().address).toBe('127.0.0.1');
  });

  test('rejects after exhausting fallback attempts', async () => {
    const occupied = http.createServer((_req, res) => res.end('occupied'));
    const occupiedAddress = await listen(occupied);
    const app = http.createServer((_req, res) => res.end('portable'));

    await expect(
      listenWithFallback(app, {
        host: '127.0.0.1',
        port: occupiedAddress.port,
        maxTries: 1,
      }),
    ).rejects.toThrow(/No available port/);
  });
});
