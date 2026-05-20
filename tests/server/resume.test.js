import fs from 'node:fs';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createApp } from '../../server/index.js';
import { createTestRepositories } from '../../server/repositories/index.js';
import { makeMemoryDb, wrapAsDispatcher } from './helpers.js';

// Phase 04 — FR-012 service-role credential isolation guard.
// Pure file-read check; no integration setup required. Lives at the
// top of the file so a future reader sees the guarantee up front.
const TEST_DIR = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(TEST_DIR, '..', '..');

const RESUME_CODE_PATH_FILES = [
  'server/routes/resume.js',
  'server/resume/extractor.js',
  'server/resume/parser.js',
  'src/services/resumeApi.js',
  'src/components/ResumeImport.js',
];

const FORBIDDEN_STRINGS = ['SUPABASE_SERVICE_ROLE_KEY', 'service_role'];

describe('resume API — service-role credential isolation (FR-012)', () => {
  it.each(RESUME_CODE_PATH_FILES)(
    '%s contains no reference to service-role credentials',
    (relativePath) => {
      const contents = readFileSync(join(REPO_ROOT, relativePath), 'utf8');
      for (const forbidden of FORBIDDEN_STRINGS) {
        expect(
          contents,
          `forbidden string "${forbidden}" found in ${relativePath}`,
        ).not.toContain(forbidden);
      }
    },
  );
});

async function withServer(test) {
  const db = makeMemoryDb();
  const repositories = await createTestRepositories(db);
  const app = createApp({ repositories: wrapAsDispatcher(repositories) });
  const server = app.listen(0);
  const { port } = server.address();
  const baseUrl = `http://127.0.0.1:${port}`;

  try {
    await test(baseUrl, db);
  } finally {
    server.close();
    db.close();
  }
}

async function uploadResume(baseUrl, { content = '', type = 'text/plain', filename = 'resume.txt' } = {}) {
  const body = new globalThis.FormData();
  body.append('resume', new globalThis.Blob([content], { type }), filename);

  const response = await globalThis.fetch(`${baseUrl}/api/resume/parse`, {
    method: 'POST',
    body,
  });

  return {
    status: response.status,
    body: await response.json(),
  };
}

describe('resume API', () => {
  it('parses a valid TXT resume upload', async () => {
    await withServer(async (baseUrl) => {
      const response = await uploadResume(baseUrl, {
        content: `
          Jane Smith
          jane@example.com

          Experience
          Acme Corp
          Senior Engineer
          Jan 2022 - Dec 2023
          Led platform work

          Skills
          JavaScript, Node.js
        `,
      });

      expect(response.status).toBe(200);
      expect(response.body.data).toMatchObject({
        firstName: 'Jane',
        skills: ['JavaScript', 'Node.js'],
      });
      expect(response.body.data.experience[0]).toMatchObject({
        company: 'Acme Corp',
        role: 'Senior Engineer',
      });
    });
  });

  it('returns validation error when no file is provided', async () => {
    await withServer(async (baseUrl) => {
      const response = await globalThis.fetch(`${baseUrl}/api/resume/parse`, {
        method: 'POST',
        body: new globalThis.FormData(),
      });
      const body = await response.json();

      expect(response.status).toBe(400);
      expect(body.error.code).toBe('VALIDATION_ERROR');
    });
  });

  it('returns unsupported file type for unsupported MIME uploads', async () => {
    await withServer(async (baseUrl) => {
      const response = await uploadResume(baseUrl, {
        content: 'not an image',
        type: 'image/png',
        filename: 'resume.png',
      });

      expect(response.status).toBe(400);
      expect(response.body.error.code).toBe('UNSUPPORTED_FILE_TYPE');
    });
  });

  it('returns file too large for uploads over 5 MB', async () => {
    await withServer(async (baseUrl) => {
      const response = await uploadResume(baseUrl, {
        content: 'a'.repeat((5 * 1024 * 1024) + 1),
      });

      expect(response.status).toBe(400);
      expect(response.body.error.code).toBe('FILE_TOO_LARGE');
    });
  });

  it('returns an empty parsed profile for unparseable TXT content', async () => {
    await withServer(async (baseUrl) => {
      const response = await uploadResume(baseUrl, {
        content: '@@@ ### !!!',
      });

      expect(response.status).toBe(200);
      expect(response.body.data).toEqual({
        firstName: null,
        lastName: null,
        email: null,
        phone: null,
        city: null,
        summary: null,
        experience: [],
        education: [],
        skills: [],
        certifications: [],
        awards: [],
        languages: [],
        links: [],
      });
    });
  });

  it('accepts generic MIME uploads through TXT filename fallback', async () => {
    await withServer(async (baseUrl) => {
      const response = await uploadResume(baseUrl, {
        content: 'Jane Smith',
        type: 'application/octet-stream',
        filename: 'resume.txt',
      });

      expect(response.status).toBe(200);
      expect(response.body.data).toMatchObject({
        firstName: 'Jane',
        lastName: 'Smith',
      });
    });
  });

  it('returns 400 PARSE_FAILED for a corrupted PDF without leaking library internals', async () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    try {
      await withServer(async (baseUrl) => {
        const response = await uploadResume(baseUrl, {
          content: 'NOT A REAL PDF',
          type: 'application/pdf',
          filename: 'bad.pdf',
        });
        expect(response.status).toBe(400);
        expect(response.body.error.code).toBe('PARSE_FAILED');
        expect(response.body.error.message).toBe('Could not read this resume. Try a different file.');
        const bodyText = JSON.stringify(response.body);
        expect(bodyText).not.toMatch(/pdf-parse/i);
        expect(bodyText).not.toMatch(/pdfjs/i);
        expect(bodyText).not.toMatch(/DOMMatrix/);
        expect(bodyText).not.toMatch(/node_modules/);
      });
    } finally {
      errorSpy.mockRestore();
    }
  });

  it('returns 400 PARSE_FAILED for a corrupted DOCX without leaking library internals', async () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    try {
      await withServer(async (baseUrl) => {
        const response = await uploadResume(baseUrl, {
          content: 'NOT A REAL DOCX ZIP',
          type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
          filename: 'bad.docx',
        });
        expect(response.status).toBe(400);
        expect(response.body.error.code).toBe('PARSE_FAILED');
        expect(response.body.error.message).toBe('Could not read this resume. Try a different file.');
        const bodyText = JSON.stringify(response.body);
        expect(bodyText).not.toMatch(/mammoth/i);
        expect(bodyText).not.toMatch(/node_modules/);
      });
    } finally {
      errorSpy.mockRestore();
    }
  });

  it('logs a sanitized [resume.parse] line on parse failure (no raw filename)', async () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    try {
      await withServer(async (baseUrl) => {
        await uploadResume(baseUrl, {
          content: 'NOT A REAL PDF',
          type: 'application/pdf',
          filename: 'alex_rivera_resume_2026.pdf',
        });
      });
      const resumeLogCalls = errorSpy.mock.calls.filter(
        (args) => args[0] === '[resume.parse]',
      );
      expect(resumeLogCalls).toHaveLength(1);
      const logged = resumeLogCalls[0][1];
      expect(logged).toMatchObject({
        error: expect.any(String),
        nameSha8: expect.stringMatching(/^[a-f0-9]{8}$/),
        mimetype: 'application/pdf',
        path: '/api/resume/parse',
      });
      expect(logged.nameSha8).not.toContain('alex');
      expect(JSON.stringify(logged)).not.toContain('alex_rivera_resume_2026.pdf');
    } finally {
      errorSpy.mockRestore();
    }
  });

  it('no failure mode reaches the global INTERNAL_ERROR handler (FR-007)', async () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    try {
      const failures = [
        {
          label: 'corrupted PDF',
          upload: { content: 'NOT A PDF', type: 'application/pdf', filename: 'bad.pdf' },
        },
        {
          label: 'corrupted DOCX',
          upload: {
            content: 'NOT A DOCX',
            type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
            filename: 'bad.docx',
          },
        },
        {
          label: 'unsupported extension',
          upload: { content: 'x', type: 'application/octet-stream', filename: 'r.exe' },
        },
      ];

      for (const { label, upload } of failures) {
        await withServer(async (baseUrl) => {
          const response = await uploadResume(baseUrl, upload);
          expect(
            response.status,
            `${label}: response should not be 500`,
          ).not.toBe(500);
          expect(
            response.body.error.code,
            `${label}: error code should not be INTERNAL_ERROR`,
          ).not.toBe('INTERNAL_ERROR');
        });
      }
    } finally {
      errorSpy.mockRestore();
    }
  });

  it('multer LIMIT_UNEXPECTED_FILE does not reach the global 500 handler', async () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    try {
      await withServer(async (baseUrl) => {
        const fd = new globalThis.FormData();
        fd.append(
          'wrong_field_name',
          new globalThis.Blob(['x'], { type: 'text/plain' }),
          'r.txt',
        );
        const response = await globalThis.fetch(`${baseUrl}/api/resume/parse`, {
          method: 'POST',
          body: fd,
        });
        expect(response.status).not.toBe(500);
        const body = await response.json();
        expect(body.error.code).not.toBe('INTERNAL_ERROR');
        expect(body.error.code).toBe('VALIDATION_ERROR');
        expect(JSON.stringify(body)).not.toMatch(/wrong_field_name/);
        expect(JSON.stringify(body)).not.toMatch(/unexpected field/i);
      });
    } finally {
      errorSpy.mockRestore();
    }
  });
});

async function withHostedServer(test) {
  const db = makeMemoryDb();
  const repositories = await createTestRepositories(db);
  const requireAuth = (_req, res) =>
    res.status(401).json({
      error: { code: 'UNAUTHORIZED', message: 'Authentication required' },
    });
  const app = createApp({
    repositories: wrapAsDispatcher(repositories),
    requireAuth,
  });
  const server = app.listen(0);
  const { port } = server.address();
  const baseUrl = `http://127.0.0.1:${port}`;

  try {
    await test(baseUrl, db);
  } finally {
    server.close();
    db.close();
  }
}

describe('resume API — hosted auth gate (FR-001, FR-009)', () => {
  it('returns 401 for hosted POST without Authorization header', async () => {
    await withHostedServer(async (baseUrl) => {
      const response = await uploadResume(baseUrl, {
        content: 'anything',
        type: 'text/plain',
        filename: 'r.txt',
      });
      expect(response.status).toBe(401);
      expect(response.body.error.code).toBe('UNAUTHORIZED');
    });
  });

  it('401 response body contains no parser library names or internal paths', async () => {
    await withHostedServer(async (baseUrl) => {
      const response = await uploadResume(baseUrl, {
        content: 'anything',
        type: 'application/pdf',
        filename: 'r.pdf',
      });
      expect(response.status).toBe(401);
      const bodyText = JSON.stringify(response.body);
      expect(bodyText).not.toMatch(/pdf-parse/i);
      expect(bodyText).not.toMatch(/pdfjs/i);
      expect(bodyText).not.toMatch(/mammoth/i);
      expect(bodyText).not.toMatch(/multer/i);
      expect(bodyText).not.toMatch(/node_modules/);
    });
  });
});

// Phase 03 — fs-spy regression test (FR-002, FR-010).
//
// passThrough() records every call to a method while preserving the
// original implementation. Pass-through is mandatory: a no-op mock on
// fs.open / fs.openSync would break in-process reads (vitest module
// loader, snapshot fixtures, library debug paths) during the test.
function passThrough(target, method) {
  const original = target[method].bind(target);
  return vi.spyOn(target, method).mockImplementation((...args) => original(...args));
}

function installFsSpies() {
  return {
    writeFile: passThrough(fs, 'writeFile'),
    writeFileSync: passThrough(fs, 'writeFileSync'),
    appendFile: passThrough(fs, 'appendFile'),
    appendFileSync: passThrough(fs, 'appendFileSync'),
    createWriteStream: passThrough(fs, 'createWriteStream'),
    open: passThrough(fs, 'open'),
    openSync: passThrough(fs, 'openSync'),
    writeSync: passThrough(fs, 'writeSync'),
    promisesWriteFile: passThrough(fs.promises, 'writeFile'),
    promisesAppendFile: passThrough(fs.promises, 'appendFile'),
  };
}

function isWriteMode(flags) {
  if (typeof flags === 'string') return /[wax+]/.test(flags);
  if (typeof flags === 'number') {
    const writeMask =
      fs.constants.O_WRONLY |
      fs.constants.O_RDWR |
      fs.constants.O_CREAT |
      fs.constants.O_TRUNC |
      fs.constants.O_APPEND;
    return (flags & writeMask) !== 0;
  }
  return false;
}

function assertNoFsWrites(spies) {
  for (const [name, spy] of Object.entries(spies)) {
    if (name === 'open' || name === 'openSync') {
      // open() / openSync() are also used for legitimate in-process
      // READS by the module loader, snapshot fixtures, etc. Only flag
      // calls whose flags argument indicates write/create/truncate/
      // append intent — those are the actual write-path signature.
      const writeOpens = spy.mock.calls.filter((args) => isWriteMode(args[1]));
      expect(
        writeOpens,
        `unexpected write-mode fs.${name} call(s): ${JSON.stringify(writeOpens)}`,
      ).toHaveLength(0);
      continue;
    }
    expect(spy, `unexpected fs.${name} call during parse`).not.toHaveBeenCalled();
  }
}

describe('resume API — in-memory invariant (FR-002, FR-010)', () => {
  let spies;
  beforeEach(() => {
    // Suppress the route's [resume.parse] log so it can't reach stderr
    // and trip a writeSync spy via console.error → process.stderr.
    vi.spyOn(console, 'error').mockImplementation(() => {});
    spies = installFsSpies();
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('does not write to disk during a successful TXT parse', async () => {
    await withServer(async (baseUrl) => {
      await uploadResume(baseUrl, { content: 'Jane Smith', type: 'text/plain' });
    });
    assertNoFsWrites(spies);
  });

  it('does not write to disk during a corrupted-PDF parse', async () => {
    await withServer(async (baseUrl) => {
      await uploadResume(baseUrl, {
        content: 'NOT A PDF',
        type: 'application/pdf',
        filename: 'bad.pdf',
      });
    });
    assertNoFsWrites(spies);
  });

  it('does not write to disk during an UNSUPPORTED_FILE_TYPE rejection', async () => {
    await withServer(async (baseUrl) => {
      await uploadResume(baseUrl, {
        content: 'x',
        type: 'application/octet-stream',
        filename: 'r.exe',
      });
    });
    assertNoFsWrites(spies);
  });

  it('does not write to disk during a VALIDATION_ERROR (missing file)', async () => {
    await withServer(async (baseUrl) => {
      const response = await globalThis.fetch(`${baseUrl}/api/resume/parse`, {
        method: 'POST',
        body: new globalThis.FormData(),
      });
      await response.json();
    });
    assertNoFsWrites(spies);
  });

  it('does not write to disk during a FILE_TOO_LARGE rejection', async () => {
    const oversized = 'A'.repeat(5_242_880 + 1024);
    await withServer(async (baseUrl) => {
      await uploadResume(baseUrl, {
        content: oversized,
        type: 'text/plain',
        filename: 'big.txt',
      });
    });
    assertNoFsWrites(spies);
  });
});
